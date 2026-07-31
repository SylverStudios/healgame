import type { CombatEngine } from '../combat/engine';
import type { CombatMods } from '../data/talentTree';

/** After a wipe: mana left ⇒ need more heal output; OOM ⇒ need more efficiency. */
export type SpellBias = 'throughput' | 'efficiency' | null;

export interface PlaytestContext {
  elapsedMs: number;
  /** God-gamer preference after a failed attempt; ignored by basic. */
  bias: SpellBias;
  /** Injected RNG (seeded in the harness). */
  random: () => number;
}

/**
 * Rule-based player. Called every sim step before `advance`. May call
 * `setTarget` / `castSpell` / `activateCooldown` on the engine.
 */
export interface PlaytestPlayer {
  act(engine: CombatEngine, ctx: PlaytestContext): void;
}

export interface PlaytestRunResult {
  status: 'victory' | 'wipe' | 'timeout';
  elapsedMs: number;
  healerManaLeft: number;
  survivors: number;
  healsCast: number;
  overhealTotal: number;
}

export interface PlaytestRunOptions {
  /** Sim step size. Smaller = finer decisions; larger = faster wall-clock. */
  stepMs?: number;
  /** Cap; unresolved fights become `timeout` (treated as wipe for sweeps). */
  maxMs?: number;
  bias?: SpellBias;
  random?: () => number;
  loadout: CombatMods;
}

/** First clear level for each bot profile, or null if never cleared in the sweep. */
export interface PlaytestLevelRange {
  god: number;
  basic: number;
}

export interface DungeonPlaytestResult {
  dungeonId: string;
  dungeonName: string;
  godLevel: number | null;
  basicLevel: number | null;
}
