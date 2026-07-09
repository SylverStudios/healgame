/**
 * Spell-tree node data (phase-2-handoff §"Tree data model"). A real
 * prerequisite tree: Deep Reserves at the root, branching to the two
 * mutually-exclusive subclass oath nodes (exclusiveGroup), each branching to
 * a synergy node and a spell-mod node. TreeScene renders generically from
 * this array; purchase rules live in meta/progression.ts.
 *
 * Draft numbers from the handoff doc — tunable against the balance gates.
 */

import type { SubclassId } from '../save/save';
import { SPELLS } from './constants';

export type TreeNodeEffect =
  | { kind: 'bonusMaxMana'; amountPerRank: number }
  | { kind: 'grantSpell'; spellId: string }
  | { kind: 'synergy'; triggerSpellId: string; buffedSpellId: string; bonusHealPerRank: number }
  | { kind: 'missingHealthBonus'; spellId: string; healPer10PctMissingPerRank: number }
  | { kind: 'castMod'; spellId: string; castMsDelta: number; manaDelta: number };

export interface TreeNode {
  id: string;
  name: string;
  description: string;
  /** Cost per rank. */
  cost: { currency: 'gold' | 'ruby'; amount: number };
  /** 1 for most nodes. */
  maxRanks: number;
  /** Node ids that must each be owned at rank ≥1 before this node unlocks. */
  requires: string[];
  /** 'subclass' — buying one node in the group permanently locks the rest. */
  exclusiveGroup?: string;
  /** Set on subclass oath + follow-up nodes. */
  subclass?: SubclassId;
  effect: TreeNodeEffect;
}

const s = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;

export const TREE_NODES: TreeNode[] = [
  {
    id: 'deep-reserves',
    name: 'Deep Reserves',
    description: '+2 max mana per rank',
    cost: { currency: 'gold', amount: 5 },
    maxRanks: 5,
    requires: [],
    effect: { kind: 'bonusMaxMana', amountPerRank: 2 },
  },
  {
    id: 'vigil-oath',
    name: 'Path of the Vigil',
    description:
      `Swear the Vigil oath (locks out the Zealot). Grants ${SPELLS.solemnVigil.name}: ` +
      `heals ${SPELLS.solemnVigil.heal}, costs ${SPELLS.solemnVigil.mana} mana, ` +
      `${s(SPELLS.solemnVigil.castMs)} cast — slow, efficient.`,
    cost: { currency: 'ruby', amount: 1 },
    maxRanks: 1,
    requires: ['deep-reserves'],
    exclusiveGroup: 'subclass',
    subclass: 'vigil',
    effect: { kind: 'grantSpell', spellId: SPELLS.solemnVigil.id },
  },
  {
    id: 'zealot-oath',
    name: 'Path of the Zealot',
    description:
      `Swear the Zealot oath (locks out the Vigil). Grants ${SPELLS.zealousFlare.name}: ` +
      `heals ${SPELLS.zealousFlare.heal}, costs ${SPELLS.zealousFlare.mana} mana, ` +
      `${s(SPELLS.zealousFlare.castMs)} cast — fast, pricey per point.`,
    cost: { currency: 'ruby', amount: 1 },
    maxRanks: 1,
    requires: ['deep-reserves'],
    exclusiveGroup: 'subclass',
    subclass: 'zealot',
    effect: { kind: 'grantSpell', spellId: SPELLS.zealousFlare.id },
  },
  {
    id: 'vigil-patient-vow',
    name: 'Patient Vow',
    description: `Each ${SPELLS.solemnMend.name} arms +1 heal per rank on your next ${SPELLS.solemnVigil.name}.`,
    cost: { currency: 'gold', amount: 3 },
    maxRanks: 3,
    requires: ['vigil-oath'],
    subclass: 'vigil',
    effect: {
      kind: 'synergy',
      triggerSpellId: SPELLS.solemnMend.id,
      buffedSpellId: SPELLS.solemnVigil.id,
      bonusHealPerRank: 1,
    },
  },
  {
    id: 'vigil-measured-devotion',
    name: 'Measured Devotion',
    description: `${SPELLS.solemnVigil.name} casts 1.0s slower and costs 3 less mana.`,
    cost: { currency: 'gold', amount: 4 },
    maxRanks: 1,
    requires: ['vigil-oath'],
    subclass: 'vigil',
    effect: { kind: 'castMod', spellId: SPELLS.solemnVigil.id, castMsDelta: 1000, manaDelta: -3 },
  },
  {
    id: 'zealot-fervent-chain',
    name: 'Fervent Chain',
    description: `Each ${SPELLS.zealousMending.name} arms +1 heal per rank on your next ${SPELLS.zealousFlare.name}.`,
    cost: { currency: 'gold', amount: 3 },
    maxRanks: 3,
    requires: ['zealot-oath'],
    subclass: 'zealot',
    effect: {
      kind: 'synergy',
      triggerSpellId: SPELLS.zealousMending.id,
      buffedSpellId: SPELLS.zealousFlare.id,
      bonusHealPerRank: 1,
    },
  },
  {
    id: 'zealot-desperate-zeal',
    name: 'Desperate Zeal',
    description: `${SPELLS.zealousFlare.name} heals +1 per full 10% of the target's missing health.`,
    cost: { currency: 'gold', amount: 4 },
    maxRanks: 1,
    requires: ['zealot-oath'],
    subclass: 'zealot',
    effect: { kind: 'missingHealthBonus', spellId: SPELLS.zealousFlare.id, healPer10PctMissingPerRank: 1 },
  },
];

export function treeNodeById(id: string): TreeNode | undefined {
  return TREE_NODES.find((n) => n.id === id);
}
