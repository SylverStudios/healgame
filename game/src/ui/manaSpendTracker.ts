/**
 * Presentation-only rolling window of mana spent. CombatScene feeds spends on
 * castStarted; the aura reads intensity each frame. Pure — no Phaser.
 */

export const MANA_AURA_WINDOW_MS = 30_000;

/** Soft ceiling for full-intensity aura (roughly 8× base Solemn Mend cost). */
export const MANA_AURA_FULL_SPEND = 24;

export interface ManaSpendEntry {
  atMs: number;
  amount: number;
}

/** Sum of mana amounts whose timestamp falls within [nowMs − windowMs, nowMs]. */
export function manaSpentInWindow(
  spends: readonly ManaSpendEntry[],
  nowMs: number,
  windowMs: number = MANA_AURA_WINDOW_MS,
): number {
  const cutoff = nowMs - windowMs;
  let total = 0;
  for (const entry of spends) {
    if (entry.atMs >= cutoff && entry.atMs <= nowMs) total += entry.amount;
  }
  return total;
}

/** Drop spends older than the window so the buffer stays bounded. */
export function pruneManaSpends(
  spends: ManaSpendEntry[],
  nowMs: number,
  windowMs: number = MANA_AURA_WINDOW_MS,
): ManaSpendEntry[] {
  const cutoff = nowMs - windowMs;
  return spends.filter((entry) => entry.atMs >= cutoff);
}

/** 0..1 intensity from recent spend (clamped). */
export function manaAuraIntensity(
  spent: number,
  fullSpend: number = MANA_AURA_FULL_SPEND,
): number {
  if (fullSpend <= 0) return 0;
  return Math.max(0, Math.min(1, spent / fullSpend));
}
