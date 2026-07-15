/**
 * Pure meta-progression logic (poc-spec §5/§8, phase-2-handoff "Loadout") —
 * no Phaser. Scenes call these functions and immediately persist the mutated
 * SaveData via saveGame(); this module never touches storage itself.
 *
 * Combat loadouts are resolved by the spell-tree service (`loadoutFromSave`);
 * `buildLoadout` is a thin alias kept for existing call sites/tests.
 */

import { LEVEL_MANA, levelForXp, SPELLS } from '../data/constants';
import { getDungeonById, isDungeonIdUnlocked } from '../data/dungeons';
import { chooseRelicOffers } from '../data/relics';
import { loadoutFromSave, type CombatMods } from '../data/spellTree';
import type { SaveData } from '../save/save';
import type { CombatResult } from '../scenes/CombatScene';

export interface HubNotice {
  kind: 'levelUp' | 'spellLearned' | 'firstClear';
  text: string;
}

export interface LevelManaBonuses {
  bonusMaxMana: number;
  manaRegen: { amount: number; intervalMs: number } | null;
}

/**
 * Alpha 0.2 §D2 — pure level → combat mana pool + regen. Relics and tree
 * bonuses stack on top at loadout / engine construction time.
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

/**
 * XP always accrues, including on a wipe. Levels grant one tree point each;
 * level 2 also auto-unlocks Zealous Mending. Every distinct dungeon first
 * clear queues a stable three-relic offer.
 */
export function applyCombatResult(
  save: SaveData,
  result: CombatResult,
  random: () => number = Math.random,
): HubNotice[] {
  const notices: HubNotice[] = [];

  const levelBefore = levelForXp(save.xp);
  save.xp += result.xp;
  const levelAfter = levelForXp(save.xp);

  if (levelAfter > levelBefore) {
    notices.push({
      kind: 'levelUp',
      text: `LEVEL ${levelAfter} — +${levelAfter - levelBefore} Talent Point${levelAfter - levelBefore === 1 ? '' : 's'}`,
    });
  }

  if (levelAfter >= 2 && !save.unlockedSpells.includes(SPELLS.zealousMending.id)) {
    save.unlockedSpells.push(SPELLS.zealousMending.id);
    notices.push({
      kind: 'spellLearned',
      text: `${SPELLS.zealousMending.name} learned!`,
    });
  }

  const dungeon = getDungeonById(result.encounterId);
  if (
    result.status === 'victory' &&
    dungeon !== undefined &&
    !save.clearedDungeons.includes(dungeon.id)
  ) {
    save.clearedDungeons.push(dungeon.id);
    save.pendingRelicOffers = chooseRelicOffers(save.relicIds, random);
    notices.push({
      kind: 'firstClear',
      text: save.pendingRelicOffers.length > 0 ? 'FIRST CLEAR — CHOOSE A RELIC' : 'FIRST CLEAR!',
    });
  }

  return notices;
}

/**
 * Resolved fight kit. Alias of `CombatMods` — spells already have castMod
 * baked in; the engine never sees tree layout or castMod nodes.
 */
export type Loadout = CombatMods;

/** Builds the resolved Loadout for the current save via the spell-tree service. */
export function buildLoadout(save: SaveData): Loadout {
  return loadoutFromSave(save);
}

export function allocatedTalentPoints(save: Pick<SaveData, 'treeRanks'>): number {
  return Object.values(save.treeRanks).reduce((total, ranks) => total + Math.max(0, Math.floor(ranks)), 0);
}

export function availableTalentPoints(save: Pick<SaveData, 'xp' | 'treeRanks'>): number {
  return Math.max(0, levelForXp(save.xp) - allocatedTalentPoints(save));
}

/** Generic config-driven dungeon unlock check. Unknown ids are never unlocked. */
export function isDungeonUnlocked(save: SaveData, id: string): boolean {
  return isDungeonIdUnlocked(id, save.clearedDungeons);
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
