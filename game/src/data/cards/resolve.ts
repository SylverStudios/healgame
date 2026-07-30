/**
 * Cards-mode save → CombatMods.
 *
 * Chunk 1: unlock table + level-up grants. Chip application arrives in Chunk 2.
 */

import type { SpellDef } from '../../combat/types';
import type { SaveData } from '../../save/save';
import { placeOnActionBar } from '../../save/save';
import { levelForXp } from '../constants';
import { cooldownById } from '../cooldowns';
import { manaBonusesForLevel } from '../levelMana';
import { radialSpellById } from '../radial/spells';
import { spellsFromActionBar, type CombatMods } from '../talentTree';
import { CARD_UNLOCKS, cooldownIdsAtLevel } from './unlocks';

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
 * Canonical cards fight-start entry: unlocked spells → radial defs → level
 * mana → CDs from unlock table at current level → action-bar order.
 * Chips ignored until Chunk 2.
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

  // Cooldown unlocks are not stored on the save — discover via unlock table.
  mods.cooldowns = cooldownIdsAtLevel(level)
    .map((id) => cooldownById(id))
    .filter((c): c is NonNullable<typeof c> => c !== undefined)
    .map((c) => ({ ...c }));

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

/**
 * Cards mode level-up: bank +1 upgrade point per crossed level and grant free
 * unlocks for those levels (handoff §3).
 *
 * This is the **sole** source of level-up upgrade points in cards mode —
 * callers must not also add `upgradePoints` for the same level range.
 * Unlocks are free (do not spend points). Spells are pushed into
 * `unlockedSpells` and auto-equipped into the first free action-bar slot.
 * Cooldown unlocks are not stored on the save; loadout reads them via
 * `cooldownIdsAtLevel(levelForXp(save.xp))`.
 */
export function applyCardsLevelUps(
  save: SaveData,
  prevLevel: number,
  nextLevel: number,
): void {
  if (nextLevel <= prevLevel) return;

  for (let level = prevLevel + 1; level <= nextLevel; level++) {
    save.upgradePoints += 1;

    for (const unlock of CARD_UNLOCKS) {
      if (unlock.minLevel !== level) continue;
      if (unlock.kind !== 'spell') continue;
      if (!save.unlockedSpells.includes(unlock.id)) {
        save.unlockedSpells.push(unlock.id);
      }
      placeOnActionBar(save, unlock.id);
    }
  }
}
