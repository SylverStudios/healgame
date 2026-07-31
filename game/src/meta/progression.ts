/**
 * Pure meta-progression logic (poc-spec §5/§8, phase-2-handoff "Loadout") —
 * no Phaser. Scenes call these functions and immediately persist the mutated
 * SaveData via saveGame(); this module never touches storage itself.
 *
 * Combat loadouts are resolved by `loadoutForSave` (lattice, radial, or cards).
 * `buildLoadout` is a thin alias kept for existing call sites/tests.
 */

import { applyCardsLevelUps } from '../data/cards/resolve';
import { CARD_UNLOCKS, cardsLevelUpWelcome } from '../data/cards/unlocks';
import { levelForXp, SPELLS } from '../data/constants';
import { getDungeonById, isDungeonIdUnlocked, ORDERED_DUNGEONS } from '../data/dungeons';
import { chooseRelicOffers } from '../data/relics';
import { loadoutForSave } from '../data/loadout';
import { treeStateFromRadialSave } from '../data/radial/resolve';
import { radialSpellById } from '../data/radial/spells';
import type { CombatMods } from '../data/talentTree';
import { placeOnActionBar, type SaveData } from '../save/save';
import type { CombatResult } from '../scenes/CombatScene';
import type { DungeonDef } from '../data/content/types';
import { walletOf } from '../tree';

export interface HubNotice {
  kind: 'levelUp' | 'spellLearned' | 'firstClear';
  text: string;
}

// Re-exported from data/levelMana.ts so callers don't need to update imports.
export type { LevelManaBonuses } from '../data/levelMana';
export { manaBonusesForLevel } from '../data/levelMana';

/**
 * XP always accrues, including on a wipe. J26 reshape: leveling grants party
 * max HP (applied at combat construction via `partyHpBonusesForLevel`) plus
 * ability unlocks, but no spendable point. Every dungeon *victory* — first
 * clear or repeat — grants one spendable point, mode-aware: lattice/radial
 * bank `talentPointsEarned`, cards bank `upgradePoints`. Every distinct
 * dungeon first clear also queues a stable three-relic offer (lattice/radial).
 */
export function applyCombatResult(
  save: SaveData,
  result: CombatResult,
  // eslint-disable-next-line no-restricted-properties -- the injection seam itself: callers/tests pass a deterministic fn
  random: () => number = Math.random,
): HubNotice[] {
  const notices: HubNotice[] = [];

  const levelBefore = levelForXp(save.xp);
  save.xp += result.xp;
  const levelAfter = levelForXp(save.xp);

  if (levelAfter > levelBefore) {
    if (save.progressionMode === 'cards') {
      // applyCardsLevelUps grants free spell unlocks only (no upgrade points on level).
      applyCardsLevelUps(save, levelBefore, levelAfter);
      // M4: one Upgrade pick per level gained — drained by HubScene modal.
      save.pendingUpgradePicks += levelAfter - levelBefore;
      notices.push({
        kind: 'levelUp',
        text: cardsLevelUpWelcome(levelAfter),
      });
      // Spell unlock notices (CDs are no longer in CARD_UNLOCKS — M5).
      for (let level = levelBefore + 1; level <= levelAfter; level++) {
        for (const unlock of CARD_UNLOCKS) {
          if (unlock.minLevel !== level) continue;
          if (unlock.kind !== 'spell') continue;
          const name = radialSpellById(unlock.id)?.name;
          if (name === undefined) continue;
          notices.push({
            kind: 'spellLearned',
            text: `${name} learned!`,
          });
        }
      }
    } else {
      // Level-up = tougher party (max HP), no talent point (that comes from clears).
      notices.push({
        kind: 'levelUp',
        text: `LEVEL ${levelAfter} — Party Grows Sturdier`,
      });
    }
  }

  // Lattice milestone only — radial unlocks come from the wheel; cards from
  // the unlock table (Chunk 1).
  if (
    save.progressionMode === 'lattice' &&
    levelAfter >= 2 &&
    !save.unlockedSpells.includes(SPELLS.zealousMending.id)
  ) {
    save.unlockedSpells.push(SPELLS.zealousMending.id);
    placeOnActionBar(save, SPELLS.zealousMending.id);
    notices.push({
      kind: 'spellLearned',
      text: `${SPELLS.zealousMending.name} learned!`,
    });
  }

  const dungeon = getDungeonById(result.encounterId);
  if (result.status === 'victory' && dungeon !== undefined) {
    const firstClear = !save.clearedDungeons.includes(dungeon.id);
    if (firstClear) save.clearedDungeons.push(dungeon.id);

    if (save.progressionMode === 'cards') {
      // Cards: relics fully replaced by chip drafts; every victory grants a point.
      save.upgradePoints += 1;
      notices.push({
        kind: firstClear ? 'firstClear' : 'levelUp',
        text: firstClear
          ? 'FIRST CLEAR — +1 Upgrade Point · open Spells'
          : 'CLEAR — +1 Upgrade Point',
      });
    } else {
      // Lattice/radial: every victory grants a talent point; first clear also
      // offers a relic (the victory grant is the only point — no double-grant).
      save.talentPointsEarned += 1;
      if (firstClear) {
        save.pendingRelicOffers = chooseRelicOffers(save.relicIds, random);
        notices.push({
          kind: 'firstClear',
          text:
            save.pendingRelicOffers.length > 0
              ? 'FIRST CLEAR — CHOOSE A RELIC · +1 Talent Point'
              : 'FIRST CLEAR — +1 Talent Point',
        });
      } else {
        notices.push({ kind: 'levelUp', text: 'CLEAR — +1 Talent Point' });
      }
    }
  }

  return notices;
}

/** Optional one-shot payload Hub receives from Combat via Phaser scene data. */
export type HubCombatSceneData = {
  combatResult?: CombatResult;
};

/**
 * Hub post-combat entry: bank XP/rewards from a one-shot `combatResult`, then
 * return empty scene data.
 *
 * Phaser keeps `settings.data` when `scene.start(key)` is called without a
 * new data object (`Systems.start`: only assigns when `data` is truthy). Tree /
 * Relic / Loadout / Settings all return to Hub with no data, so a leftover
 * `combatResult` would re-bank the same XP — Hub and Tree then disagree about
 * level / talent points after the player leaves the tree. Callers must write
 * the returned `sceneData` back into Hub's scene payload (and
 * `sys.settings.data`) so the consume sticks.
 */
export function takeHubCombatResult(
  save: SaveData,
  sceneData: HubCombatSceneData,
  // eslint-disable-next-line no-restricted-properties -- injection seam matches applyCombatResult
  random: () => number = Math.random,
): { notices: HubNotice[]; sceneData: HubCombatSceneData } {
  const notices = sceneData.combatResult
    ? applyCombatResult(save, sceneData.combatResult, random)
    : [];
  return { notices, sceneData: {} };
}

/**
 * Resolved fight kit. Alias of `CombatMods` — spells already have castMod
 * baked in; the engine never sees tree layout or castMod nodes.
 */
export type Loadout = CombatMods;

/** Builds the resolved Loadout for the current save via the mode facade. */
export function buildLoadout(save: SaveData): Loadout {
  return loadoutForSave(save);
}

export function allocatedTalentPoints(save: Pick<SaveData, 'treeRanks'>): number {
  return Object.values(save.treeRanks).reduce((total, ranks) => total + Math.max(0, Math.floor(ranks)), 0);
}

/**
 * J26: talent points are earned by dungeon victories (`talentPointsEarned`),
 * not by level. Available-to-spend is what's earned minus what's allocated.
 */
export function availableTalentPoints(save: Pick<SaveData, 'talentPointsEarned' | 'treeRanks'>): number {
  return Math.max(0, Math.floor(save.talentPointsEarned) - allocatedTalentPoints(save));
}

/**
 * Hub Talent Tree / Spells CTA unspent count — mode-aware.
 *
 * Lattice: same as {@link availableTalentPoints} (earned − sum of treeRanks).
 * Radial: free starter spots (`heal`/`bonk`) do not consume points; matches the
 * talent wallet from {@link treeStateFromRadialSave}.
 * Cards: unspent {@link SaveData.upgradePoints}.
 */
export function unspentTalentPointsForHub(
  save: Pick<SaveData, 'talentPointsEarned' | 'treeRanks' | 'progressionMode' | 'upgradePoints'>,
): number {
  if (save.progressionMode === 'radial') {
    return walletOf(treeStateFromRadialSave(save.talentPointsEarned, save.treeRanks)).talent ?? 0;
  }
  if (save.progressionMode === 'cards') {
    return Math.max(0, Math.floor(save.upgradePoints));
  }
  return availableTalentPoints(save);
}

/** Generic config-driven dungeon unlock check. Unknown ids are never unlocked. */
export function isDungeonUnlocked(save: SaveData, id: string): boolean {
  return isDungeonIdUnlocked(id, save.clearedDungeons);
}

/**
 * The player's current challenge: first dungeon in progression order that is
 * unlocked but not yet cleared. Null when every unlocked dungeon is cleared
 * (including the all-cleared endgame state).
 */
export function currentChallengeDungeon(save: Pick<SaveData, 'clearedDungeons'>): DungeonDef | null {
  for (const dungeon of ORDERED_DUNGEONS) {
    if (!isDungeonIdUnlocked(dungeon.id, save.clearedDungeons)) continue;
    if (!save.clearedDungeons.includes(dungeon.id)) return dungeon;
  }
  return null;
}

/** @deprecated Use isDungeonUnlocked(save, 'the-maw'). */
export function isDungeon2Unlocked(save: SaveData): boolean {
  return isDungeonUnlocked(save, 'the-maw');
}

/** Compatibility wrapper for Alpha 0.1 call sites. */
export function isIronPassUnlocked(save: SaveData): boolean {
  return isDungeonUnlocked(save, 'iron-pass');
}

/** Compatibility wrapper for Alpha 0.1 call sites. */
export function isMawUnlocked(save: SaveData): boolean {
  return isDungeonUnlocked(save, 'the-maw');
}
