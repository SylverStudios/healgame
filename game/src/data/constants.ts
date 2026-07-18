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
} as const;

/**
 * Alpha 0.2 §D2 — level-derived combat mana. Applied via
 * `manaBonusesForLevel` → loadout → `CombatEngineOptions` (not player HoTs).
 */
export const LEVEL_MANA = {
  /** Max mana added per level above 1. */
  poolPerLevel: 3,
  /** Mana restored each regen tick once any regen ranks are owned. */
  regenAmountPerRank: 1,
  regenIntervalMs: 10_000,
  /** First regen rank at this level; +1 rank every `regenEveryLevels` after. */
  regenFirstLevel: 2,
  regenEveryLevels: 3,
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
  /**
   * Starter stick-bonk: 1 damage to the front enemy, true instant, GCD only.
   * Default Q-slot filler until the player replaces it on the action bar.
   */
  bonk: {
    id: 'bonk',
    name: 'Bonk',
    heal: 0,
    damage: 1,
    mana: 0,
    castMs: 0,
    glyph: '/',
    description: 'Stick poke. Free filler until you replace it on the bar.',
  },
  solemnMend: {
    id: 'solemn-mend',
    name: 'Solemn Mend',
    heal: 4,
    mana: 3,
    castMs: 2000,
    glyph: 'M',
    description: 'Efficient single-target mend. Prefer when the fight is calm.',
  },
  zealousMending: {
    id: 'zealous-mending',
    name: 'Zealous Mending',
    heal: 4,
    mana: 4,
    castMs: 1000,
    glyph: 'Z',
    description: 'Faster mend at a steeper mana cost.',
  },
  /** Vigil subclass spell (phase-2-handoff): slow, efficient. Granted by the vigil-oath tree node. */
  solemnVigil: {
    id: 'solemn-vigil',
    name: 'Solemn Vigil',
    heal: 6,
    mana: 5,
    castMs: 3000,
    glyph: 'G',
    description: 'Slow, efficient big heal — plan the cast.',
  },
  /** Zealot subclass spell (phase-2-handoff): fast, pricey per point. Granted by the zealot-oath tree node. */
  zealousFlare: {
    id: 'zealous-flare',
    name: 'Zealous Flare',
    heal: 2,
    mana: 2,
    castMs: 500,
    glyph: 'F',
    description: 'Fast, pricey per point. Panic button.',
  },
  /**
   * Virtue/light Vowstrike: strike the front enemy, then discount the next spell's
   * mana. Personal CD keeps it from being a filler spam button.
   */
  vowstrikeVirtue: {
    id: 'vowstrike-virtue',
    name: 'Vowstrike: Absolution',
    heal: 0,
    damage: 5,
    mana: 3,
    castMs: 0,
    cooldownMs: 10_000,
    castBuff: { kind: 'nextSpellManaReduction', amount: 2 },
    glyph: 'V',
    description: 'Strike, then discount your next spell.',
  },
  /**
   * Vengeance/dark Vowstrike: strike the front enemy, then empower the next heal
   * (+25% of base heal, rounded up).
   */
  vowstrikeVengeance: {
    id: 'vowstrike-vengeance',
    name: 'Vowstrike: Reckoning',
    heal: 0,
    damage: 5,
    mana: 3,
    castMs: 0,
    cooldownMs: 10_000,
    castBuff: { kind: 'nextHealPotencyPct', pct: 25 },
    glyph: 'X',
    description: 'Strike, then empower your next heal.',
  },
} as const;

/** QWER spell slots; Shift+QWER is reserved for major CD finger columns. */
export const ACTION_BAR_SLOTS = 4;

export const REWARDS = {
  /**
   * Fallback XP per kill when an encounter omits `xpPerEnemy`.
   * Live dungeons set their own rate (Ash Gate 1 → Iron Pass/Cinder 2 →
   * Verdant/Choir 3 → Maw 4) so later content funds the rising level curve.
   */
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
