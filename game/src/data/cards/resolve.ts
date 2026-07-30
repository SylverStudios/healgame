/**
 * Cards-mode save → CombatMods.
 *
 * Chunk 0 stub: Heal + Bonk (radial defs) from unlockedSpells / actionBar.
 * Chunks 1–2 replace with unlock table + chip application.
 */

import type { SpellDef } from '../../combat/types';
import { levelForXp } from '../constants';
import { manaBonusesForLevel } from '../levelMana';
import { radialSpellById } from '../radial/spells';
import { spellsFromActionBar, type CombatMods } from '../talentTree';

/** Empty CombatMods shell shared by stub + later chip resolve. */
function emptyMods(spells: SpellDef[]): CombatMods {
  return {
    spells,
    bonusMaxMana: 0,
    synergies: [],
    manaSynergies: [],
    missingHealthBonuses: [],
    missingHealthPctBonuses: [],
    fullHealthBonuses: [],
    paceMultipliersTenths: [10],
    cooldowns: [],
  };
}

/**
 * Canonical cards fight-start entry: unlocked spells → radial defs → level mana
 * → action-bar order. Chips ignored until Chunk 2.
 */
export function loadoutFromCardSave(save: {
  xp: number;
  actionBar: string[];
  unlockedSpells?: readonly string[];
  spellChips?: Record<string, string[]>;
}): CombatMods {
  const unlocked = save.unlockedSpells ?? ['heal', 'bonk'];
  const spells: SpellDef[] = unlocked
    .map((id) => radialSpellById(id))
    .filter((s): s is SpellDef => s !== undefined)
    .map((s) => ({ ...s }));

  const mods = emptyMods(spells);

  const level = levelForXp(save.xp);
  const levelMana = manaBonusesForLevel(level);
  mods.bonusMaxMana += levelMana.bonusMaxMana;
  if (levelMana.manaRegen !== null) {
    mods.manaRegen = levelMana.manaRegen;
  }

  if (save.actionBar.some((id) => id.length > 0)) {
    mods.spells = spellsFromActionBar(mods.spells, save.actionBar);
  }

  return mods;
}

/** All owned card spells (ignores action bar) — album / picker. */
export function ownedSpellsFromCardSave(save: {
  xp: number;
  unlockedSpells?: readonly string[];
  spellChips?: Record<string, string[]>;
}): SpellDef[] {
  return loadoutFromCardSave({
    xp: save.xp,
    actionBar: [],
    ...(save.unlockedSpells !== undefined ? { unlockedSpells: save.unlockedSpells } : {}),
    ...(save.spellChips !== undefined ? { spellChips: save.spellChips } : {}),
  }).spells;
}
