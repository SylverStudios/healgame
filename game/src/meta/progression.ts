/**
 * Pure meta-progression logic (poc-spec §5, §8) — no Phaser. Scenes call these
 * functions and immediately persist the mutated SaveData via saveGame(); this
 * module never touches storage itself.
 */

import { levelForXp, REWARDS, SPELLS } from '../data/constants';
import { treeNodeById } from '../data/tree';
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
    save.rubies += REWARDS.rubyPerFirstClear;
    save.clearedDungeons.push(result.encounterId);
    notices.push({
      kind: 'firstClear',
      text: `FIRST CLEAR — +${REWARDS.rubyPerFirstClear} Ruby`,
    });
  }

  return notices;
}

/** The spell list + tree bonuses to hand CombatScene/CombatEngine for the current save. */
export function buildLoadout(save: SaveData): { spellIds: string[]; bonusMaxMana: number } {
  const bonusMaxMana = save.treeNodes.reduce((sum, nodeId) => {
    const node = treeNodeById(nodeId);
    return node && node.effect.kind === 'bonusMaxMana' ? sum + node.effect.amount : sum;
  }, 0);

  return { spellIds: [...save.unlockedSpells], bonusMaxMana };
}

/**
 * Buys a spell-tree node with gold. Fails (returns false, no mutation) if the
 * node is unknown, already owned, or unaffordable. On success, mutates
 * `save` (gold spent, node recorded) and returns true; caller saveGame()s.
 */
export function purchaseNode(save: SaveData, nodeId: string): boolean {
  if (save.treeNodes.includes(nodeId)) return false;
  const node = treeNodeById(nodeId);
  if (!node) return false;
  if (save.gold < node.cost) return false;

  save.gold -= node.cost;
  save.treeNodes.push(nodeId);
  return true;
}
