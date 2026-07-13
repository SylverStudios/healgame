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
  solemnMend: { id: 'solemn-mend', name: 'Solemn Mend', heal: 5, mana: 5, castMs: 2000 },
  zealousMending: { id: 'zealous-mending', name: 'Zealous Mending', heal: 6, mana: 6, castMs: 1000 },
  /** Vigil subclass spell (phase-2-handoff): slow, efficient. Granted by the vigil-oath tree node. */
  solemnVigil: { id: 'solemn-vigil', name: 'Solemn Vigil', heal: 9, mana: 7, castMs: 3000 },
  /** Zealot subclass spell (phase-2-handoff): fast, pricey per point. Granted by the zealot-oath tree node. */
  zealousFlare: { id: 'zealous-flare', name: 'Zealous Flare', heal: 3, mana: 4, castMs: 500 },
} as const;

export const REWARDS = {
  goldPerEnemy: 1,
  xpPerEnemy: 1,
  rubyPerFirstClear: 1,
  /**
   * Alpha 0.1 §D1: rubies stay Ash-Gate-only — an Iron Pass first clear
   * records the clear (unlocking The Maw) but grants no ruby.
   */
  rubyFirstClearDungeonIds: ['ash-gate'],
} as const;

/** Micro-choice (poc-spec §10.1): level 2 at 10 XP; only level 2 matters for PoC. */
export const XP_LEVEL_2_THRESHOLD = 10;

export function levelForXp(xp: number): number {
  return xp >= XP_LEVEL_2_THRESHOLD ? 2 : 1;
}
