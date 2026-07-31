/**
 * Build CombatEngineOptions from a resolved CombatMods (+ relics).
 * Keeps CombatScene under max-lines; secondaries pass through when set.
 */

import type { CombatEngineOptions, RelicDef } from '../combat/types';
import type { CombatMods } from '../data/talentTree';

export function combatOptionsFromLoadout(
  lo: CombatMods,
  relics: RelicDef[],
): CombatEngineOptions {
  return {
    bonusMaxMana: lo.bonusMaxMana,
    ...(lo.bonusMaxHp !== undefined ? { bonusMaxHp: lo.bonusMaxHp } : {}),
    ...(lo.manaRegen !== undefined ? { manaRegen: lo.manaRegen } : {}),
    synergies: lo.synergies,
    ...(lo.manaSynergies !== undefined ? { manaSynergies: lo.manaSynergies } : {}),
    missingHealthBonuses: lo.missingHealthBonuses,
    missingHealthPctBonuses: lo.missingHealthPctBonuses,
    fullHealthBonuses: lo.fullHealthBonuses,
    cooldowns: lo.cooldowns,
    relics,
    ...(lo.hastePermille != null ? { hastePermille: lo.hastePermille } : {}),
    ...(lo.critChancePermille != null
      ? { critChancePermille: lo.critChancePermille, critBonusPermille: lo.critBonusPermille }
      : {}),
    ...(lo.blockThresholdN != null ? { blockThresholdN: lo.blockThresholdN } : {}),
  };
}
