/**
 * Level-up secondary upgrades (v1 player mechanics).
 *
 * Save stores ranks only; magnitudes live here. Stub values keep crown kits
 * safe for balance.test.ts — Balance retunes later.
 *
 * // Future: present upgrades as dungeon-thematic gear slot picks
 * // (chest, legs, hands, boots, shoulders, head, rings, necklace).
 */

export type SecondaryId = 'block' | 'crit' | 'haste' | 'manaRegen';

export const SECONDARY_IDS: readonly SecondaryId[] = [
  'block',
  'crit',
  'haste',
  'manaRegen',
] as const;

export type SecondaryRanks = Partial<Record<SecondaryId, number>>;

/** Fight-facing mods derived from secondary ranks (omit/0 = today's behavior). */
export interface SecondaryFightMods {
  /** Player castMs reduction in permille (0..999). GCD unchanged. */
  hastePermille: number;
  /** Crit chance in permille (0..1000). */
  critChancePermille: number;
  /** Crit output bonus in permille (500 = +50%). */
  critBonusPermille: number;
  /**
   * Tank block: every N post-armor damage, block 1. `null` = disabled (rank 0).
   * Higher rank → smaller N.
   */
  blockThresholdN: number | null;
  /** Extra mana regen folded into CombatMods.manaRegen merge. */
  manaRegen: { amount: number; intervalMs: number } | null;
}

/** Stub: rank 0 = off; rank 1 → N=20; each rank −2 N, floor 5. */
export function blockThreshold(rank: number): number | null {
  const r = Math.max(0, Math.floor(rank));
  if (r <= 0) return null;
  return Math.max(5, 20 - (r - 1) * 2);
}

/** Stub: +20‰ chance per rank (rank 1 = 2%). */
export function critChancePermille(rank: number): number {
  const r = Math.max(0, Math.floor(rank));
  return r * 20;
}

/** Fantasy +50% on crit — Balance may retune. */
export const CRIT_BONUS_PERMILLE = 500;

/** Stub: +15‰ castMs reduction per rank (rank 1 = 1.5%). Cap below 1000. */
export function hastePermille(rank: number): number {
  const r = Math.max(0, Math.floor(rank));
  return Math.min(900, r * 15);
}

/** Stub: +1 mana every 10s per rank (same interval as level regen). */
export function manaRegenFromRank(rank: number): { amount: number; intervalMs: number } | null {
  const r = Math.max(0, Math.floor(rank));
  if (r <= 0) return null;
  return { amount: r, intervalMs: 10_000 };
}

export function fightModsFromSecondaryRanks(ranks: SecondaryRanks): SecondaryFightMods {
  const block = Math.max(0, Math.floor(ranks.block ?? 0));
  const crit = Math.max(0, Math.floor(ranks.crit ?? 0));
  const haste = Math.max(0, Math.floor(ranks.haste ?? 0));
  const mana = Math.max(0, Math.floor(ranks.manaRegen ?? 0));
  return {
    hastePermille: hastePermille(haste),
    critChancePermille: critChancePermille(crit),
    critBonusPermille: CRIT_BONUS_PERMILLE,
    blockThresholdN: blockThreshold(block),
    manaRegen: manaRegenFromRank(mana),
  };
}

/** Increment one secondary rank (new rank = old + 1). */
export function bumpSecondaryRank(ranks: SecondaryRanks, id: SecondaryId): SecondaryRanks {
  const next = { ...ranks };
  next[id] = Math.max(0, Math.floor(next[id] ?? 0)) + 1;
  return next;
}
