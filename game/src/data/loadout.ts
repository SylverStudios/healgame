/**
 * Progression-mode loadout facade. Combat / Hub / Tutorial / Loadout entry
 * points call `loadoutForSave` — never branch on tree topology themselves.
 */

import type { SpellDef } from '../combat/types';
import type { SaveData } from '../save/save';
import { loadoutFromCardSave, ownedSpellsFromCardSave } from './cards/resolve';
import { loadoutFromRadialSave, ownedSpellsFromRadialSave } from './radial/resolve';
import { loadoutFromSave, ownedSpellsFromSave, type CombatMods } from './talentTree';

/** Canonical fight-start / hub loadout entry: save → flat CombatMods. */
export function loadoutForSave(save: SaveData): CombatMods {
  if (save.progressionMode === 'radial') {
    return loadoutFromRadialSave(save);
  }
  if (save.progressionMode === 'cards') {
    return loadoutFromCardSave(save);
  }
  return loadoutFromSave(save);
}

/** Spellbook picker list (all owned spells; ignores action bar). */
export function ownedSpellsForSave(save: SaveData): SpellDef[] {
  if (save.progressionMode === 'radial') {
    return ownedSpellsFromRadialSave(save);
  }
  if (save.progressionMode === 'cards') {
    return ownedSpellsFromCardSave(save);
  }
  return ownedSpellsFromSave(save);
}
