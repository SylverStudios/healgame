/**
 * Engine-agnostic combat types (poc-spec §4). No Phaser imports here — Chunk 2
 * builds the view against exactly this surface.
 */

export type UnitRole = 'tank' | 'dps' | 'healer' | 'enemy' | 'boss';

export interface Unit {
  id: string;
  name: string;
  role: UnitRole;
  hp: number;
  maxHp: number;
  /** 0/0 for non-healers (mercs, enemies). */
  mana: number;
  maxMana: number;
  alive: boolean;
}

export interface SpellDef {
  id: string;
  name: string;
  heal: number;
  mana: number;
  castMs: number;
}

/**
 * A completed cast of `triggerSpellId` arms this rule; the next completed
 * cast of `buffedSpellId` consumes it, adding `bonusHeal` to that heal's raw
 * value (phase-2-handoff "Engine"). Structurally identical to
 * `Loadout['synergies'][number]` in meta/progression.ts — combat/ never
 * imports meta/, so this is redefined here.
 */
export interface SynergyRule {
  triggerSpellId: string;
  buffedSpellId: string;
  bonusHeal: number;
}

/**
 * On a completed cast of `spellId`, adds `healPer10PctMissing` per full 10%
 * of the target's HP missing (computed before the heal lands). Structurally
 * identical to `Loadout['missingHealthBonuses'][number]`.
 */
export interface MissingHealthBonusRule {
  spellId: string;
  healPer10PctMissing: number;
}

export interface CombatEngineOptions {
  /** Adds to the healer's max AND starting mana (e.g. Deep Reserves). */
  bonusMaxMana?: number;
  synergies?: SynergyRule[];
  missingHealthBonuses?: MissingHealthBonusRule[];
}

export interface CastState {
  spellId: string;
  targetId: string;
  remainingMs: number;
  totalMs: number;
}

export interface BossCastState {
  name: string;
  remainingMs: number;
  totalMs: number;
}

export type CombatStatus = 'running' | 'victory' | 'wipe';

export type CombatEvent =
  | { type: 'damage'; targetId: string; amount: number; sourceId: string }
  | { type: 'heal'; targetId: string; amount: number; overheal: number; spellId: string }
  | { type: 'castStarted'; cast: CastState }
  | { type: 'castFinished'; spellId: string }
  | { type: 'castCancelled'; spellId: string; reason: 'escape' | 'target-dead' }
  | { type: 'bossCastStarted'; cast: BossCastState }
  | { type: 'bossCastFinished'; name: string }
  | { type: 'unitDied'; unitId: string }
  | { type: 'waveStarted'; waveIndex: number }
  | { type: 'combatEnded'; status: CombatStatus };

export interface CombatState {
  party: Unit[];
  /** Live (and just-died-this-tick) units of the current wave, or the boss once spawned. */
  enemies: Unit[];
  playerCast: CastState | null;
  bossCast: BossCastState | null;
  targetId: string | null;
  gcdRemainingMs: number;
  waveIndex: number;
  status: CombatStatus;
  /** Spell ids that currently have at least one armed synergy buffing them. */
  armedBuffedSpellIds: string[];
}

/** One group of identical trash enemies within a wave (poc-spec §7). */
export interface EnemyGroupDef {
  name: string;
  hp: number;
  count: number;
}

export interface WaveDef {
  enemies: EnemyGroupDef[];
}

/** Bonehowl-style named boss cast: telegraphed, hits every living party member on completion. */
export interface BossCastDef {
  name: string;
  castMs: number;
  /** Delay from boss-phase start to the first cast start. */
  firstCastAtMs: number;
  /** Cast-start-to-cast-start cadence; the gap between casts is intervalMs - castMs. */
  intervalMs: number;
  partyDamage: number;
}

export interface BossDef {
  id: string;
  name: string;
  hp: number;
  autoDamage: number;
  swingIntervalMs: number;
  cast?: BossCastDef;
}

export interface EncounterDef {
  id: string;
  name: string;
  waves: WaveDef[];
  boss: BossDef;
}
