/**
 * Alpha 0.2 §D2 — level-derived combat mana pool + regen.
 *
 * Isolated from meta/progression.ts so talentTree.ts can import it without
 * creating a circular dependency (progression imports loadoutFromSave from
 * talentTree). progression.ts re-exports both the type and function from here
 * for backward compatibility.
 */

import { LEVEL_MANA } from './constants';

export interface LevelManaBonuses {
  bonusMaxMana: number;
  manaRegen: { amount: number; intervalMs: number } | null;
}

/**
 * Pure level → combat mana pool + regen. Relics and tree bonuses stack on
 * top at loadout / engine construction time.
 */
export function manaBonusesForLevel(level: number): LevelManaBonuses {
  const safeLevel = Math.max(1, Math.floor(level));
  const bonusMaxMana = LEVEL_MANA.poolPerLevel * Math.max(0, safeLevel - 1);
  if (safeLevel < LEVEL_MANA.regenFirstLevel) {
    return { bonusMaxMana, manaRegen: null };
  }
  const ranks =
    1 + Math.floor((safeLevel - LEVEL_MANA.regenFirstLevel) / LEVEL_MANA.regenEveryLevels);
  return {
    bonusMaxMana,
    manaRegen: {
      amount: LEVEL_MANA.regenAmountPerRank * ranks,
      intervalMs: LEVEL_MANA.regenIntervalMs,
    },
  };
}
