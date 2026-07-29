/**
 * Radial save → CombatMods. Chunk 0 stub: starter Heal+Bonk from unlocked /
 * action bar. Chunk 1 replaces this with full tree resolve + specialize.
 */

import { levelForXp } from '../constants';
import { manaBonusesForLevel } from '../levelMana';
import { spellsFromActionBar, type CombatMods } from '../talentTree';
import { radialSpellById } from './spells';
import type { SpellDef } from '../../combat/types';

export function loadoutFromRadialSave(save: {
  unlockedSpells: readonly string[];
  xp?: number;
  actionBar?: readonly string[];
}): CombatMods {
  const owned = save.unlockedSpells
    .map((id) => radialSpellById(id))
    .filter((s): s is SpellDef => s !== undefined)
    .map((s) => ({ ...s }));

  const mods: CombatMods = {
    spells: owned,
    bonusMaxMana: 0,
    synergies: [],
    missingHealthBonuses: [],
    missingHealthPctBonuses: [],
    fullHealthBonuses: [],
    paceMultipliersTenths: [10],
    cooldowns: [],
  };

  const level = levelForXp(save.xp ?? 0);
  const levelMana = manaBonusesForLevel(level);
  mods.bonusMaxMana += levelMana.bonusMaxMana;
  if (levelMana.manaRegen !== null) {
    mods.manaRegen = levelMana.manaRegen;
  }

  if (save.actionBar !== undefined && save.actionBar.some((id) => id.length > 0)) {
    mods.spells = spellsFromActionBar(mods.spells, save.actionBar);
  }
  return mods;
}

/** All owned radial spells (ignores action bar) — Loadout picker. */
export function ownedSpellsFromRadialSave(save: {
  unlockedSpells: readonly string[];
  xp?: number;
}): SpellDef[] {
  return loadoutFromRadialSave({
    unlockedSpells: save.unlockedSpells,
    ...(save.xp !== undefined ? { xp: save.xp } : {}),
  }).spells;
}
