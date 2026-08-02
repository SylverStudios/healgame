/**
 * Level-sweep harness: find the lowest player level at which the basic and
 * god-gamer bots clear each dungeon. God gets one bias-adjusted retry per
 * level before leveling up.
 */

import type { EncounterDef } from '../combat/types';
import { ORDERED_DUNGEONS } from '../data/dungeons';
import { getEncounterById } from '../data/encounters';
import { createBasicPlayer } from './basicPlayer';
import { biasAfterWipe, createGodPlayer } from './godPlayer';
import { PLAYTEST_DEFAULT_SEED, runHeadless } from './headless';
import { kitAtLevel } from './kit';
import { createSeededRng } from './rng';
import type { DungeonPlaytestResult, PlaytestLevelRange, SpellBias } from './types';

export const PLAYTEST_MAX_LEVEL = 20;
export const PLAYTEST_MIN_LEVEL = 1;

export interface SweepOptions {
  minLevel?: number;
  maxLevel?: number;
  seed?: number;
  /** Limit to these dungeon ids (default: all ordered dungeons). */
  dungeonIds?: readonly string[];
}

function cleared(status: string): boolean {
  return status === 'victory';
}

/** Lowest level at which the basic bot clears `encounter`, or null. */
export function findBasicClearLevel(
  encounter: EncounterDef,
  opts: { minLevel?: number; maxLevel?: number; seed?: number } = {},
): number | null {
  const min = opts.minLevel ?? PLAYTEST_MIN_LEVEL;
  const max = opts.maxLevel ?? PLAYTEST_MAX_LEVEL;
  const seed = opts.seed ?? PLAYTEST_DEFAULT_SEED;

  for (let level = min; level <= max; level++) {
    const loadout = kitAtLevel(level, 'basic');
    const player = createBasicPlayer(loadout.spells);
    const run = runHeadless(encounter, player, {
      loadout,
      random: createSeededRng(seed + level * 17),
    });
    if (cleared(run.status)) return level;
  }
  return null;
}

/**
 * Lowest level at which the god-gamer clears. At each level: try once with no
 * bias; on wipe, retry once with throughput/efficiency bias from mana left;
 * still failing → level up.
 */
export function findGodClearLevel(
  encounter: EncounterDef,
  opts: { minLevel?: number; maxLevel?: number; seed?: number } = {},
): number | null {
  const min = opts.minLevel ?? PLAYTEST_MIN_LEVEL;
  const max = opts.maxLevel ?? PLAYTEST_MAX_LEVEL;
  const seed = opts.seed ?? PLAYTEST_DEFAULT_SEED;

  for (let level = min; level <= max; level++) {
    const loadout = kitAtLevel(level, 'god');
    let bias: SpellBias = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      const player = createGodPlayer(loadout);
      const run = runHeadless(encounter, player, {
        loadout,
        bias,
        random: createSeededRng(seed + level * 31 + attempt),
      });
      if (cleared(run.status)) return level;
      if (attempt === 0) {
        bias = biasAfterWipe(run.healerManaLeft);
      }
    }
  }
  return null;
}

/** Sweep every ordered dungeon (or a subset) for both bot profiles. */
export function sweepPlaytestCurve(opts: SweepOptions = {}): DungeonPlaytestResult[] {
  const ids = opts.dungeonIds ?? ORDERED_DUNGEONS.map((d) => d.id);
  const results: DungeonPlaytestResult[] = [];

  for (const id of ids) {
    const dungeon = ORDERED_DUNGEONS.find((d) => d.id === id);
    const encounter = getEncounterById(id);
    if (dungeon === undefined || encounter === undefined) {
      throw new Error(`Unknown dungeon for playtest sweep: "${id}"`);
    }
    const godLevel = findGodClearLevel(encounter, opts);
    const basicLevel = findBasicClearLevel(encounter, opts);
    results.push({
      dungeonId: id,
      dungeonName: dungeon.name,
      godLevel,
      basicLevel,
    });
  }
  return results;
}

/** Convert a sweep row into dungeon metadata (null if either bot never cleared). */
export function toPlaytestLevelRange(result: DungeonPlaytestResult): PlaytestLevelRange | null {
  if (result.godLevel === null || result.basicLevel === null) return null;
  return { god: result.godLevel, basic: result.basicLevel };
}

/**
 * Hub copy: difficulty band from the two clear levels (low–high).
 * Equal levels collapse to `Lv N`. Stored metadata keeps god/basic distinct.
 */
export function formatPlaytestLevelRange(range: PlaytestLevelRange | null | undefined): string {
  if (range === null || range === undefined) return '';
  const low = Math.min(range.god, range.basic);
  const high = Math.max(range.god, range.basic);
  if (low === high) return `Lv ${low}`;
  return `Lv ${low}–${high}`;
}
