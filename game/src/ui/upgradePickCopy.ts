/**
 * Pure formatting helpers for the upgrade-pick modal value lines.
 * Each function returns a "current → next" display string for a
 * secondary stat at the given rank (i.e. what the player has now
 * and what selecting this card would give them).
 */

import { blockThreshold, critThreshold, hastePermille, manaRegenFromRank } from '../data/secondaryStats';

function formatHastePct(permille: number): string {
  const pct = permille / 10;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
}

/** "Off → Every 20 dmg" at rank 0; "Every 20 dmg → Every 18 dmg" at rank 1+. */
export function blockValueLine(rank: number): string {
  const cur = blockThreshold(rank);
  const nxt = blockThreshold(rank + 1)!;
  if (cur === null) return `Off → Every ${nxt} dmg`;
  return `Every ${cur} dmg → Every ${nxt} dmg`;
}

/** "Off → Every 8 casts" at rank 0; "Every 8 casts → Every 7 casts" at rank 1+. */
export function critValueLine(rank: number): string {
  const cur = critThreshold(rank);
  const nxt = critThreshold(rank + 1)!;
  if (cur === null) return `Off → Every ${nxt} casts`;
  return `Every ${cur} casts → Every ${nxt} casts`;
}

/** "0% → 1.5%" at rank 0; "1.5% → 3%" at rank 1; etc. */
export function hasteValueLine(rank: number): string {
  const cur = hastePermille(rank);
  const nxt = hastePermille(rank + 1);
  return `${formatHastePct(cur)} → ${formatHastePct(nxt)}`;
}

/** "Off → +1 / 10s" at rank 0; "+1 / 10s → +2 / 10s" at rank 1+. */
export function manaRegenValueLine(rank: number): string {
  const cur = manaRegenFromRank(rank);
  const nxt = manaRegenFromRank(rank + 1)!;
  const fmtNxt = `+${nxt.amount} / ${nxt.intervalMs / 1000}s`;
  if (cur === null) return `Off → ${fmtNxt}`;
  return `+${cur.amount} / ${cur.intervalMs / 1000}s → ${fmtNxt}`;
}
