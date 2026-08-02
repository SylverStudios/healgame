/**
 * Cards-mode playtest kit at a player level — free unlocks, baked chips,
 * secondary upgrade ranks, and chosen major CDs.
 */

import { applyCooldownChoice } from '../data/cards/cooldownsChoice';
import { applyCardsLevelUps, applyChipPurchase, loadoutFromCardSave } from '../data/cards/resolve';
import { spellIdsAtLevel } from '../data/cards/unlocks';
import { xpForLevel } from '../data/constants';
import { applyUpgradePick } from '../data/secondaryStats';
import type { CombatMods } from '../data/talentTree';
import { newSaveData, type SaveData } from '../save/save';
import {
  BASIC_SECONDARY,
  BASIC_SET_A_CD,
  BASIC_SET_B_CD,
  chipPlanFor,
  godSecondaryAtPick,
  GOD_SET_A_CD,
  GOD_SET_B_CD,
  type KitProfile,
} from './loadouts';

export type { KitProfile } from './loadouts';

/** Build a cards loadout for `profile` as if the player is exactly `level`. */
export function kitAtLevel(level: number, profile: KitProfile = 'basic'): CombatMods {
  return loadoutFromCardSave(saveAtLevel(level, profile));
}

/** Fully configured cards SaveData for playtest (chips + secondaries + CDs). */
export function saveAtLevel(level: number, profile: KitProfile): SaveData {
  const safe = Math.max(1, Math.floor(level));
  const save = newSaveData('cards');
  save.tutorialDone = true;
  save.xp = xpForLevel(safe);
  applyCardsLevelUps(save, 1, safe);
  save.actionBar = ['', '', '', ''];
  for (const id of spellIdsAtLevel(safe)) {
    if (!save.unlockedSpells.includes(id)) save.unlockedSpells.push(id);
  }

  applySecondaryPicks(save, profile, safe);
  applyCooldownPicks(save, profile, safe);
  applyChipPlan(save, profile);
  return save;
}

function applySecondaryPicks(save: SaveData, profile: KitProfile, level: number): void {
  const picks = Math.max(0, level - 1);
  save.pendingUpgradePicks = picks;
  for (let i = 0; i < picks; i++) {
    const id = profile === 'basic' ? BASIC_SECONDARY : godSecondaryAtPick(i);
    if (!applyUpgradePick(save, id)) break;
  }
}

function applyCooldownPicks(save: SaveData, profile: KitProfile, level: number): void {
  if (level >= 6) {
    applyCooldownChoice(save, profile === 'god' ? GOD_SET_A_CD : BASIC_SET_A_CD);
  }
  if (level >= 8) {
    applyCooldownChoice(save, profile === 'god' ? GOD_SET_B_CD : BASIC_SET_B_CD);
  }
}

function applyChipPlan(save: SaveData, profile: KitProfile): void {
  for (const step of chipPlanFor(profile)) {
    if (!save.unlockedSpells.includes(step.spellId)) continue;
    // Grant exactly the point needed for this purchase (victories bank points in live play).
    save.upgradePoints += 1;
    const ok = applyChipPurchase(save, step.spellId, step.chipId);
    if (!ok) {
      // Slot gated (e.g. slot-2 before Lv5) or offer mismatch — refund the point.
      save.upgradePoints -= 1;
    }
  }
  // Leftover points from failed purchases should not linger.
  save.upgradePoints = 0;
}
