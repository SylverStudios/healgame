/**
 * Pure, deterministic combat simulation (poc-spec §4). No Phaser, no wall-clock
 * time, no randomness — driven entirely by explicit advance(dtMs) steps.
 *
 * See ./README.md for the rule decisions (mana reserve/refund, cast cancel,
 * queue semantics, boss cast cadence, targeting priority) this implementation
 * encodes.
 */

import { GCD_MS, MERCS, PARTY, REWARDS, TRASH } from '../data/constants';
import type {
  BossCastState,
  CastState,
  CombatEngineOptions,
  CombatEvent,
  CombatState,
  CombatStatus,
  CooldownDef,
  CooldownState,
  EncounterDef,
  FullHealthBonusRule,
  MissingHealthBonusRule,
  MissingHealthPctBonusRule,
  PartyDoTCastDef,
  SpellDef,
  SynergyRule,
  TunnelVisionCastDef,
  Unit,
} from './types';

/**
 * Internal engine-only state for an active Tunnel Vision channel (telegraph
 * already finished). Not part of the public CombatState surface — VFX/log
 * consumers drive off the bossFocusStarted/Tick/Ended events instead.
 */
interface BossFocusState {
  targetId: string;
  name: string;
  /** Total ms remaining in the channel (ends the channel at/below 0). */
  remainingMs: number;
  /** Countdown to the next tick. */
  tickRemainingMs: number;
  tickMs: number;
  damagePerTick: number;
}

/**
 * Internal engine-only state for an active party-wide DoT after a partyDoT
 * telegraph finishes. Presentation drives off partyDoTStarted/Ended plus the
 * normal damage events from each tick.
 */
interface PartyDoTState {
  name: string;
  remainingMs: number;
  tickRemainingMs: number;
  tickMs: number;
  damagePerTick: number;
}

/**
 * Internal per-cooldown runtime state (Alpha 0.1 §D6). Not part of the public
 * CombatState surface — `state` reduces this to CooldownState for the UI.
 * `def` is cloned (effect object too) in the constructor so the engine's
 * mutable runtime fields never touch a caller-owned CooldownDef.
 */
interface CooldownRuntime {
  def: CooldownDef;
  /** 0 = ready to activate. */
  remainingCooldownMs: number;
  /** freeNextHeal only: true while a charge is armed, awaiting the next cast start. */
  armed: boolean;
  /** manaCostReduction only: ms left in the buff window; 0 = inactive. */
  buffRemainingMs: number;
}

interface RelicStats {
  bonusMaxMana: number;
  bonusHealing: number;
  manaRegenAmount: number;
  manaRegenIntervalMs: number | null;
  maxHp: Record<'tank' | 'dps' | 'healer', number>;
  armor: Record<'tank' | 'dps' | 'healer', number>;
  autoDamage: Record<'tank' | 'dps', number>;
  swingIntervalDeltaMs: Record<'tank' | 'dps', number>;
}

export class CombatEngine {
  private readonly encounter: EncounterDef;
  private readonly spells: SpellDef[];

  /** Synergy rules with mutable per-entry armed state (constructor-cloned; never shared with the caller). */
  private readonly synergies: (SynergyRule & { armed: boolean })[];
  private readonly missingHealthBonuses: MissingHealthBonusRule[];
  private readonly missingHealthPctBonuses: MissingHealthPctBonusRule[];
  private readonly fullHealthBonuses: FullHealthBonusRule[];
  /** Cooldown runtime state, same order as options.cooldowns (Alpha 0.1 §D6). */
  private readonly cooldowns: CooldownRuntime[];
  private readonly relicStats: RelicStats;
  private relicRegenRemainingMs: number | null = null;

  private party: Unit[] = [];
  private activeEnemies: Unit[] = [];
  private boss: Unit | null = null;

  /** Countdown timers for every unit with an auto-attack (mercs + enemies/boss). Entry removed on death. */
  private readonly swingTimers = new Map<string, number>();
  /** Effective authored combat stats, keyed by deterministic spawned unit id. */
  private readonly enemyStats = new Map<string, { autoDamage: number; swingIntervalMs: number }>();

  private playerCast: CastState | null = null;
  /** Mana actually reserved for the active playerCast at cast start — may be less than
   *  spellById(cast.spellId).mana (Still Waters: 0; Frenzied Liturgy: cost - reduction). */
  private playerCastReservedMana = 0;
  private queuedCast: { spellId: string; targetId: string } | null = null;
  private gcdRemainingMs = 0;
  private targetId: string | null = null;

  private bossCastState: BossCastState | null = null;
  /** Countdown to the next boss cast start; null while a party-AoE cast is active or the boss has no cast. */
  private bossCastTimerRemainingMs: number | null = null;

  /** Active Tunnel Vision channel (telegraph already finished); null otherwise. */
  private bossFocusState: BossFocusState | null = null;
  private partyDoTState: PartyDoTState | null = null;
  /** Deterministic round-robin cursor into the eligible (non-tank, living) focus targets; never Math.random. */
  private focusIndex = 0;

  private waveIndex = 0;
  private status: CombatStatus = 'running';

  private rewardsXp = 0;

  /** Events produced synchronously by commands (castSpell), flushed on the next advance(). */
  private pending: CombatEvent[] = [];

  constructor(encounter: EncounterDef, spells: SpellDef[], options?: CombatEngineOptions) {
    this.encounter = encounter;
    this.spells = spells;

    this.relicStats = {
      bonusMaxMana: 0,
      bonusHealing: 0,
      manaRegenAmount: 0,
      manaRegenIntervalMs: null,
      maxHp: { tank: 0, dps: 0, healer: 0 },
      armor: { tank: 0, dps: 0, healer: 0 },
      autoDamage: { tank: 0, dps: 0 },
      swingIntervalDeltaMs: { tank: 0, dps: 0 },
    };
    for (const relic of options?.relics ?? []) {
      for (const effect of relic.effects) {
        switch (effect.kind) {
          case 'bonusMaxMana':
            this.relicStats.bonusMaxMana += effect.amount;
            break;
          case 'bonusHealing':
            this.relicStats.bonusHealing += effect.amount;
            break;
          case 'manaRegen':
            this.relicStats.manaRegenAmount += effect.amount;
            this.relicStats.manaRegenIntervalMs =
              this.relicStats.manaRegenIntervalMs === null
                ? effect.intervalMs
                : Math.min(this.relicStats.manaRegenIntervalMs, effect.intervalMs);
            break;
          case 'roleMaxHp':
            this.relicStats.maxHp[effect.role] += effect.amount;
            break;
          case 'roleArmor':
            this.relicStats.armor[effect.role] += effect.amount;
            break;
          case 'roleAutoDamage':
            this.relicStats.autoDamage[effect.role] += effect.amount;
            break;
          case 'roleSwingInterval':
            this.relicStats.swingIntervalDeltaMs[effect.role] += effect.deltaMs;
            break;
        }
      }
    }

    // Alpha 0.2: loadout/level manaRegen merges with relic regen — sum amounts,
    // take the minimum interval across every contributing source.
    if (options?.manaRegen) {
      this.relicStats.manaRegenAmount += options.manaRegen.amount;
      this.relicStats.manaRegenIntervalMs =
        this.relicStats.manaRegenIntervalMs === null
          ? options.manaRegen.intervalMs
          : Math.min(this.relicStats.manaRegenIntervalMs, options.manaRegen.intervalMs);
    }

    const healerMana = PARTY.startingMana + (options?.bonusMaxMana ?? 0) + this.relicStats.bonusMaxMana;
    this.relicRegenRemainingMs = this.relicStats.manaRegenIntervalMs;

    // Chunk 1 (phase-2-handoff): synergy + missing-health bonus rules, cloned so the
    // engine's mutable `armed` state never touches the caller's arrays.
    this.synergies = (options?.synergies ?? []).map((s) => ({ ...s, armed: false }));
    this.missingHealthBonuses = (options?.missingHealthBonuses ?? []).map((m) => ({ ...m }));
    // Chunk 4 (alpha-0.1 §D4): pct-of-base-heal missing-health rule (Graven Scale)
    // and full-health threshold rule (Steady Hands), cloned like the arrays above.
    this.missingHealthPctBonuses = (options?.missingHealthPctBonuses ?? []).map((m) => ({ ...m }));
    this.fullHealthBonuses = (options?.fullHealthBonuses ?? []).map((f) => ({ ...f }));
    // Alpha 0.1 §D6: cooldown defs cloned (effect object too) so this instance's mutable
    // runtime state (remainingCooldownMs, armed, buffRemainingMs) never touches the caller's
    // array/objects. Every CD starts ready (remainingCooldownMs 0), no charge, no buff.
    this.cooldowns = (options?.cooldowns ?? []).map((def) => ({
      def: { ...def, effect: { ...def.effect } },
      remainingCooldownMs: 0,
      armed: false,
      buffRemainingMs: 0,
    }));

    const tankHp = PARTY.tankMaxHp + this.relicStats.maxHp.tank;
    const dpsHp = PARTY.dpsMaxHp + this.relicStats.maxHp.dps;
    const healerHp = PARTY.healerMaxHp + this.relicStats.maxHp.healer;
    this.party = [
      { id: 'tank', name: 'Tank', role: 'tank', hp: tankHp, maxHp: tankHp, mana: 0, maxMana: 0, alive: true },
      { id: 'dps1', name: 'DPS 1', role: 'dps', hp: dpsHp, maxHp: dpsHp, mana: 0, maxMana: 0, alive: true },
      { id: 'dps2', name: 'DPS 2', role: 'dps', hp: dpsHp, maxHp: dpsHp, mana: 0, maxMana: 0, alive: true },
      {
        id: 'healer',
        name: 'Healer',
        role: 'healer',
        hp: healerHp,
        maxHp: healerHp,
        mana: healerMana,
        maxMana: healerMana,
        alive: true,
      },
    ];
    for (const u of this.party) {
      if (u.role === 'tank') this.swingTimers.set(u.id, this.mercSwingInterval('tank'));
      else if (u.role === 'dps') this.swingTimers.set(u.id, this.mercSwingInterval('dps'));
    }

    this.spawnWave(0);
    this.pending.push({ type: 'waveStarted', waveIndex: 0 });
  }

  /** Step the simulation forward. Safe for any dt — internally sub-steps to the next event boundary. */
  advance(dtMs: number): CombatEvent[] {
    const events: CombatEvent[] = [...this.pending];
    this.pending = [];

    let remaining = dtMs;
    while (remaining > 0 && this.status === 'running') {
      const boundary = this.nextTimerBoundary();
      const step = Number.isFinite(boundary) ? Math.min(remaining, boundary) : remaining;
      if (step <= 0) break;
      this.tick(step, events);
      remaining -= step;
    }
    return events;
  }

  /** Click-to-target an ally. Silently ignored if the unit is unknown/dead/not a party member. */
  setTarget(unitId: string): void {
    const unit = this.party.find((u) => u.id === unitId);
    if (!unit || !unit.alive) return;
    this.targetId = unitId;
  }

  /**
   * Cast (or queue) a spell. Heals require a living ally target; damage spells
   * (`damage > 0`) auto-target the front living enemy. Silently ignored if
   * illegal: unknown spell, no/dead target, or insufficient mana. See README.
   */
  castSpell(spellId: string): void {
    if (this.status !== 'running') return;
    const spell = this.spellById(spellId);
    if (!spell) return;
    const targetId = this.resolveCastTargetId(spell);
    if (!targetId) return;

    const busy = this.playerCast !== null || this.gcdRemainingMs > 0;
    if (busy) {
      // Re-queue replaces; target locked in at queue time, re-validated when it fires.
      this.queuedCast = { spellId, targetId };
      return;
    }

    // Still Waters (Alpha 0.1 §D6): an armed freeNextHeal charge bypasses the
    // affordability check entirely (castable even at 0 mana) — beginCast
    // reserves 0 mana and consumes the charge. Damage spells never use it.
    const isDamage = (spell.damage ?? 0) > 0;
    if (!isDamage && this.findArmedFreeHealCooldown()) {
      // free heal — skip mana gate
    } else {
      const healer = this.getUnit('healer')!;
      if (healer.mana < this.effectiveManaCost(spell)) return;
    }
    const out: CombatEvent[] = [];
    this.beginCast(spellId, targetId, out);
    this.pending.push(...out);
  }

  /** Ally target for heals; front living enemy for damage spells. */
  private resolveCastTargetId(spell: SpellDef): string | null {
    if ((spell.damage ?? 0) > 0) {
      return this.activeEnemies.find((e) => e.alive)?.id ?? null;
    }
    if (!this.targetId) return null;
    const target = this.party.find((u) => u.id === this.targetId);
    return target?.alive ? target.id : null;
  }

  /**
   * Cancel the active cast (refunding its reserved mana) and clear any queued
   * cast. Buffered like `castSpell` — mutates immediately, the `castCancelled`
   * event is delivered on the next `advance()`. If only a queue entry exists
   * (no active cast), it's cleared with no refund and no event (it never
   * started). No-op if nothing is active or queued, or combat has ended.
   */
  cancelCast(): void {
    if (this.status !== 'running') return;
    if (this.playerCast) {
      const spellId = this.playerCast.spellId;
      this.refundCastMana();
      this.playerCast = null;
      this.queuedCast = null;
      this.pending.push({ type: 'castCancelled', spellId, reason: 'escape' });
    } else if (this.queuedCast) {
      this.queuedCast = null;
    }
  }

  /**
   * Activate a cooldown (Alpha 0.1 §D6). Off-GCD: no busy/GCD check at all —
   * allowed mid-cast, mid-channel, any time combat is running. Buffered like
   * castSpell: mutates immediately, `cooldownActivated` is delivered on the
   * next advance(). Silently ignored: unknown id, still on cooldown, or
   * combat not running.
   */
  activateCooldown(cooldownId: string): void {
    if (this.status !== 'running') return;
    const cd = this.cooldowns.find((c) => c.def.id === cooldownId);
    if (!cd || cd.remainingCooldownMs > 0) return;
    cd.remainingCooldownMs = cd.def.cooldownMs;
    if (cd.def.effect.kind === 'freeNextHeal') {
      cd.armed = true;
    } else {
      // manaCostReduction / healBonus: re-activating while the window is still open
      // resets it to full duration rather than stacking (Alpha 0.1 §D6 / 0.2 §D6).
      cd.buffRemainingMs = cd.def.effect.durationMs;
    }
    this.pending.push({ type: 'cooldownActivated', id: cd.def.id, name: cd.def.name });
  }

  get state(): Readonly<CombatState> {
    return {
      party: this.party.map((u) => ({ ...u })),
      enemies: this.activeEnemies.map((u) => ({ ...u })),
      playerCast: this.playerCast ? { ...this.playerCast } : null,
      bossCast: this.bossCastState ? { ...this.bossCastState } : null,
      targetId: this.targetId,
      gcdRemainingMs: Math.max(0, this.gcdRemainingMs),
      waveIndex: this.waveIndex,
      status: this.status,
      armedBuffedSpellIds: [...new Set(this.synergies.filter((s) => s.armed).map((s) => s.buffedSpellId))],
      cooldowns: this.cooldowns.map(
        (cd): CooldownState => ({
          id: cd.def.id,
          name: cd.def.name,
          remainingCooldownMs: Math.max(0, cd.remainingCooldownMs),
          activeRemainingMs:
            cd.def.effect.kind === 'freeNextHeal' ? (cd.armed ? 1 : 0) : Math.max(0, cd.buffRemainingMs),
        }),
      ),
    };
  }

  get rewards(): { xp: number } {
    return { xp: this.rewardsXp };
  }

  // ---- internal: time stepping -------------------------------------------------

  private nextTimerBoundary(): number {
    let min = Infinity;
    if (this.gcdRemainingMs > 0) min = Math.min(min, this.gcdRemainingMs);
    // Instant casts (castMs === 0) complete synchronously in beginCast; never
    // surface a 0 remainingMs here — that would freeze advance() at step 0.
    if (this.playerCast && this.playerCast.remainingMs > 0) {
      min = Math.min(min, this.playerCast.remainingMs);
    }
    for (const remaining of this.swingTimers.values()) min = Math.min(min, remaining);
    if (this.bossCastState) min = Math.min(min, this.bossCastState.remainingMs);
    if (this.bossCastTimerRemainingMs !== null) min = Math.min(min, this.bossCastTimerRemainingMs);
    if (this.bossFocusState) {
      min = Math.min(min, this.bossFocusState.remainingMs, this.bossFocusState.tickRemainingMs);
    }
    if (this.partyDoTState) {
      min = Math.min(min, this.partyDoTState.remainingMs, this.partyDoTState.tickRemainingMs);
    }
    for (const cd of this.cooldowns) {
      if (cd.remainingCooldownMs > 0) min = Math.min(min, cd.remainingCooldownMs);
      if (cd.buffRemainingMs > 0) min = Math.min(min, cd.buffRemainingMs);
    }
    if (this.relicRegenRemainingMs !== null) min = Math.min(min, this.relicRegenRemainingMs);
    return min;
  }

  /** Advance every active timer by `step` ms, then resolve anything that hit zero in a fixed priority order. */
  private tick(step: number, events: CombatEvent[]): void {
    if (this.playerCast) this.playerCast.remainingMs -= step;
    if (this.gcdRemainingMs > 0) this.gcdRemainingMs -= step;
    for (const [id, remaining] of this.swingTimers) this.swingTimers.set(id, remaining - step);
    if (this.bossCastState) this.bossCastState.remainingMs -= step;
    if (this.bossCastTimerRemainingMs !== null) this.bossCastTimerRemainingMs -= step;
    if (this.bossFocusState) {
      this.bossFocusState.remainingMs -= step;
      this.bossFocusState.tickRemainingMs -= step;
    }
    if (this.partyDoTState) {
      this.partyDoTState.remainingMs -= step;
      this.partyDoTState.tickRemainingMs -= step;
    }
    if (this.relicRegenRemainingMs !== null) this.relicRegenRemainingMs -= step;
    // Cooldown timers (Alpha 0.1 §D6): plain cooldown countdown (no event on reaching
    // ready — the UI reads remainingCooldownMs === 0 off state) and manaCostReduction
    // buff windows, which emit cooldownBuffEnded exactly once on expiry (below). The
    // `> 0` guard means a window that's already hit 0 stays at 0 and never re-fires.
    const expiredBuffCooldownIds: string[] = [];
    for (const cd of this.cooldowns) {
      if (cd.remainingCooldownMs > 0) cd.remainingCooldownMs = Math.max(0, cd.remainingCooldownMs - step);
      if (cd.buffRemainingMs > 0) {
        cd.buffRemainingMs -= step;
        if (cd.buffRemainingMs <= 0) {
          cd.buffRemainingMs = 0;
          expiredBuffCooldownIds.push(cd.def.id);
        }
      }
    }

    // 1. cooldown buff windows that expired this tick (Frenzied Liturgy)
    for (const id of expiredBuffCooldownIds) events.push({ type: 'cooldownBuffEnded', id });
    // 1b. Permanent relic mana regeneration uses simulation time.
    if (this.relicRegenRemainingMs !== null && this.relicRegenRemainingMs <= 0) {
      this.relicRegenRemainingMs = this.relicStats.manaRegenIntervalMs;
      const healer = this.getUnit('healer')!;
      healer.mana = Math.min(healer.maxMana, healer.mana + this.relicStats.manaRegenAmount);
    }
    // 2. player cast completes
    if (this.playerCast && this.playerCast.remainingMs <= 0) {
      this.completePlayerCast(events);
    }
    // 3. GCD/cast busy window ends -> fire queued spell, if any
    if (this.gcdRemainingMs <= 0 && this.playerCast === null) {
      this.fireQueuedCast(events);
    }
    // 4. boss cast completes -> partyAoE / manaSiphon damage, partyDoT start, or tunnelVision channel
    if (this.status === 'running' && this.bossCastState && this.bossCastState.remainingMs <= 0) {
      this.completeBossCast(events);
    }
    // 5. boss focus tick (Tunnel Vision channel damage)
    if (this.status === 'running' && this.bossFocusState && this.bossFocusState.tickRemainingMs <= 0) {
      this.resolveBossFocusTick(events);
    }
    // 5b. party DoT tick (partyDoT lingering burn)
    if (this.status === 'running' && this.partyDoTState && this.partyDoTState.tickRemainingMs <= 0) {
      this.resolvePartyDoTTick(events);
    }
    // 6. merc auto-attacks
    if (this.status === 'running') {
      for (const id of ['tank', 'dps1', 'dps2']) {
        if (this.status !== 'running') break;
        const remaining = this.swingTimers.get(id);
        if (remaining === undefined || remaining > 0) continue;
        this.resolveMercSwing(id, events);
        if (this.swingTimers.has(id)) {
          const merc = this.party.find((u) => u.id === id);
          const interval = merc?.role === 'tank' ? this.mercSwingInterval('tank') : this.mercSwingInterval('dps');
          this.swingTimers.set(id, interval);
        }
      }
    }
    // 7. enemy/boss auto-attacks
    if (this.status === 'running') {
      for (const enemy of [...this.activeEnemies]) {
        if (this.status !== 'running') break;
        const remaining = this.swingTimers.get(enemy.id);
        if (remaining === undefined || remaining > 0) continue;
        this.resolveEnemySwing(enemy.id, events);
        if (this.swingTimers.has(enemy.id)) {
          this.swingTimers.set(enemy.id, this.enemyStatsFor(enemy.id).swingIntervalMs);
        }
      }
    }
    // 8. boss cast timer elapses -> start a new telegraphed cast (blocked while a focus channel is active)
    if (
      this.status === 'running' &&
      this.bossCastTimerRemainingMs !== null &&
      this.bossCastTimerRemainingMs <= 0 &&
      this.bossCastState === null &&
      this.bossFocusState === null
    ) {
      this.startBossCast(events);
    }
  }

  // ---- internal: player casting --------------------------------------------------

  /**
   * Starts a cast: computes the actual mana reservation (Alpha 0.1 §D6 —
   * `0` if a Still Waters charge is armed, else `effectiveManaCost`, which
   * folds in any active Frenzied Liturgy window), reserves it, and pushes
   * `castStarted` (and, if a free-heal charge was just consumed,
   * `cooldownBuffEnded`) onto `out`. Mana is reserved (debited) the instant a
   * cast starts, not on completion (Phase 3 handoff §D — supersedes the old
   * "spent on completion" rule); this blocks double-spending mana on a cast
   * that's still in flight.
   */
  private beginCast(spellId: string, targetId: string, out: CombatEvent[]): void {
    const spell = this.spellById(spellId)!;
    const healer = this.getUnit('healer')!;
    // Free-heal charges only apply to heal casts — Bonk / damage never consume them.
    const freeHealCd = (spell.damage ?? 0) > 0 ? undefined : this.findArmedFreeHealCooldown();
    let reservedMana: number;
    if (freeHealCd) {
      reservedMana = 0;
      // Consumed at cast START whether the cast later completes or is cancelled
      // (locked design — Alpha 0.1 §D6): a cancelled free cast never refunds
      // anything, because nothing was ever reserved.
      freeHealCd.armed = false;
    } else {
      reservedMana = this.effectiveManaCost(spell);
    }
    healer.mana = Math.max(0, healer.mana - reservedMana);
    this.playerCast = { spellId, targetId, remainingMs: spell.castMs, totalMs: spell.castMs };
    this.playerCastReservedMana = reservedMana;
    this.gcdRemainingMs = GCD_MS;
    out.push({ type: 'castStarted', cast: { ...this.playerCast } });
    if (freeHealCd) out.push({ type: 'cooldownBuffEnded', id: freeHealCd.def.id });
    // Alpha 0.2 §D4: castMs === 0 is a true instant — heal resolves in this same
    // call (no cast-bar occupancy). GCD still runs from cast start.
    if (spell.castMs === 0) {
      this.completePlayerCast(out);
    }
  }

  /** Refunds the active cast's reserved mana (escape/target-dead cancel). Symmetric with beginCast's debit. */
  private refundCastMana(): void {
    const healer = this.getUnit('healer');
    if (healer) healer.mana = Math.min(healer.maxMana, healer.mana + this.playerCastReservedMana);
  }

  /** If the active player cast targets `unitId`, auto-cancel it (mid-cast target death). */
  private cancelCastIfTargeting(unitId: string, events: CombatEvent[]): void {
    if (!this.playerCast || this.playerCast.targetId !== unitId) return;
    const spellId = this.playerCast.spellId;
    this.refundCastMana();
    this.playerCast = null;
    events.push({ type: 'castCancelled', spellId, reason: 'target-dead' });
  }

  private completePlayerCast(events: CombatEvent[]): void {
    const cast = this.playerCast!;
    this.playerCast = null;
    const spell = this.spellById(cast.spellId)!;
    // Mana was already reserved/debited at cast start — do not subtract again.
    events.push({ type: 'castFinished', spellId: cast.spellId });

    const target = this.getUnit(cast.targetId);

    // Damage spells (Bonk): hit the locked enemy target; no heal / synergy pipeline.
    if ((spell.damage ?? 0) > 0) {
      if (target && target.alive) {
        this.applyDamageToUnit(target, spell.damage!, 'healer', events);
      }
      return;
    }

    // Phase 3 (handoff §D): a cast whose target dies mid-cast is auto-cancelled
    // (cancelCastIfTargeting) the instant that death is applied, so a cast only
    // ever reaches completion here with a still-alive target. The `target.alive`
    // checks below are a defensive invariant guard, not live behavior.
    //
    // Consume-then-arm (locked order, phase-2-handoff): a spell that is both a
    // trigger and a buffed target consumes any already-armed bonus for itself
    // first, then arms fresh from this same completed cast.
    let synergyBonus = 0;
    if (target && target.alive) {
      for (const syn of this.synergies) {
        if (syn.buffedSpellId === spell.id && syn.armed) {
          synergyBonus += syn.bonusHeal;
          syn.armed = false;
        }
      }
    }
    // Re-arming replaces (boolean flag), never stacks.
    for (const syn of this.synergies) {
      if (syn.triggerSpellId === spell.id) syn.armed = true;
    }

    if (target && target.alive) {
      const missing = Math.max(0, target.maxHp - target.hp);
      // Full 10% bands of missing HP, on the target's hp BEFORE this heal lands —
      // shared by the flat and pct missing-health rules below.
      const bands = Math.floor((missing * 10) / target.maxHp);
      let missingHealthBonus = 0;
      for (const mh of this.missingHealthBonuses) {
        if (mh.spellId === spell.id) {
          missingHealthBonus += mh.healPer10PctMissing * bands;
        }
      }
      // Chunk 4 (alpha-0.1 §D4 Graven Scale): percent-of-base-heal per band, rounded
      // up. Always computed from spell.heal — never from synergy-buffed totals.
      let missingHealthPctBonus = 0;
      for (const mp of this.missingHealthPctBonuses) {
        if (mp.spellId === spell.id) {
          missingHealthPctBonus += Math.ceil((spell.heal * mp.pctPer10PctMissing * bands) / 100);
        }
      }
      // Chunk 4 (alpha-0.1 §D4 Steady Hands): +bonusHeal when the target's pre-heal
      // HP is at least hpPctAtLeast% of maxHp. Integer-safe inclusive threshold.
      let fullHealthBonus = 0;
      for (const fh of this.fullHealthBonuses) {
        if (fh.spellId === spell.id && target.hp * 100 >= fh.hpPctAtLeast * target.maxHp) {
          fullHealthBonus += fh.bonusHeal;
        }
      }
      // Alpha 0.2 §D6 healBonus: after synergy / missing / full-health / relic
      // bonusHealing; multiple open healBonus windows sum.
      let healBonus = 0;
      for (const cd of this.cooldowns) {
        if (cd.def.effect.kind === 'healBonus' && cd.buffRemainingMs > 0) {
          healBonus += cd.def.effect.bonusHeal;
        }
      }
      const raw =
        spell.heal +
        synergyBonus +
        missingHealthBonus +
        missingHealthPctBonus +
        fullHealthBonus +
        this.relicStats.bonusHealing +
        healBonus;
      const applied = Math.min(raw, missing);
      const overheal = raw - applied;
      target.hp += applied;
      events.push({ type: 'heal', targetId: target.id, amount: applied, overheal, spellId: spell.id });
    }
  }

  private fireQueuedCast(events: CombatEvent[]): void {
    if (!this.queuedCast) return;
    const { spellId, targetId } = this.queuedCast;
    this.queuedCast = null;
    const spell = this.spellById(spellId);
    const target = this.getUnit(targetId);
    if (!spell || !target || !target.alive) return;
    // A queued cast that fires while a Still Waters charge is armed counts as
    // "the first cast started" (Alpha 0.1 §D6) — same bypass as castSpell.
    // Damage spells never use the free-heal charge.
    const isDamage = (spell.damage ?? 0) > 0;
    if (!isDamage && this.findArmedFreeHealCooldown()) {
      // free heal — skip mana gate
    } else {
      const healer = this.getUnit('healer')!;
      if (healer.mana < this.effectiveManaCost(spell)) return;
    }
    this.beginCast(spellId, targetId, events);
  }

  // ---- internal: auto-attacks -----------------------------------------------------

  private resolveMercSwing(mercId: string, events: CombatEvent[]): void {
    const merc = this.getUnit(mercId);
    if (!merc || !merc.alive) return;
    const target = this.activeEnemies.find((e) => e.alive);
    if (!target) return;
    const role = merc.role === 'tank' ? 'tank' : 'dps';
    const baseDamage = role === 'tank' ? MERCS.tankAutoDamage : MERCS.dpsAutoDamage;
    const dmg = baseDamage + this.relicStats.autoDamage[role];
    this.applyDamageToUnit(target, dmg, merc.id, events);
  }

  private resolveEnemySwing(enemyId: string, events: CombatEvent[]): void {
    const enemy = this.getUnit(enemyId);
    if (!enemy || !enemy.alive) return;
    const target = this.pickAllyTarget();
    if (!target) return;
    this.applyDamageToUnit(target, this.enemyStatsFor(enemy.id).autoDamage, enemy.id, events);
  }

  /** Locked micro-choice (poc-spec §10.4): enemies/boss auto-attack the tank only; DPS then healer once the tank is dead. */
  private pickAllyTarget(): Unit | null {
    const tank = this.getUnit('tank');
    if (tank && tank.alive) return tank;
    const dps = this.party.find((u) => u.role === 'dps' && u.alive);
    if (dps) return dps;
    const healer = this.getUnit('healer');
    if (healer && healer.alive) return healer;
    return null;
  }

  private mercSwingInterval(role: 'tank' | 'dps'): number {
    const base = role === 'tank' ? MERCS.tankSwingIntervalMs : MERCS.dpsSwingIntervalMs;
    return Math.max(100, base + this.relicStats.swingIntervalDeltaMs[role]);
  }

  private damageAfterArmor(target: Unit, amount: number): number {
    if (target.role !== 'tank' && target.role !== 'dps' && target.role !== 'healer') return amount;
    return Math.max(1, amount - this.relicStats.armor[target.role]);
  }

  private applyDamageToUnit(target: Unit, amount: number, sourceId: string, events: CombatEvent[]): void {
    const applied = this.damageAfterArmor(target, amount);
    target.hp = Math.max(0, target.hp - applied);
    events.push({ type: 'damage', targetId: target.id, amount: applied, sourceId });
    if (target.hp <= 0 && target.alive) {
      if (target.role === 'enemy' || target.role === 'boss') {
        this.onEnemyDeath(target, events);
      } else {
        target.alive = false;
        this.swingTimers.delete(target.id);
        events.push({ type: 'unitDied', unitId: target.id });
        // Same tick the death is applied: auto-cancel an active cast targeting this unit.
        this.cancelCastIfTargeting(target.id, events);
        this.checkWipe(events);
      }
    }
  }

  // ---- internal: boss cast ----------------------------------------------------------

  private startBossCast(events: CombatEvent[]): void {
    const castDef = this.encounter.boss.cast;
    if (!castDef || !this.boss || !this.boss.alive) return;
    if (castDef.kind === 'tunnelVision') {
      this.bossCastState = { name: castDef.name, remainingMs: castDef.telegraphMs, totalMs: castDef.telegraphMs };
      // Start-to-start cadence (D3/D8): reset the interval timer now, right at
      // telegraph start, so it keeps counting through both the telegraph and
      // the channel. Step 7's `bossFocusState === null` guard stops a new
      // telegraph from starting while the channel is still active — if the
      // interval elapses first (this goes <= 0) it just waits and fires the
      // instant the channel ends (the "next boundary after it ends").
      this.bossCastTimerRemainingMs = castDef.intervalMs;
    } else {
      // partyAoE / partyDoT / manaSiphon: cast-bar occupancy is castMs only.
      this.bossCastState = { name: castDef.name, remainingMs: castDef.castMs, totalMs: castDef.castMs };
      this.bossCastTimerRemainingMs = null;
    }
    events.push({ type: 'bossCastStarted', cast: { ...this.bossCastState } });
  }

  private completeBossCast(events: CombatEvent[]): void {
    const cast = this.bossCastState!;
    const castDef = this.encounter.boss.cast!;
    this.bossCastState = null;
    events.push({ type: 'bossCastFinished', name: cast.name });

    if (castDef.kind === 'tunnelVision') {
      // Telegraph finished -> channel begins. The start-to-start cadence
      // timer is already running (set in startBossCast), so nothing to
      // reschedule here.
      this.startBossFocus(castDef, events);
      return;
    }

    if (castDef.kind === 'partyDoT') {
      this.startPartyDoT(castDef, events);
      if (this.status === 'running') {
        this.bossCastTimerRemainingMs = castDef.intervalMs - castDef.castMs;
      }
      return;
    }

    const partyDamage = castDef.partyDamage;
    const bossId = this.boss!.id;
    for (const unit of this.party) {
      if (!unit.alive) continue;
      const damage = this.damageAfterArmor(unit, partyDamage);
      unit.hp = Math.max(0, unit.hp - damage);
      events.push({ type: 'damage', targetId: unit.id, amount: damage, sourceId: bossId });
      if (unit.hp <= 0) {
        unit.alive = false;
        this.swingTimers.delete(unit.id);
        events.push({ type: 'unitDied', unitId: unit.id });
        // Same tick the death is applied: auto-cancel an active cast targeting this unit.
        this.cancelCastIfTargeting(unit.id, events);
      }
    }
    if (castDef.kind === 'manaSiphon' && this.status === 'running') {
      const healer = this.getUnit('healer');
      if (healer && healer.alive && castDef.manaBurn > 0) {
        const burned = Math.min(healer.mana, castDef.manaBurn);
        healer.mana -= burned;
        if (burned > 0) events.push({ type: 'manaBurned', amount: burned });
      }
    }
    this.checkWipe(events);
    if (this.status === 'running') {
      // Start-to-start cadence: the gap before the next cast is intervalMs - castMs.
      this.bossCastTimerRemainingMs = castDef.intervalMs - castDef.castMs;
    }
  }

  private startPartyDoT(castDef: PartyDoTCastDef, events: CombatEvent[]): void {
    // A refreshed Emberfall replaces any previous DoT window (no stacking).
    this.partyDoTState = {
      name: castDef.name,
      remainingMs: castDef.durationMs,
      tickRemainingMs: castDef.tickMs,
      tickMs: castDef.tickMs,
      damagePerTick: castDef.damagePerTick,
    };
    events.push({ type: 'partyDoTStarted', name: castDef.name, totalMs: castDef.durationMs });
  }

  private resolvePartyDoTTick(events: CombatEvent[]): void {
    const dot = this.partyDoTState!;
    const bossId = this.boss!.id;
    for (const unit of [...this.party]) {
      if (this.status !== 'running') break;
      if (!unit.alive) continue;
      this.applyDamageToUnit(unit, dot.damagePerTick, bossId, events);
    }
    if (dot.remainingMs <= 0 || this.status !== 'running') {
      this.partyDoTState = null;
      events.push({ type: 'partyDoTEnded', name: dot.name });
      return;
    }
    dot.tickRemainingMs = dot.tickMs;
  }

  /**
   * Begin a Tunnel Vision channel right after its telegraph completes.
   * Deterministic target selection (D3/D8, no Math.random): eligible = living
   * party members with role !== 'tank', sorted by stable unit id;
   * eligible[focusIndex % eligible.length], then focusIndex increments once
   * per activation.
   */
  private startBossFocus(castDef: TunnelVisionCastDef, events: CombatEvent[]): void {
    const eligible = this.party
      .filter((u) => u.alive && u.role !== 'tank')
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (eligible.length === 0) {
      // No valid focus target (every non-tank party member is dead) -- skip
      // this activation; the next telegraph is still governed by the
      // already-running cadence timer.
      return;
    }
    const target = eligible[this.focusIndex % eligible.length]!;
    this.focusIndex += 1;
    this.bossFocusState = {
      targetId: target.id,
      name: castDef.name,
      remainingMs: castDef.channelMs,
      tickRemainingMs: castDef.tickMs,
      tickMs: castDef.tickMs,
      damagePerTick: castDef.damagePerTick,
    };
    events.push({ type: 'bossFocusStarted', targetId: target.id, name: castDef.name, totalMs: castDef.channelMs });
  }

  /**
   * Resolve one Tunnel Vision damage tick: damage goes through the same
   * pipeline as any other damage (applyDamageToUnit -> normal `damage` event,
   * `unitDied` + wipe-check on death), then `bossFocusTick` is emitted after.
   * The channel ends (bossFocusEnded) either when the target dies mid-channel
   * (early end, no retarget) or after its final tick.
   */
  private resolveBossFocusTick(events: CombatEvent[]): void {
    const focus = this.bossFocusState!;
    const target = this.getUnit(focus.targetId);
    if (target && target.alive) {
      this.applyDamageToUnit(target, focus.damagePerTick, this.boss!.id, events);
      events.push({ type: 'bossFocusTick', targetId: focus.targetId, amount: focus.damagePerTick });
    }

    const after = this.getUnit(focus.targetId);
    if (!after || !after.alive) {
      // Focus target died mid-channel: end early, no retarget.
      this.bossFocusState = null;
      events.push({ type: 'bossFocusEnded', targetId: focus.targetId, name: focus.name });
      return;
    }
    if (focus.remainingMs <= 0) {
      this.bossFocusState = null;
      events.push({ type: 'bossFocusEnded', targetId: focus.targetId, name: focus.name });
      return;
    }
    focus.tickRemainingMs = focus.tickMs;
  }

  // ---- internal: wave/encounter progression -------------------------------------------

  private spawnWave(index: number): void {
    const wave = this.encounter.waves[index];
    if (!wave) return;
    const enemies: Unit[] = [];
    wave.enemies.forEach((group, gi) => {
      for (let i = 0; i < group.count; i++) {
        const id = `w${index}-${gi}-${i}`;
        const unit: Unit = {
          id,
          ...(group.mobId === undefined ? {} : { mobId: group.mobId }),
          name: group.name,
          role: 'enemy',
          hp: group.hp,
          maxHp: group.hp,
          mana: 0,
          maxMana: 0,
          alive: true,
        };
        const stats = {
          autoDamage: group.autoDamage ?? TRASH.autoDamage,
          swingIntervalMs: group.swingIntervalMs ?? TRASH.swingIntervalMs,
        };
        enemies.push(unit);
        this.enemyStats.set(id, stats);
        this.swingTimers.set(id, stats.swingIntervalMs);
      }
    });
    this.activeEnemies = enemies;
  }

  private spawnBoss(): void {
    const b = this.encounter.boss;
    const boss: Unit = {
      id: b.id,
      mobId: b.id,
      name: b.name,
      role: 'boss',
      hp: b.hp,
      maxHp: b.hp,
      mana: 0,
      maxMana: 0,
      alive: true,
    };
    this.boss = boss;
    this.activeEnemies = [boss];
    this.enemyStats.set(b.id, {
      autoDamage: b.autoDamage,
      swingIntervalMs: b.swingIntervalMs,
    });
    this.swingTimers.set(b.id, b.swingIntervalMs);
    if (b.cast) this.bossCastTimerRemainingMs = b.cast.firstCastAtMs;
  }

  private onEnemyDeath(unit: Unit, events: CombatEvent[]): void {
    unit.alive = false;
    unit.hp = 0;
    this.swingTimers.delete(unit.id);
    this.enemyStats.delete(unit.id);
    events.push({ type: 'unitDied', unitId: unit.id });
    this.rewardsXp += this.encounter.xpPerEnemy ?? REWARDS.xpPerEnemy;
    this.checkWaveOrVictory(events);
  }

  private checkWaveOrVictory(events: CombatEvent[]): void {
    if (this.status !== 'running') return;
    if (this.boss) {
      if (!this.boss.alive) {
        this.status = 'victory';
        events.push({ type: 'combatEnded', status: 'victory' });
      }
      return;
    }
    if (this.activeEnemies.every((e) => !e.alive)) {
      const nextIndex = this.waveIndex + 1;
      if (nextIndex < this.encounter.waves.length) {
        this.waveIndex = nextIndex;
        this.spawnWave(nextIndex);
      } else {
        this.waveIndex = this.encounter.waves.length;
        this.spawnBoss();
      }
      events.push({ type: 'waveStarted', waveIndex: this.waveIndex });
    }
  }

  private checkWipe(events: CombatEvent[]): void {
    if (this.status !== 'running') return;
    if (this.party.every((u) => !u.alive)) {
      this.status = 'wipe';
      events.push({ type: 'combatEnded', status: 'wipe' });
    }
  }

  // ---- internal: lookups -------------------------------------------------------------

  private getUnit(id: string): Unit | undefined {
    return this.party.find((u) => u.id === id) ?? this.activeEnemies.find((u) => u.id === id);
  }

  private spellById(id: string): SpellDef | undefined {
    return this.spells.find((s) => s.id === id);
  }

  /** First armed freeNextHeal cooldown, if any (Alpha 0.1 §D6 Still Waters) — consumed at cast start. */
  private findArmedFreeHealCooldown(): CooldownRuntime | undefined {
    return this.cooldowns.find((cd) => cd.def.effect.kind === 'freeNextHeal' && cd.armed);
  }

  /**
   * Spell's mana cost after any active manaCostReduction buff windows (Alpha
   * 0.1 §D6 Frenzied Liturgy), summed across cooldowns and floored at 0. Does
   * not consider freeNextHeal — callers check `findArmedFreeHealCooldown`
   * first, since a free charge always wins over a cost-reduction window.
   */
  private effectiveManaCost(spell: SpellDef): number {
    let reduction = 0;
    for (const cd of this.cooldowns) {
      if (cd.def.effect.kind === 'manaCostReduction' && cd.buffRemainingMs > 0) {
        reduction += cd.def.effect.costReduction;
      }
    }
    return Math.max(0, spell.mana - reduction);
  }

  private enemyStatsFor(id: string): { autoDamage: number; swingIntervalMs: number } {
    const stats = this.enemyStats.get(id);
    if (stats === undefined) throw new Error(`Missing combat stats for enemy "${id}"`);
    return stats;
  }
}
