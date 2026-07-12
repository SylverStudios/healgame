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
  EncounterDef,
  FullHealthBonusRule,
  MissingHealthBonusRule,
  MissingHealthPctBonusRule,
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

export class CombatEngine {
  private readonly encounter: EncounterDef;
  private readonly spells: SpellDef[];

  /** Synergy rules with mutable per-entry armed state (constructor-cloned; never shared with the caller). */
  private readonly synergies: (SynergyRule & { armed: boolean })[];
  private readonly missingHealthBonuses: MissingHealthBonusRule[];
  private readonly missingHealthPctBonuses: MissingHealthPctBonusRule[];
  private readonly fullHealthBonuses: FullHealthBonusRule[];

  private party: Unit[] = [];
  private activeEnemies: Unit[] = [];
  private boss: Unit | null = null;

  /** Countdown timers for every unit with an auto-attack (mercs + enemies/boss). Entry removed on death. */
  private readonly swingTimers = new Map<string, number>();

  private playerCast: CastState | null = null;
  private queuedCast: { spellId: string; targetId: string } | null = null;
  private gcdRemainingMs = 0;
  private targetId: string | null = null;

  private bossCastState: BossCastState | null = null;
  /** Countdown to the next boss cast start; null while a party-AoE cast is active or the boss has no cast. */
  private bossCastTimerRemainingMs: number | null = null;

  /** Active Tunnel Vision channel (telegraph already finished); null otherwise. */
  private bossFocusState: BossFocusState | null = null;
  /** Deterministic round-robin cursor into the eligible (non-tank, living) focus targets; never Math.random. */
  private focusIndex = 0;

  /** Per-trash-unit swing stats (EnemyGroupDef overrides resolved at spawn; TRASH fallback). */
  private trashStats = new Map<string, { autoDamage: number; swingIntervalMs: number }>();

  private waveIndex = 0;
  private status: CombatStatus = 'running';

  private rewardsGold = 0;
  private rewardsXp = 0;

  /** Events produced synchronously by commands (castSpell), flushed on the next advance(). */
  private pending: CombatEvent[] = [];

  constructor(encounter: EncounterDef, spells: SpellDef[], options?: CombatEngineOptions) {
    this.encounter = encounter;
    this.spells = spells;

    // Authorized Chunk 3 extension: a spell-tree node (e.g. Deep Reserves) can grant
    // the healer bonus max mana, applied to both max and starting mana here.
    const healerMana = PARTY.startingMana + (options?.bonusMaxMana ?? 0);

    // Chunk 1 (phase-2-handoff): synergy + missing-health bonus rules, cloned so the
    // engine's mutable `armed` state never touches the caller's arrays.
    this.synergies = (options?.synergies ?? []).map((s) => ({ ...s, armed: false }));
    this.missingHealthBonuses = (options?.missingHealthBonuses ?? []).map((m) => ({ ...m }));
    // Chunk 4 (alpha-0.1 §D4): pct-of-base-heal missing-health rule (Graven Scale)
    // and full-health threshold rule (Steady Hands), cloned like the arrays above.
    this.missingHealthPctBonuses = (options?.missingHealthPctBonuses ?? []).map((m) => ({ ...m }));
    this.fullHealthBonuses = (options?.fullHealthBonuses ?? []).map((f) => ({ ...f }));

    this.party = [
      { id: 'tank', name: 'Tank', role: 'tank', hp: PARTY.tankMaxHp, maxHp: PARTY.tankMaxHp, mana: 0, maxMana: 0, alive: true },
      { id: 'dps1', name: 'DPS 1', role: 'dps', hp: PARTY.dpsMaxHp, maxHp: PARTY.dpsMaxHp, mana: 0, maxMana: 0, alive: true },
      { id: 'dps2', name: 'DPS 2', role: 'dps', hp: PARTY.dpsMaxHp, maxHp: PARTY.dpsMaxHp, mana: 0, maxMana: 0, alive: true },
      {
        id: 'healer',
        name: 'Healer',
        role: 'healer',
        hp: PARTY.healerMaxHp,
        maxHp: PARTY.healerMaxHp,
        mana: healerMana,
        maxMana: healerMana,
        alive: true,
      },
    ];
    for (const u of this.party) {
      if (u.role === 'tank') this.swingTimers.set(u.id, MERCS.tankSwingIntervalMs);
      else if (u.role === 'dps') this.swingTimers.set(u.id, MERCS.dpsSwingIntervalMs);
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
   * Cast (or queue) a spell on the current target. Silently ignored if illegal:
   * unknown spell, no/dead target, or insufficient mana. See README for full rules.
   */
  castSpell(spellId: string): void {
    if (this.status !== 'running') return;
    const spell = this.spellById(spellId);
    if (!spell) return;
    const targetId = this.targetId;
    if (!targetId) return;
    const target = this.party.find((u) => u.id === targetId);
    if (!target || !target.alive) return;

    const busy = this.playerCast !== null || this.gcdRemainingMs > 0;
    if (busy) {
      // Re-queue replaces; target locked in at queue time, re-validated when it fires.
      this.queuedCast = { spellId, targetId };
      return;
    }

    const healer = this.getUnit('healer')!;
    if (healer.mana < spell.mana) return;
    this.pending.push(this.beginCast(spellId, targetId));
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
      this.refundCastMana(spellId);
      this.playerCast = null;
      this.queuedCast = null;
      this.pending.push({ type: 'castCancelled', spellId, reason: 'escape' });
    } else if (this.queuedCast) {
      this.queuedCast = null;
    }
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
    };
  }

  get rewards(): { gold: number; xp: number } {
    return { gold: this.rewardsGold, xp: this.rewardsXp };
  }

  // ---- internal: time stepping -------------------------------------------------

  private nextTimerBoundary(): number {
    let min = Infinity;
    if (this.gcdRemainingMs > 0) min = Math.min(min, this.gcdRemainingMs);
    if (this.playerCast) min = Math.min(min, this.playerCast.remainingMs);
    for (const remaining of this.swingTimers.values()) min = Math.min(min, remaining);
    if (this.bossCastState) min = Math.min(min, this.bossCastState.remainingMs);
    if (this.bossCastTimerRemainingMs !== null) min = Math.min(min, this.bossCastTimerRemainingMs);
    if (this.bossFocusState) {
      min = Math.min(min, this.bossFocusState.remainingMs, this.bossFocusState.tickRemainingMs);
    }
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

    // 1. player cast completes
    if (this.playerCast && this.playerCast.remainingMs <= 0) {
      this.completePlayerCast(events);
    }
    // 2. GCD/cast busy window ends -> fire queued spell, if any
    if (this.gcdRemainingMs <= 0 && this.playerCast === null) {
      this.fireQueuedCast(events);
    }
    // 3. boss cast completes -> party-wide damage (partyAoE) or telegraph ends -> focus channel begins (tunnelVision)
    if (this.status === 'running' && this.bossCastState && this.bossCastState.remainingMs <= 0) {
      this.completeBossCast(events);
    }
    // 4. boss focus tick (Tunnel Vision channel damage)
    if (this.status === 'running' && this.bossFocusState && this.bossFocusState.tickRemainingMs <= 0) {
      this.resolveBossFocusTick(events);
    }
    // 5. merc auto-attacks
    if (this.status === 'running') {
      for (const id of ['tank', 'dps1', 'dps2']) {
        if (this.status !== 'running') break;
        const remaining = this.swingTimers.get(id);
        if (remaining === undefined || remaining > 0) continue;
        this.resolveMercSwing(id, events);
        if (this.swingTimers.has(id)) {
          const merc = this.party.find((u) => u.id === id);
          const interval = merc?.role === 'tank' ? MERCS.tankSwingIntervalMs : MERCS.dpsSwingIntervalMs;
          this.swingTimers.set(id, interval);
        }
      }
    }
    // 6. enemy/boss auto-attacks
    if (this.status === 'running') {
      for (const enemy of [...this.activeEnemies]) {
        if (this.status !== 'running') break;
        const remaining = this.swingTimers.get(enemy.id);
        if (remaining === undefined || remaining > 0) continue;
        this.resolveEnemySwing(enemy.id, events);
        if (this.swingTimers.has(enemy.id)) {
          const interval =
            enemy.role === 'boss'
              ? this.encounter.boss.swingIntervalMs
              : (this.trashStats.get(enemy.id)?.swingIntervalMs ?? TRASH.swingIntervalMs);
          this.swingTimers.set(enemy.id, interval);
        }
      }
    }
    // 7. boss cast timer elapses -> start a new telegraphed cast (blocked while a focus channel is active)
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

  private beginCast(spellId: string, targetId: string): CombatEvent {
    const spell = this.spellById(spellId)!;
    // Mana is reserved (debited) the instant a cast starts, not on completion
    // (Phase 3 handoff §D — supersedes the old "spent on completion" rule).
    // This blocks double-spending mana on a cast that's still in flight.
    const healer = this.getUnit('healer')!;
    healer.mana = Math.max(0, healer.mana - spell.mana);
    this.playerCast = { spellId, targetId, remainingMs: spell.castMs, totalMs: spell.castMs };
    this.gcdRemainingMs = GCD_MS;
    return { type: 'castStarted', cast: { ...this.playerCast } };
  }

  /** Refunds a cast's reserved mana (escape/target-dead cancel). Symmetric with beginCast's debit. */
  private refundCastMana(spellId: string): void {
    const spell = this.spellById(spellId);
    const healer = this.getUnit('healer');
    if (spell && healer) healer.mana = Math.min(healer.maxMana, healer.mana + spell.mana);
  }

  /** If the active player cast targets `unitId`, auto-cancel it (mid-cast target death). */
  private cancelCastIfTargeting(unitId: string, events: CombatEvent[]): void {
    if (!this.playerCast || this.playerCast.targetId !== unitId) return;
    const spellId = this.playerCast.spellId;
    this.refundCastMana(spellId);
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
      const raw = spell.heal + synergyBonus + missingHealthBonus + missingHealthPctBonus + fullHealthBonus;
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
    const healer = this.getUnit('healer')!;
    if (!spell || !target || !target.alive || healer.mana < spell.mana) return;
    events.push(this.beginCast(spellId, targetId));
  }

  // ---- internal: auto-attacks -----------------------------------------------------

  private resolveMercSwing(mercId: string, events: CombatEvent[]): void {
    const merc = this.getUnit(mercId);
    if (!merc || !merc.alive) return;
    const target = this.activeEnemies.find((e) => e.alive);
    if (!target) return;
    const dmg = merc.role === 'tank' ? MERCS.tankAutoDamage : MERCS.dpsAutoDamage;
    this.applyDamageToUnit(target, dmg, merc.id, events);
  }

  private resolveEnemySwing(enemyId: string, events: CombatEvent[]): void {
    const enemy = this.getUnit(enemyId);
    if (!enemy || !enemy.alive) return;
    const target = this.pickAllyTarget();
    if (!target) return;
    const dmg =
      enemy.role === 'boss'
        ? this.encounter.boss.autoDamage
        : (this.trashStats.get(enemy.id)?.autoDamage ?? TRASH.autoDamage);
    this.applyDamageToUnit(target, dmg, enemy.id, events);
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

  private applyDamageToUnit(target: Unit, amount: number, sourceId: string, events: CombatEvent[]): void {
    target.hp = Math.max(0, target.hp - amount);
    events.push({ type: 'damage', targetId: target.id, amount, sourceId });
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

    const bossId = this.boss!.id;
    for (const unit of this.party) {
      if (!unit.alive) continue;
      unit.hp = Math.max(0, unit.hp - castDef.partyDamage);
      events.push({ type: 'damage', targetId: unit.id, amount: castDef.partyDamage, sourceId: bossId });
      if (unit.hp <= 0) {
        unit.alive = false;
        this.swingTimers.delete(unit.id);
        events.push({ type: 'unitDied', unitId: unit.id });
        // Same tick the death is applied: auto-cancel an active cast targeting this unit.
        this.cancelCastIfTargeting(unit.id, events);
      }
    }
    this.checkWipe(events);
    if (this.status === 'running') {
      // Start-to-start cadence: the gap before the next cast is intervalMs - castMs.
      this.bossCastTimerRemainingMs = castDef.intervalMs - castDef.castMs;
    }
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
      const autoDamage = group.autoDamage ?? TRASH.autoDamage;
      const swingIntervalMs = group.swingIntervalMs ?? TRASH.swingIntervalMs;
      for (let i = 0; i < group.count; i++) {
        const id = `w${index}-${gi}-${i}`;
        const unit: Unit = { id, name: group.name, role: 'enemy', hp: group.hp, maxHp: group.hp, mana: 0, maxMana: 0, alive: true };
        enemies.push(unit);
        this.trashStats.set(id, { autoDamage, swingIntervalMs });
        this.swingTimers.set(id, swingIntervalMs);
      }
    });
    this.activeEnemies = enemies;
  }

  private spawnBoss(): void {
    const b = this.encounter.boss;
    const boss: Unit = { id: b.id, name: b.name, role: 'boss', hp: b.hp, maxHp: b.hp, mana: 0, maxMana: 0, alive: true };
    this.boss = boss;
    this.activeEnemies = [boss];
    this.swingTimers.set(b.id, b.swingIntervalMs);
    if (b.cast) this.bossCastTimerRemainingMs = b.cast.firstCastAtMs;
  }

  private onEnemyDeath(unit: Unit, events: CombatEvent[]): void {
    unit.alive = false;
    unit.hp = 0;
    this.swingTimers.delete(unit.id);
    events.push({ type: 'unitDied', unitId: unit.id });
    this.rewardsGold += REWARDS.goldPerEnemy;
    this.rewardsXp += REWARDS.xpPerEnemy;
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
}
