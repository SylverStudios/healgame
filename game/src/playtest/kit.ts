/**
 * Baseline cards-mode kit at a given player level — free unlocks only, no chips.
 * Level supplies mana pool / regen and party max-HP via loadoutFromCardSave.
 */

import { xpForLevel } from '../data/constants';
import { applyCardsLevelUps, loadoutFromCardSave } from '../data/cards/resolve';
import { spellIdsAtLevel } from '../data/cards/unlocks';
import type { CombatMods } from '../data/talentTree';
import { newSaveData } from '../save/save';

/** Build the no-chip cards loadout a player would have at exactly `level`. */
export function kitAtLevel(level: number): CombatMods {
  const safe = Math.max(1, Math.floor(level));
  const save = newSaveData('cards');
  save.tutorialDone = true;
  save.xp = xpForLevel(safe);
  // Start from level-1 unlocks already on newSaveData, then grant through `safe`.
  applyCardsLevelUps(save, 1, safe);
  // Empty action bar → loadout keeps every unlocked spell (not bar-filtered).
  save.actionBar = ['', '', '', ''];
  // Belt-and-suspenders: ensure unlock table spells are present even if
  // applyCardsLevelUps skipped (e.g. already on the starter save).
  for (const id of spellIdsAtLevel(safe)) {
    if (!save.unlockedSpells.includes(id)) save.unlockedSpells.push(id);
  }
  return loadoutFromCardSave(save);
}
