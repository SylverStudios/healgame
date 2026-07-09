/**
 * Pure meta-progression logic (poc-spec §5/§8, phase-2-handoff "Loadout") —
 * no Phaser. Scenes call these functions and immediately persist the mutated
 * SaveData via saveGame(); this module never touches storage itself.
 */

import { levelForXp, REWARDS, SPELLS } from '../data/constants';
import { spellById } from '../data/spells';
import { TREE_NODES, treeNodeById } from '../data/tree';
import type { SpellDef } from '../combat/types';
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

/**
 * The cross-boundary loadout type (phase-2-handoff, pinned). `spells` are
 * RESOLVED defs — castMod tree nodes are already applied to castMs/mana, so
 * neither the engine nor the combat view ever sees castMod.
 */
export interface Loadout {
  spells: SpellDef[];
  bonusMaxMana: number;
  synergies: { triggerSpellId: string; buffedSpellId: string; bonusHeal: number }[];
  missingHealthBonuses: { spellId: string; healPer10PctMissing: number }[];
}

function ranksOf(save: SaveData, nodeId: string): number {
  return save.treeRanks[nodeId] ?? 0;
}

/** Builds the resolved Loadout for the current save (unlocked + tree-granted spells, effects applied). */
export function buildLoadout(save: SaveData): Loadout {
  const loadout: Loadout = { spells: [], bonusMaxMana: 0, synergies: [], missingHealthBonuses: [] };

  // Base list: XP-unlocked spells in unlock order, then tree-granted spells in
  // tree order. Cloned so castMod resolution never mutates the data catalog.
  const spellIds = [...save.unlockedSpells];
  for (const node of TREE_NODES) {
    if (node.effect.kind === 'grantSpell' && ranksOf(save, node.id) > 0 && !spellIds.includes(node.effect.spellId)) {
      spellIds.push(node.effect.spellId);
    }
  }
  loadout.spells = spellIds
    .map((id) => spellById(id))
    .filter((spell): spell is SpellDef => spell !== undefined)
    .map((spell) => ({ ...spell }));

  for (const node of TREE_NODES) {
    const ranks = ranksOf(save, node.id);
    if (ranks <= 0) continue;
    const effect = node.effect;
    switch (effect.kind) {
      case 'bonusMaxMana':
        loadout.bonusMaxMana += effect.amountPerRank * ranks;
        break;
      case 'synergy':
        loadout.synergies.push({
          triggerSpellId: effect.triggerSpellId,
          buffedSpellId: effect.buffedSpellId,
          bonusHeal: effect.bonusHealPerRank * ranks,
        });
        break;
      case 'missingHealthBonus':
        loadout.missingHealthBonuses.push({
          spellId: effect.spellId,
          healPer10PctMissing: effect.healPer10PctMissingPerRank * ranks,
        });
        break;
      case 'castMod': {
        const spell = loadout.spells.find((sp) => sp.id === effect.spellId);
        if (spell) {
          spell.castMs = Math.max(0, spell.castMs + effect.castMsDelta * ranks);
          spell.mana = Math.max(0, spell.mana + effect.manaDelta * ranks);
        }
        break;
      }
      case 'grantSpell':
        break; // already handled above
    }
  }

  return loadout;
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
 * Buys one rank of a spell-tree node. Fails (returns false, no mutation) if
 * the node is unknown, maxed, prereq-gated, exclusive-locked, or
 * unaffordable in its currency. On success, mutates `save` (currency spent,
 * rank recorded; a subclass oath node also sets save.subclass) and returns
 * true; caller saveGame()s.
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

/** Dungeon 2 ("The Maw") unlocks after Ash Gate's first clear (poc-spec §7). */
export function isDungeon2Unlocked(save: SaveData): boolean {
  return save.clearedDungeons.includes('ash-gate');
}
