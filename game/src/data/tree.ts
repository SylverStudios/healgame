/**
 * Spell-tree node data (poc-spec §5, §10.2). Gold sink; TreeScene renders
 * generically from this array, so Chunk 4 can append subclass branch nodes
 * here without touching scene code.
 *
 * Locked micro-choice (poc-spec §10, task brief): the one PoC gold node is
 * 'max-mana-1' ("Deep Reserves"), +5 max mana, cost 5 gold.
 *
 * Chunk 4 (poc-spec §6): each subclass branch gets exactly one follow-up
 * node, gated behind `branch` — meta/progression.ts#visibleTreeNodes only
 * surfaces a branch node once save.subclass matches it, and the unchosen
 * branch stays hidden forever (no respec).
 */

/** Typed so future nodes (Chunk 4 subclass branches) can add new effect kinds. */
export type TreeNodeEffect = { kind: 'bonusMaxMana'; amount: number };

export interface TreeNode {
  id: string;
  name: string;
  description: string;
  cost: number;
  effect: TreeNodeEffect;
  /** Present only for subclass branch nodes; gates visibility to save.subclass. */
  branch?: 'vigil' | 'zealot';
}

export const TREE_NODES: TreeNode[] = [
  {
    id: 'max-mana-1',
    name: 'Deep Reserves',
    description: '+5 max mana',
    cost: 5,
    effect: { kind: 'bonusMaxMana', amount: 5 },
  },
  {
    id: 'vigil-deep-focus',
    name: 'Deep Focus',
    description: 'Steady discipline. +5 max mana',
    cost: 5,
    effect: { kind: 'bonusMaxMana', amount: 5 },
    branch: 'vigil',
  },
  {
    id: 'zealot-battle-fervor',
    name: 'Battle Fervor',
    description: 'Zeal burns hotter. +5 max mana',
    cost: 5,
    effect: { kind: 'bonusMaxMana', amount: 5 },
    branch: 'zealot',
  },
];

export function treeNodeById(id: string): TreeNode | undefined {
  return TREE_NODES.find((n) => n.id === id);
}
