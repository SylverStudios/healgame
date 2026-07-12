/**
 * Pure meta-progression logic (poc-spec §5/§8, phase-2-handoff "Loadout") —
 * no Phaser. Scenes call these functions and immediately persist the mutated
 * SaveData via saveGame(); this module never touches storage itself.
 *
 * Combat loadouts are resolved by the spell-tree service (`loadoutFromSave`);
 * `buildLoadout` is a thin alias kept for existing call sites/tests.
 */

import { levelForXp, REWARDS, SPELLS } from '../data/constants';
import { TREE_NODES, treeNodeById } from '../data/tree';
import { loadoutFromSave, type CombatMods } from '../data/spellTree';
import type { SaveData } from '../save/save';
import type { CombatResult } from '../scenes/CombatScene';

export interface HubNotice {
  kind: 'levelUp' | 'spellLearned' | 'firstClear';
  text: string;
}

/**
 * Applies a finished combat's rewards to the save: gold/xp always accrue
 * (even on a wipe). If this result crosses the level-2 threshold and the
 * player doesn't already have Zealous Mending, auto-unlock it (poc-spec: no
 * spend UI). If it's a victory and this is the encounter's first clear,
 * grant a ruby and record the clear. Mutates `save` in place; caller is
 * responsible for saveGame(). Returns notices describing what happened, in
 * the order they occurred, for the hub to display.
 */
export function applyCombatResult(save: SaveData, result: CombatResult): HubNotice[] {
  const notices: HubNotice[] = [];

  const levelBefore = levelForXp(save.xp);
  save.gold += result.gold;
  save.xp += result.xp;
  const levelAfter = levelForXp(save.xp);

  if (levelAfter > levelBefore && !save.unlockedSpells.includes(SPELLS.zealousMending.id)) {
    save.unlockedSpells.push(SPELLS.zealousMending.id);
    notices.push({
      kind: 'levelUp',
      text: `LEVEL ${levelAfter} — ${SPELLS.zealousMending.name} learned!`,
    });
  }

  if (result.status === 'victory' && !save.clearedDungeons.includes(result.encounterId)) {
    save.clearedDungeons.push(result.encounterId);
    // Alpha 0.1 §D1: rubies remain Ash-Gate-only; other first clears still
    // record (Iron Pass clear is what unlocks The Maw) but pay no ruby.
    const grantsRuby = (REWARDS.rubyFirstClearDungeonIds as readonly string[]).includes(result.encounterId);
    if (grantsRuby) save.rubies += REWARDS.rubyPerFirstClear;
    notices.push({
      kind: 'firstClear',
      text: grantsRuby ? `FIRST CLEAR — +${REWARDS.rubyPerFirstClear} Ruby` : 'FIRST CLEAR!',
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

function ranksOf(save: SaveData, nodeId: string): number {
  return save.treeRanks[nodeId] ?? 0;
}

/** Everything a scene needs to render one node's state. All derived, no mutation. */
export interface TreeNodeStatus {
  ranks: number;
  maxed: boolean;
  /** Every `requires` node owned at rank ≥1. */
  requirementsMet: boolean;
  /** A rival node in the same exclusiveGroup is owned — permanently locked. */
  lockedByExclusive: boolean;
  /** Can afford the next rank in the node's currency. */
  affordable: boolean;
  /** All of the above pass: purchaseNode would succeed right now. */
  purchasable: boolean;
}

/**
 * @deprecated TreeScene uses the config-driven tree service. Kept for
 * progression unit tests covering the legacy TREE_NODES purchase path.
 */
export function nodeStatus(save: SaveData, nodeId: string): TreeNodeStatus | undefined {
  const node = treeNodeById(nodeId);
  if (!node) return undefined;

  const ranks = ranksOf(save, nodeId);
  const maxed = ranks >= node.maxRanks;
  const requirementsMet = node.requires.every((id) => ranksOf(save, id) >= 1);
  const lockedByExclusive =
    node.exclusiveGroup !== undefined &&
    TREE_NODES.some(
      (n) => n.id !== node.id && n.exclusiveGroup === node.exclusiveGroup && ranksOf(save, n.id) > 0,
    );
  const wallet = node.cost.currency === 'gold' ? save.gold : save.rubies;
  const affordable = wallet >= node.cost.amount;

  return {
    ranks,
    maxed,
    requirementsMet,
    lockedByExclusive,
    affordable,
    purchasable: !maxed && requirementsMet && !lockedByExclusive && affordable,
  };
}

/**
 * @deprecated TreeScene uses tree.update. Kept for progression unit tests.
 */
export function purchaseNode(save: SaveData, nodeId: string): boolean {
  const node = treeNodeById(nodeId);
  const status = nodeStatus(save, nodeId);
  if (!node || !status?.purchasable) return false;

  if (node.cost.currency === 'gold') save.gold -= node.cost.amount;
  else save.rubies -= node.cost.amount;
  save.treeRanks[nodeId] = status.ranks + 1;
  if (node.exclusiveGroup === 'subclass' && node.subclass !== undefined) {
    save.subclass = node.subclass;
  }
  return true;
}

/**
 * Dungeon 2 ("Iron Pass") unlocks after Ash Gate's first clear
 * (alpha-0.1-handoff §D1).
 */
export function isIronPassUnlocked(save: SaveData): boolean {
  return save.clearedDungeons.includes('ash-gate');
}

/**
 * Dungeon 3 ("The Maw") unlocks after Iron Pass's first clear
 * (alpha-0.1-handoff §D1 amends poc-spec §7's old "after Ash Gate" rule).
 */
export function isMawUnlocked(save: SaveData): boolean {
  return save.clearedDungeons.includes('iron-pass');
}
