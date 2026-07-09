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
