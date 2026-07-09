/**
 * Pure, deterministic combat simulation (poc-spec §4). No Phaser, no wall-clock
 * time, no randomness — driven entirely by explicit advance(dtMs) steps.
 *
 * See ./README.md for the rule decisions (mana-on-complete, queue semantics,
 * boss cast cadence, targeting priority) this implementation encodes.
 */

import { GCD_MS, MERCS, PARTY, REWARDS, TRASH } from '../data/constants';
import type {
  BossCastState,
  CastState,
  CombatEvent,
  CombatState,
  CombatStatus,
  EncounterDef,
  SpellDef,
  Unit,
} from './types';

export class CombatEngine {
  private readonly encounter: EncounterDef;
  private readonly spells: SpellDef[];

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
  /** Countdown to the next boss cast start; null while a cast is active or the boss has no cast. */
  private bossCastTimerRemainingMs: number | null = null;

  private waveIndex = 0;
  private status: CombatStatus = 'running';

  private rewardsGold = 0;
  private rewardsXp = 0;

  /** Events produced synchronously by commands (castSpell), flushed on the next advance(). */
  private pending: CombatEvent[] = [];

  constructor(encounter: EncounterDef, spells: SpellDef[]) {
    this.encounter = encounter;
    this.spells = spells;

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
        mana: PARTY.startingMana,
        maxMana: PARTY.startingMana,
        alive: true,
      },
    ];
    for (const u of this.party) {
      if (u.role === 'tank' || u.role === 'dps') this.swingTimers.set(u.id, MERCS.swingIntervalMs);
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
    return min;
  }

  /** Advance every active timer by `step` ms, then resolve anything that hit zero in a fixed priority order. */
  private tick(step: number, events: CombatEvent[]): void {
    if (this.playerCast) this.playerCast.remainingMs -= step;
    if (this.gcdRemainingMs > 0) this.gcdRemainingMs -= step;
    for (const [id, remaining] of this.swingTimers) this.swingTimers.set(id, remaining - step);
    if (this.bossCastState) this.bossCastState.remainingMs -= step;
    if (this.bossCastTimerRemainingMs !== null) this.bossCastTimerRemainingMs -= step;

    // 1. player cast completes
    if (this.playerCast && this.playerCast.remainingMs <= 0) {
      this.completePlayerCast(events);
    }
    // 2. GCD/cast busy window ends -> fire queued spell, if any
    if (this.gcdRemainingMs <= 0 && this.playerCast === null) {
      this.fireQueuedCast(events);
    }
    // 3. boss cast completes -> party-wide damage
    if (this.status === 'running' && this.bossCastState && this.bossCastState.remainingMs <= 0) {
      this.completeBossCast(events);
    }
    // 4. merc auto-attacks
    if (this.status === 'running') {
      for (const id of ['tank', 'dps1', 'dps2']) {
        if (this.status !== 'running') break;
        const remaining = this.swingTimers.get(id);
        if (remaining === undefined || remaining > 0) continue;
        this.resolveMercSwing(id, events);
        if (this.swingTimers.has(id)) this.swingTimers.set(id, MERCS.swingIntervalMs);
      }
    }
    // 5. enemy/boss auto-attacks
    if (this.status === 'running') {
      for (const enemy of [...this.activeEnemies]) {
        if (this.status !== 'running') break;
        const remaining = this.swingTimers.get(enemy.id);
        if (remaining === undefined || remaining > 0) continue;
        this.resolveEnemySwing(enemy.id, events);
        if (this.swingTimers.has(enemy.id)) {
          const interval = enemy.role === 'boss' ? this.encounter.boss.swingIntervalMs : TRASH.swingIntervalMs;
          this.swingTimers.set(enemy.id, interval);
        }
      }
    }
    // 6. boss cast timer elapses -> start a new telegraphed cast
    if (
      this.status === 'running' &&
      this.bossCastTimerRemainingMs !== null &&
      this.bossCastTimerRemainingMs <= 0 &&
      this.bossCastState === null
    ) {
      this.startBossCast(events);
    }
  }

  // ---- internal: player casting --------------------------------------------------

  private beginCast(spellId: string, targetId: string): CombatEvent {
    const spell = this.spellById(spellId)!;
    this.playerCast = { spellId, targetId, remainingMs: spell.castMs, totalMs: spell.castMs };
    this.gcdRemainingMs = GCD_MS;
    return { type: 'castStarted', cast: { ...this.playerCast } };
  }

  private completePlayerCast(events: CombatEvent[]): void {
    const cast = this.playerCast!;
    this.playerCast = null;
    const spell = this.spellById(cast.spellId)!;
    const healer = this.getUnit('healer')!;
    // Mana is spent when the cast completes (poc-spec doesn't specify; simplest rule — see README).
    healer.mana = Math.max(0, healer.mana - spell.mana);
    events.push({ type: 'castFinished', spellId: cast.spellId });

    const target = this.getUnit(cast.targetId);
    if (target && target.alive) {
      const missing = Math.max(0, target.maxHp - target.hp);
      const applied = Math.min(spell.heal, missing);
      const overheal = spell.heal - applied;
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
    const dmg = enemy.role === 'boss' ? this.encounter.boss.autoDamage : TRASH.autoDamage;
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
        this.checkWipe(events);
      }
    }
  }

  // ---- internal: boss cast ----------------------------------------------------------

  private startBossCast(events: CombatEvent[]): void {
    const castDef = this.encounter.boss.cast;
    if (!castDef || !this.boss || !this.boss.alive) return;
    this.bossCastState = { name: castDef.name, remainingMs: castDef.castMs, totalMs: castDef.castMs };
    this.bossCastTimerRemainingMs = null;
    events.push({ type: 'bossCastStarted', cast: { ...this.bossCastState } });
  }

  private completeBossCast(events: CombatEvent[]): void {
    const cast = this.bossCastState!;
    this.bossCastState = null;
    events.push({ type: 'bossCastFinished', name: cast.name });

    const castDef = this.encounter.boss.cast!;
    const bossId = this.boss!.id;
    for (const unit of this.party) {
      if (!unit.alive) continue;
      unit.hp = Math.max(0, unit.hp - castDef.partyDamage);
      events.push({ type: 'damage', targetId: unit.id, amount: castDef.partyDamage, sourceId: bossId });
      if (unit.hp <= 0) {
        unit.alive = false;
        this.swingTimers.delete(unit.id);
        events.push({ type: 'unitDied', unitId: unit.id });
      }
    }
    this.checkWipe(events);
    if (this.status === 'running') {
      // Start-to-start cadence: the gap before the next cast is intervalMs - castMs.
      this.bossCastTimerRemainingMs = castDef.intervalMs - castDef.castMs;
    }
  }

  // ---- internal: wave/encounter progression -------------------------------------------

  private spawnWave(index: number): void {
    const wave = this.encounter.waves[index];
    if (!wave) return;
    const enemies: Unit[] = [];
    wave.enemies.forEach((group, gi) => {
      for (let i = 0; i < group.count; i++) {
        const id = `w${index}-${gi}-${i}`;
        const unit: Unit = { id, name: group.name, role: 'enemy', hp: group.hp, maxHp: group.hp, mana: 0, maxMana: 0, alive: true };
        enemies.push(unit);
        this.swingTimers.set(id, TRASH.swingIntervalMs);
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
