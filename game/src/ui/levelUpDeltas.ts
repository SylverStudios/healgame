/**
 * Pure helpers for computing and formatting HP + mana gains when a fight
 * causes a level-up. Consumed by resultPanel.ts to mount the delta block on
 * the result overlay.
 *
 * Math: bonuses at `levelAfter` minus bonuses at `levelBefore` using the same
 * `partyHpBonusesForLevel` / `manaBonusesForLevel` functions the loadout
 * builder uses — single source of truth, no inline numbers.
 */

import { partyHpBonusesForLevel } from '../data/levelHp';
import { manaBonusesForLevel } from '../data/levelMana';

export interface LevelUpDeltaLines {
  /** Compact HP-gain line, e.g. "HP  Tank +15  DPS1 +4  DPS2 +4  Heal +4" */
  hpLine: string;
  /** Compact mana/regen line, e.g. "Mana +3" or "Mana +3  Regen +1/10s" */
  manaLine: string;
}

/**
 * Pure: compute the display HP delta per role and mana pool delta for a
 * levelBefore → levelAfter transition. dps1 and dps2 share the `dps` role bonus.
 */
export function buildLevelUpDeltas(levelBefore: number, levelAfter: number): LevelUpDeltaLines {
  const hpBefore = partyHpBonusesForLevel(levelBefore);
  const hpAfter = partyHpBonusesForLevel(levelAfter);

  const tankHp = hpAfter.tank - hpBefore.tank;
  const dpsHp = hpAfter.dps - hpBefore.dps;
  const healHp = hpAfter.healer - hpBefore.healer;

  const manaBefore = manaBonusesForLevel(levelBefore);
  const manaAfter = manaBonusesForLevel(levelAfter);
  const manaPool = manaAfter.bonusMaxMana - manaBefore.bonusMaxMana;

  const regenLine = buildRegenNote(manaBefore, manaAfter);

  const hpParts: string[] = [`HP`];
  if (tankHp > 0) hpParts.push(`Tank +${tankHp}`);
  if (dpsHp > 0) hpParts.push(`DPS1 +${dpsHp}`, `DPS2 +${dpsHp}`);
  if (healHp > 0) hpParts.push(`Heal +${healHp}`);

  const hpLine = hpParts.join('  ');

  const manaParts: string[] = [];
  if (manaPool > 0) manaParts.push(`Mana +${manaPool}`);
  if (regenLine) manaParts.push(regenLine);

  const manaLine = manaParts.join('  ');

  return { hpLine, manaLine };
}

/**
 * Pure: returns a short regen note when the regen amount increased or was
 * newly unlocked between levels, e.g. `"Regen +1/10s"`. Returns `""` when
 * there is no regen change.
 */
export function buildRegenNote(
  before: { manaRegen: { amount: number; intervalMs: number } | null },
  after: { manaRegen: { amount: number; intervalMs: number } | null },
): string {
  if (after.manaRegen === null) return '';

  const afterAmount = after.manaRegen.amount;
  const beforeAmount = before.manaRegen?.amount ?? 0;
  const delta = afterAmount - beforeAmount;

  if (delta <= 0) return '';

  const intervalS = Math.round(after.manaRegen.intervalMs / 1000);
  return `Regen +${delta}/${intervalS}s`;
}
