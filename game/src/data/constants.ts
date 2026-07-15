/**
 * Draft numbers from poc-spec §4.2 — tunable, all integers, keep roughly 1–10.
 * poc-spec.md wins any conflict.
 */

export const GCD_MS = 1000;

export const PARTY = {
  tankMaxHp: 20,
  dpsMaxHp: 10,
  healerMaxHp: 15,
  startingMana: 20,
  /** Harsh: no mana regen in combat for the first dungeon. */
  manaRegenPer5s: 0,
} as const;

export const TRASH = {
  autoDamage: 1,
  swingIntervalMs: 3000,
} as const;

/** Enemy stats and mechanics live in data/mobs/, enemyAbilities/, and dungeons/. */

/**
 * Mercs (tank + 2 DPS) auto-attack only (poc-spec §2 row 10). Draft damage,
 * tunable. Phase 3 (handoff §B): per-role swing intervals (no phase offsets)
 * so simultaneous merc swings are rare — tank is slow or hard-hitting, DPS
 * swing faster for less.
 */
export const MERCS = {
  tankAutoDamage: 1,
  dpsAutoDamage: 2,
  tankSwingIntervalMs: 2500,
  dpsSwingIntervalMs: 1000,
} as const;

export const SPELLS = {
  solemnMend: { id: 'solemn-mend', name: 'Solemn Mend', heal: 4, mana: 3, castMs: 2000 },
  zealousMending: { id: 'zealous-mending', name: 'Zealous Mending', heal: 4, mana: 4, castMs: 1000 },
  /** Vigil subclass spell (phase-2-handoff): slow, efficient. Granted by the vigil-oath tree node. */
  solemnVigil: { id: 'solemn-vigil', name: 'Solemn Vigil', heal: 6, mana: 5, castMs: 3000 },
  /** Zealot subclass spell (phase-2-handoff): fast, pricey per point. Granted by the zealot-oath tree node. */
  zealousFlare: { id: 'zealous-flare', name: 'Zealous Flare', heal: 2, mana: 2, castMs: 500 },
} as const;

export const REWARDS = {
  /** Every defeated enemy advances the account, including kills in a wipe. */
  xpPerEnemy: 1,
} as const;

/** Level 2 remains at 10 XP; later levels require 10, 20, 30… additional XP. */
export const XP_LEVEL_2_THRESHOLD = 10;

/** Total XP required to reach a level (level 1 starts at 0 XP). */
export function xpForLevel(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  return (XP_LEVEL_2_THRESHOLD * safeLevel * (safeLevel - 1)) / 2;
}

export function levelForXp(xp: number): number {
  const safeXp = Math.max(0, Math.floor(xp));
  let level = 1;
  while (xpForLevel(level + 1) <= safeXp) level += 1;
  return level;
}
