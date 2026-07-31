/**
 * Cards-mode save → CombatMods.
 *
 * Unlock table + level-up grants (Chunk 1). Chip application + purchase
 * (Chunk 2): owned chips bake castMods / synergies / manaSynergies /
 * missing+full HP lists / castBuff / manaOnHit onto cloned radial defs.
 *
 * **castBuff last-wins:** when two chips set `castBuff` on the same spell
 * (e.g. Bonk Blessed then Reckoning/Quicksteel), later chips in slot order
 * overwrite earlier ones.
 */

import type {
  FullHealthBonusRule,
  ManaSynergyRule,
  MissingHealthBonusRule,
  MissingHealthPctBonusRule,
  SpellDef,
  SynergyRule,
} from '../../combat/types';
import type { SaveData } from '../../save/save';
import { placeOnActionBar } from '../../save/save';
import { levelForXp } from '../constants';
import { cooldownById } from '../cooldowns';
import { manaBonusesForLevel } from '../levelMana';
import { partyHpBonusesForLevel } from '../levelHp';
import { radialSpellById } from '../radial/spells';
import { spellsFromActionBar, type CombatMods } from '../talentTree';
import { chipById, type CardChipEffect } from './chips';
import { offersForNextSlot } from './draft';
import { CARD_SLOTS, CARD_UNLOCKS, cooldownIdsAtLevel } from './unlocks';

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

function applyChipEffect(
  effect: CardChipEffect,
  spells: SpellDef[],
  synergyMap: Map<string, SynergyRule>,
  manaSynergyMap: Map<string, ManaSynergyRule>,
  missingMap: Map<string, MissingHealthBonusRule>,
  missingPctMap: Map<string, MissingHealthPctBonusRule>,
  fullHealthMap: Map<string, FullHealthBonusRule>,
): void {
  switch (effect.kind) {
    case 'castMod': {
      const spell = spells.find((s) => s.id === effect.spellId);
      if (!spell) break;
      if (effect.castMsDelta !== undefined) {
        spell.castMs = Math.max(0, spell.castMs + effect.castMsDelta);
      }
      if (effect.manaDelta !== undefined) {
        // heal-cost parenthetical "clamp ≥ 1" is satisfied by heal base 3 − 1;
        // mend-penny needs 0 cost, so floor is 0 like radial/lattice castMod.
        spell.mana = Math.max(0, spell.mana + effect.manaDelta);
      }
      if (effect.healDelta !== undefined) {
        spell.heal = Math.max(0, spell.heal + effect.healDelta);
      }
      if (effect.damageDelta !== undefined) {
        spell.damage = Math.max(0, (spell.damage ?? 0) + effect.damageDelta);
      }
      if (effect.cooldownMsDelta !== undefined && spell.cooldownMs !== undefined) {
        spell.cooldownMs = Math.max(0, spell.cooldownMs + effect.cooldownMsDelta);
      }
      break;
    }

    case 'synergy': {
      const key = `${effect.triggerSpellId}>${effect.buffedSpellId}`;
      const prev = synergyMap.get(key);
      if (prev) {
        prev.bonusHeal += effect.bonusHeal;
      } else {
        synergyMap.set(key, {
          triggerSpellId: effect.triggerSpellId,
          buffedSpellId: effect.buffedSpellId,
          bonusHeal: effect.bonusHeal,
        });
      }
      break;
    }

    case 'manaSynergy': {
      const key = `${effect.triggerSpellId}>${effect.targetSpellId}`;
      const prev = manaSynergyMap.get(key);
      if (prev) {
        prev.manaDelta += effect.manaDelta;
      } else {
        manaSynergyMap.set(key, {
          triggerSpellId: effect.triggerSpellId,
          targetSpellId: effect.targetSpellId,
          manaDelta: effect.manaDelta,
        });
      }
      break;
    }

    case 'missingHealthBonus': {
      const prev = missingMap.get(effect.spellId);
      if (prev) {
        prev.healPer10PctMissing += effect.healPer10PctMissing;
      } else {
        missingMap.set(effect.spellId, {
          spellId: effect.spellId,
          healPer10PctMissing: effect.healPer10PctMissing,
        });
      }
      break;
    }

    case 'missingHealthPctBonus': {
      const prev = missingPctMap.get(effect.spellId);
      if (prev) {
        prev.pctPer10PctMissing += effect.pctPer10PctMissing;
      } else {
        missingPctMap.set(effect.spellId, {
          spellId: effect.spellId,
          pctPer10PctMissing: effect.pctPer10PctMissing,
        });
      }
      break;
    }

    case 'fullHealthBonus': {
      const key = `${effect.spellId}:${effect.hpPctAtLeast}`;
      const prev = fullHealthMap.get(key);
      if (prev) {
        prev.bonusHeal += effect.bonusHeal;
      } else {
        fullHealthMap.set(key, {
          spellId: effect.spellId,
          hpPctAtLeast: effect.hpPctAtLeast,
          bonusHeal: effect.bonusHeal,
        });
      }
      break;
    }

    case 'setManaOnHit': {
      const spell = spells.find((s) => s.id === effect.spellId);
      if (spell) spell.manaOnHit = effect.amount;
      break;
    }

    case 'setCastBuff': {
      // Later chip overwrites castBuff on the same spell (last wins).
      const spell = spells.find((s) => s.id === effect.spellId);
      if (spell) spell.castBuff = effect.castBuff;
      break;
    }
  }
}

/**
 * Apply owned chips in slot order onto cloned spells / synergy maps.
 * Slot order = array order of spellChips[spellId] (index 0 = slot 1 pick).
 */
function applyOwnedChips(
  spellChips: Record<string, string[]>,
  spells: SpellDef[],
  synergyMap: Map<string, SynergyRule>,
  manaSynergyMap: Map<string, ManaSynergyRule>,
  missingMap: Map<string, MissingHealthBonusRule>,
  missingPctMap: Map<string, MissingHealthPctBonusRule>,
  fullHealthMap: Map<string, FullHealthBonusRule>,
): void {
  for (const chipIds of Object.values(spellChips)) {
    for (const chipId of chipIds) {
      const chip = chipById(chipId);
      if (!chip) continue;
      for (const effect of chip.effects) {
        applyChipEffect(
          effect,
          spells,
          synergyMap,
          manaSynergyMap,
          missingMap,
          missingPctMap,
          fullHealthMap,
        );
      }
    }
  }
}

/**
 * Canonical cards fight-start entry: unlocked spells → radial defs → chips →
 * level mana → CDs from unlock table at current level → action-bar order.
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

  const synergyMap = new Map<string, SynergyRule>();
  const manaSynergyMap = new Map<string, ManaSynergyRule>();
  const missingMap = new Map<string, MissingHealthBonusRule>();
  const missingPctMap = new Map<string, MissingHealthPctBonusRule>();
  const fullHealthMap = new Map<string, FullHealthBonusRule>();

  applyOwnedChips(
    save.spellChips ?? {},
    spells,
    synergyMap,
    manaSynergyMap,
    missingMap,
    missingPctMap,
    fullHealthMap,
  );

  const mods = emptyMods(spells);
  mods.synergies = [...synergyMap.values()];
  mods.manaSynergies = [...manaSynergyMap.values()];
  mods.missingHealthBonuses = [...missingMap.values()];
  mods.missingHealthPctBonuses = [...missingPctMap.values()];
  mods.fullHealthBonuses = [...fullHealthMap.values()];

  const level = levelForXp(save.xp);
  const levelMana = manaBonusesForLevel(level);
  mods.bonusMaxMana += levelMana.bonusMaxMana;
  if (levelMana.manaRegen !== null) {
    mods.manaRegen = levelMana.manaRegen;
  }
  const levelHp = partyHpBonusesForLevel(level);
  if (levelHp.tank > 0 || levelHp.dps > 0 || levelHp.healer > 0) {
    mods.bonusMaxHp = levelHp;
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
 * Cards mode level-up: grant free unlocks for the crossed levels (handoff §3).
 *
 * J26: level-ups no longer bank upgrade points — those come only from dungeon
 * victories (see `applyCombatResult`). Unlocks are free (do not spend points).
 * Spells are pushed into `unlockedSpells` and auto-equipped into the first
 * free action-bar slot. Cooldown unlocks are not stored on the save; loadout
 * reads them via `cooldownIdsAtLevel(levelForXp(save.xp))`.
 */
export function applyCardsLevelUps(
  save: SaveData,
  prevLevel: number,
  nextLevel: number,
): void {
  if (nextLevel <= prevLevel) return;

  for (let level = prevLevel + 1; level <= nextLevel; level++) {
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

/**
 * Spend 1 upgrade point to fill the next chip slot on `spellId`.
 *
 * Rejects when: unknown spell (not unlocked / no chip catalog), insufficient
 * points, all slots full, chip not in `offersForNextSlot`, or chip belongs to
 * a different spell. Mutates `save` on success.
 */
export function applyChipPurchase(save: SaveData, spellId: string, chipId: string): boolean {
  if (!save.unlockedSpells.includes(spellId)) return false;
  if (save.upgradePoints < 1) return false;

  const chip = chipById(chipId);
  if (!chip) return false;
  if (chip.spellId !== spellId) return false;

  const owned = save.spellChips[spellId] ?? [];
  if (owned.length >= CARD_SLOTS) return false;

  const level = levelForXp(save.xp);
  const offers = offersForNextSlot(spellId, owned, level);
  if (!offers || !offers.includes(chipId)) return false;
  // Wrong-slot / level-gated / heal-heavy gate rejected via offers.

  if (chip.slotIndex !== owned.length) return false;

  save.upgradePoints -= 1;
  if (!save.spellChips[spellId]) {
    save.spellChips[spellId] = [];
  }
  save.spellChips[spellId].push(chipId);
  return true;
}
