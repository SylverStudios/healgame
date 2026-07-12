/**
 * Live spell-tree config + combat resolve (new tree service).
 *
 * Layout mirrors the phase-2 tree in data/tree.ts:
 *   Deep Reserves (×5 chain) → Vigil | Zealot oaths (exclusive) → follow-ups.
 *
 * Multi-rank nodes are spot chains (one purchase = one content entry).
 * Combat never sees the graph — call `combatModsFromTree` (or
 * `resolveCombatMods` on `ownedContents`) at fight start.
 */

import { SPELLS } from './constants';
import { spellById } from './spells';
import type {
  SpellDef,
  SynergyRule,
  MissingHealthBonusRule,
  MissingHealthPctBonusRule,
  FullHealthBonusRule,
} from '../combat/types';
import type { SubclassId } from '../save/save';
import {
  create,
  ownedContents,
  snapshot,
  validateConfig,
  type NodeDef,
  type SpotDef,
  type TreeConfig,
  type TreeState,
} from '../tree';

const s = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;

/** Gameplay effect carried in node content — tree service never reads this. */
export type SpellTreeEffect =
  | { kind: 'bonusMaxMana'; amount: number }
  | { kind: 'grantSpell'; spellId: string }
  | { kind: 'synergy'; triggerSpellId: string; buffedSpellId: string; bonusHeal: number }
  | { kind: 'missingHealthBonus'; spellId: string; healPer10PctMissing: number }
  | { kind: 'missingHealthPctBonus'; spellId: string; pctPer10PctMissing: number }
  | { kind: 'fullHealthBonus'; spellId: string; hpPctAtLeast: number; bonusHeal: number }
  | { kind: 'castMod'; spellId: string; castMsDelta: number; manaDelta: number }
  | { kind: 'combatPace'; multiplierTenths: number };

/** Opaque-to-tree payload: display + effect (+ optional subclass tag for oaths). */
export interface SpellTreeContent {
  name: string;
  description: string;
  effect: SpellTreeEffect;
  subclass?: SubclassId;
}

/** Flat combat-facing mods — same shape as meta/progression `Loadout` minus coupling. */
export interface CombatMods {
  spells: SpellDef[];
  bonusMaxMana: number;
  synergies: SynergyRule[];
  missingHealthBonuses: MissingHealthBonusRule[];
  /** Alpha 0.1 §D4 Graven Scale: percent-of-base-heal missing-health bonus. */
  missingHealthPctBonuses: MissingHealthPctBonusRule[];
  /** Alpha 0.1 §D4 Steady Hands: bonus heal when target is at/above a health threshold. */
  fullHealthBonuses: FullHealthBonusRule[];
  /** Sorted unique pace multipliers (tenths); always includes 10; adds 15 when tempo owned. */
  paceMultipliersTenths: number[];
}

function content(c: SpellTreeContent): SpellTreeContent {
  return c;
}

/** Build N identical-effect rank nodes + one spot chain (costs may vary per rank). */
function rankSpot(args: {
  spotId: string;
  idPrefix: string;
  ranks: number;
  costs: { currency: string; amount: number }[];
  requiresFirst?: NodeDef['requires'];
  exclusiveGroup?: string;
  contentForRank: (rank: number) => SpellTreeContent;
}): { nodes: NodeDef[]; spot: SpotDef } {
  const nodes: NodeDef[] = [];
  const chain: string[] = [];
  for (let rank = 1; rank <= args.ranks; rank++) {
    const id = args.ranks === 1 ? args.idPrefix : `${args.idPrefix}-${rank}`;
    chain.push(id);
    const cost = args.costs[rank - 1] ?? args.costs[args.costs.length - 1]!;
    const node: NodeDef = {
      id,
      content: content(args.contentForRank(rank)),
      cost: { ...cost },
    };
    if (rank === 1 && args.requiresFirst !== undefined) node.requires = args.requiresFirst;
    if (args.exclusiveGroup !== undefined) node.exclusiveGroup = args.exclusiveGroup;
    nodes.push(node);
  }
  return { nodes, spot: { id: args.spotId, chain } };
}

const deepReserves = rankSpot({
  spotId: 'deep-reserves',
  idPrefix: 'deep-reserves',
  ranks: 5,
  costs: Array.from({ length: 5 }, () => ({ currency: 'gold', amount: 5 })),
  contentForRank: () => ({
    name: 'Deep Reserves',
    description: '+5 max mana per rank',
    effect: { kind: 'bonusMaxMana', amount: 5 },
  }),
});

const vigilOath: NodeDef = {
  id: 'vigil-oath',
  exclusiveGroup: 'subclass',
  requires: { mode: 'all', nodes: ['deep-reserves-1'] },
  cost: { currency: 'ruby', amount: 1 },
  content: content({
    name: 'Path of the Vigil',
    description:
      `Swear the Vigil oath (locks out the Zealot). Grants ${SPELLS.solemnVigil.name}: ` +
      `heals ${SPELLS.solemnVigil.heal}, costs ${SPELLS.solemnVigil.mana} mana, ` +
      `${s(SPELLS.solemnVigil.castMs)} cast — slow, efficient.`,
    subclass: 'vigil',
    effect: { kind: 'grantSpell', spellId: SPELLS.solemnVigil.id },
  }),
};

const zealotOath: NodeDef = {
  id: 'zealot-oath',
  exclusiveGroup: 'subclass',
  requires: { mode: 'all', nodes: ['deep-reserves-1'] },
  cost: { currency: 'ruby', amount: 1 },
  content: content({
    name: 'Path of the Zealot',
    description:
      `Swear the Zealot oath (locks out the Vigil). Grants ${SPELLS.zealousFlare.name}: ` +
      `heals ${SPELLS.zealousFlare.heal}, costs ${SPELLS.zealousFlare.mana} mana, ` +
      `${s(SPELLS.zealousFlare.castMs)} cast — fast, pricey per point.`,
    subclass: 'zealot',
    effect: { kind: 'grantSpell', spellId: SPELLS.zealousFlare.id },
  }),
};

const warpedTempoViaVigil: NodeDef = {
  id: 'warped-tempo-via-vigil',
  exclusiveGroup: 'combat-tempo',
  availableIfExclusiveLocked: true,
  requires: { mode: 'all', nodes: ['zealot-oath'] },
  cost: { currency: 'gold', amount: 4 },
  content: content({
    name: 'Warped Tempo',
    description: 'Forsaken gift: unlock 1.5× combat pace (locks the rival consolation).',
    effect: { kind: 'combatPace', multiplierTenths: 15 },
  }),
};

const warpedTempoViaZealot: NodeDef = {
  id: 'warped-tempo-via-zealot',
  exclusiveGroup: 'combat-tempo',
  availableIfExclusiveLocked: true,
  requires: { mode: 'all', nodes: ['vigil-oath'] },
  cost: { currency: 'gold', amount: 4 },
  content: content({
    name: 'Warped Tempo',
    description: 'Forsaken gift: unlock 1.5× combat pace (locks the rival consolation).',
    effect: { kind: 'combatPace', multiplierTenths: 15 },
  }),
};

const patientVow = rankSpot({
  spotId: 'vigil-patient-vow',
  idPrefix: 'vigil-patient-vow',
  ranks: 3,
  costs: Array.from({ length: 3 }, () => ({ currency: 'gold', amount: 3 })),
  requiresFirst: { mode: 'all', nodes: ['vigil-oath'] },
  contentForRank: () => ({
    name: 'Patient Vow',
    description: `Each ${SPELLS.solemnMend.name} arms +1 heal per rank on your next ${SPELLS.solemnVigil.name}.`,
    subclass: 'vigil',
    effect: {
      kind: 'synergy',
      triggerSpellId: SPELLS.solemnMend.id,
      buffedSpellId: SPELLS.solemnVigil.id,
      bonusHeal: 1,
    },
  }),
});

const measuredDevotion: NodeDef = {
  id: 'vigil-measured-devotion',
  requires: { mode: 'all', nodes: ['vigil-oath'] },
  cost: { currency: 'gold', amount: 4 },
  content: content({
    name: 'Measured Devotion',
    description: `${SPELLS.solemnVigil.name} casts 1.0s slower and costs 3 less mana.`,
    subclass: 'vigil',
    effect: {
      kind: 'castMod',
      spellId: SPELLS.solemnVigil.id,
      castMsDelta: 1000,
      manaDelta: -3,
    },
  }),
};

const ferventChain = rankSpot({
  spotId: 'zealot-fervent-chain',
  idPrefix: 'zealot-fervent-chain',
  ranks: 3,
  costs: Array.from({ length: 3 }, () => ({ currency: 'gold', amount: 3 })),
  requiresFirst: { mode: 'all', nodes: ['zealot-oath'] },
  contentForRank: () => ({
    name: 'Fervent Chain',
    description: `Each ${SPELLS.zealousMending.name} arms +1 heal per rank on your next ${SPELLS.zealousFlare.name}.`,
    subclass: 'zealot',
    effect: {
      kind: 'synergy',
      triggerSpellId: SPELLS.zealousMending.id,
      buffedSpellId: SPELLS.zealousFlare.id,
      bonusHeal: 1,
    },
  }),
});

/**
 * Alpha 0.1 §D4: `zealot-desperate-zeal` (Zealous Flare flat missing-health
 * bonus) is retired — the missing-health identity moves to Vigil's
 * `vigil-graven-scale` (percent-of-base-heal). `zealot-steady-hands` takes
 * this node's slot in the branch structure (same prereq: zealot-oath).
 * Legacy saves that still own the retired node are refunded its gold cost on
 * load — see `RETIRED_NODE_REFUNDS` / `ownedIdsFromLegacyRanks` below.
 */
const RETIRED_ZEALOT_DESPERATE_ZEAL_ID = 'zealot-desperate-zeal';

const gravenScale: NodeDef = {
  id: 'vigil-graven-scale',
  requires: { mode: 'all', nodes: ['vigil-patient-vow-1'] },
  cost: { currency: 'gold', amount: 5 },
  content: content({
    name: 'Graven Scale',
    description: `${SPELLS.solemnVigil.name}: +5% of base heal per 10% target health missing (rounds up)`,
    subclass: 'vigil',
    effect: {
      kind: 'missingHealthPctBonus',
      spellId: SPELLS.solemnVigil.id,
      pctPer10PctMissing: 5,
    },
  }),
};

const steadyHands: NodeDef = {
  id: 'zealot-steady-hands',
  requires: { mode: 'all', nodes: ['zealot-oath'] },
  cost: { currency: 'gold', amount: 5 },
  content: content({
    name: 'Steady Hands',
    description: `${SPELLS.zealousMending.name}: +1 heal when the target is at 80%+ health`,
    subclass: 'zealot',
    effect: {
      kind: 'fullHealthBonus',
      spellId: SPELLS.zealousMending.id,
      hpPctAtLeast: 80,
      bonusHeal: 1,
    },
  }),
};

/** Authoritative spell-tree config for the new service. */
export const SPELL_TREE: TreeConfig = {
  nodes: [
    ...deepReserves.nodes,
    vigilOath,
    zealotOath,
    warpedTempoViaVigil,
    warpedTempoViaZealot,
    ...patientVow.nodes,
    measuredDevotion,
    gravenScale,
    ...ferventChain.nodes,
    steadyHands,
  ],
  spots: [
    deepReserves.spot,
    { id: 'vigil-oath', chain: ['vigil-oath', 'warped-tempo-via-vigil'] },
    { id: 'zealot-oath', chain: ['zealot-oath', 'warped-tempo-via-zealot'] },
    patientVow.spot,
    { id: 'vigil-measured-devotion', chain: ['vigil-measured-devotion'] },
    { id: 'vigil-graven-scale', chain: ['vigil-graven-scale'] },
    ferventChain.spot,
    { id: 'zealot-steady-hands', chain: ['zealot-steady-hands'] },
  ],
};

const configError = validateConfig(SPELL_TREE);
if (configError) {
  throw new Error(`SPELL_TREE invalid: ${configError.message}`);
}

/**
 * Reduce owned tree contents into combat mods. Order/position in the tree do
 * not matter — only which contents are active. `castMod` is baked into spell
 * defs here so the engine never sees it.
 */
export function resolveCombatMods(
  contents: readonly SpellTreeContent[],
  unlockedSpellIds: readonly string[],
): CombatMods {
  const spellIds = [...unlockedSpellIds];
  let bonusMaxMana = 0;
  const synergyMap = new Map<string, SynergyRule>();
  const missingMap = new Map<string, MissingHealthBonusRule>();
  const missingPctMap = new Map<string, MissingHealthPctBonusRule>();
  const fullHealthMap = new Map<string, FullHealthBonusRule>();
  const castMods: Extract<SpellTreeEffect, { kind: 'castMod' }>[] = [];
  const paceTenths = new Set<number>([10]);

  for (const { effect } of contents) {
    switch (effect.kind) {
      case 'bonusMaxMana':
        bonusMaxMana += effect.amount;
        break;
      case 'grantSpell':
        if (!spellIds.includes(effect.spellId)) spellIds.push(effect.spellId);
        break;
      case 'synergy': {
        const key = `${effect.triggerSpellId}>${effect.buffedSpellId}`;
        const prev = synergyMap.get(key);
        if (prev) prev.bonusHeal += effect.bonusHeal;
        else {
          synergyMap.set(key, {
            triggerSpellId: effect.triggerSpellId,
            buffedSpellId: effect.buffedSpellId,
            bonusHeal: effect.bonusHeal,
          });
        }
        break;
      }
      case 'missingHealthBonus': {
        const prev = missingMap.get(effect.spellId);
        if (prev) prev.healPer10PctMissing += effect.healPer10PctMissing;
        else {
          missingMap.set(effect.spellId, {
            spellId: effect.spellId,
            healPer10PctMissing: effect.healPer10PctMissing,
          });
        }
        break;
      }
      case 'missingHealthPctBonus': {
        const prev = missingPctMap.get(effect.spellId);
        if (prev) prev.pctPer10PctMissing += effect.pctPer10PctMissing;
        else {
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
        if (prev) prev.bonusHeal += effect.bonusHeal;
        else {
          fullHealthMap.set(key, {
            spellId: effect.spellId,
            hpPctAtLeast: effect.hpPctAtLeast,
            bonusHeal: effect.bonusHeal,
          });
        }
        break;
      }
      case 'castMod':
        castMods.push(effect);
        break;
      case 'combatPace':
        paceTenths.add(effect.multiplierTenths);
        break;
    }
  }

  const spells = spellIds
    .map((id) => spellById(id))
    .filter((spell): spell is SpellDef => spell !== undefined)
    .map((spell) => ({ ...spell }));

  for (const mod of castMods) {
    const spell = spells.find((sp) => sp.id === mod.spellId);
    if (spell) {
      spell.castMs = Math.max(0, spell.castMs + mod.castMsDelta);
      spell.mana = Math.max(0, spell.mana + mod.manaDelta);
    }
  }

  return {
    spells,
    bonusMaxMana,
    synergies: [...synergyMap.values()],
    missingHealthBonuses: [...missingMap.values()],
    missingHealthPctBonuses: [...missingPctMap.values()],
    fullHealthBonuses: [...fullHealthMap.values()],
    paceMultipliersTenths: [...paceTenths].sort((a, b) => a - b),
  };
}

/**
 * Fight-start helper: opaque tree state → combat mods.
 * Callers that only have a save should use `loadoutFromSave`.
 */
export function combatModsFromTree(
  state: TreeState,
  unlockedSpellIds: readonly string[],
): CombatMods {
  return resolveCombatMods(ownedContents<SpellTreeContent>(SPELL_TREE, state), unlockedSpellIds);
}

/**
 * Canonical combat entry point: save → tree state → flat CombatMods.
 * Hub / tutorial / balance bots call this at fight start; the engine never
 * sees the skill-tree graph.
 */
export function loadoutFromSave(save: {
  treeRanks: Record<string, number>;
  unlockedSpells: readonly string[];
  gold?: number;
  rubies?: number;
}): CombatMods {
  const state = treeStateFromLegacy(save.treeRanks, {
    gold: save.gold ?? 0,
    ruby: save.rubies ?? 0,
  });
  return combatModsFromTree(state, save.unlockedSpells);
}

/**
 * Gold refunded per retired-from-the-live-tree node still present in a save's
 * `treeRanks` (Alpha 0.1 §D4: `zealot-desperate-zeal` removed — mirrors the
 * v1→v2 `RETIRED_V1_NODES` refund pattern in `save/save.ts`, but recomputed
 * from `treeRanks` on every load rather than a one-time migration, since the
 * save version itself hasn't changed). Amount matches the node's old cost.
 */
const RETIRED_NODE_REFUNDS: Readonly<Record<string, number>> = {
  [RETIRED_ZEALOT_DESPERATE_ZEAL_ID]: 4,
};

/** Total gold owed back for retired node ids still present in legacy `treeRanks`. */
function retiredNodeGoldRefund(treeRanks: Record<string, number>): number {
  let refund = 0;
  for (const [id, amount] of Object.entries(RETIRED_NODE_REFUNDS)) {
    if ((treeRanks[id] ?? 0) > 0) refund += amount;
  }
  return refund;
}

/**
 * Map legacy `treeRanks` (nodeId → ranks) onto owned chain node ids for the
 * new config. Used by parity tests and (later) save migration. Retired node
 * ids (e.g. `zealot-desperate-zeal`) are never emitted — they no longer exist
 * in `SPELL_TREE` and `create()` throws on unknown owned ids; their gold is
 * refunded separately via `retiredNodeGoldRefund` in `treeStateFromLegacy`.
 */
export function ownedIdsFromLegacyRanks(treeRanks: Record<string, number>): string[] {
  const owned: string[] = [];
  const pushRanks = (prefix: string, ranks: number, max: number): void => {
    const n = Math.min(Math.max(0, ranks), max);
    for (let i = 1; i <= n; i++) owned.push(max === 1 ? prefix : `${prefix}-${i}`);
  };

  pushRanks('deep-reserves', treeRanks['deep-reserves'] ?? 0, 5);
  if ((treeRanks['vigil-oath'] ?? 0) > 0) owned.push('vigil-oath');
  if ((treeRanks['zealot-oath'] ?? 0) > 0) owned.push('zealot-oath');
  pushRanks('vigil-patient-vow', treeRanks['vigil-patient-vow'] ?? 0, 3);
  if ((treeRanks['vigil-measured-devotion'] ?? 0) > 0) owned.push('vigil-measured-devotion');
  if ((treeRanks['vigil-graven-scale'] ?? 0) > 0) owned.push('vigil-graven-scale');
  pushRanks('zealot-fervent-chain', treeRanks['zealot-fervent-chain'] ?? 0, 3);
  if ((treeRanks['zealot-steady-hands'] ?? 0) > 0) owned.push('zealot-steady-hands');
  if ((treeRanks['warped-tempo-via-vigil'] ?? 0) > 0) owned.push('warped-tempo-via-vigil');
  if ((treeRanks['warped-tempo-via-zealot'] ?? 0) > 0) owned.push('warped-tempo-via-zealot');
  return owned;
}

/**
 * Build opaque tree state from a legacy save-shaped ranks map + wallet.
 * Adds any retired-node gold refund to the wallet on the way in (Alpha 0.1
 * §D4) — once a save persists a purchase, `legacyRanksFromOwned` no longer
 * emits the retired id, so the refund is not re-applied on the next load.
 */
export function treeStateFromLegacy(
  treeRanks: Record<string, number>,
  wallet: { gold: number; ruby: number },
): TreeState {
  const refundedWallet = { ...wallet, gold: wallet.gold + retiredNodeGoldRefund(treeRanks) };
  return create(SPELL_TREE, refundedWallet, ownedIdsFromLegacyRanks(treeRanks));
}

const MULTI_RANK_PREFIXES: { prefix: string; max: number }[] = [
  { prefix: 'deep-reserves', max: 5 },
  { prefix: 'vigil-patient-vow', max: 3 },
  { prefix: 'zealot-fervent-chain', max: 3 },
];

const SINGLE_NODES = [
  'vigil-oath',
  'zealot-oath',
  'vigil-measured-devotion',
  'vigil-graven-scale',
  'zealot-steady-hands',
  'warped-tempo-via-vigil',
  'warped-tempo-via-zealot',
] as const;

/**
 * Inverse of `ownedIdsFromLegacyRanks` — write tree service owned ids back into
 * the save's `treeRanks` shape for persistence (combat reads via loadoutFromSave).
 */
export function legacyRanksFromOwned(owned: readonly string[]): Record<string, number> {
  const ranks: Record<string, number> = {};
  const ownedSet = new Set(owned);

  for (const { prefix, max } of MULTI_RANK_PREFIXES) {
    let n = 0;
    for (let i = 1; i <= max; i++) {
      if (ownedSet.has(`${prefix}-${i}`)) n = i;
    }
    if (n > 0) ranks[prefix] = n;
  }
  for (const id of SINGLE_NODES) {
    if (ownedSet.has(id)) ranks[id] = 1;
  }
  return ranks;
}

/** Push opaque tree state into SaveData currencies + treeRanks + subclass. */
export function applyTreeStateToSave(
  save: { gold: number; rubies: number; treeRanks: Record<string, number>; subclass: SubclassId | null },
  state: TreeState,
): void {
  const snap = snapshot(state);
  save.gold = snap.wallet['gold'] ?? 0;
  save.rubies = snap.wallet['ruby'] ?? 0;
  save.treeRanks = legacyRanksFromOwned(snap.owned);

  if (snap.owned.includes('vigil-oath')) save.subclass = 'vigil';
  else if (snap.owned.includes('zealot-oath')) save.subclass = 'zealot';
  else save.subclass = null;
}
