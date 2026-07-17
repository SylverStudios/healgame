/**
 * Live talent-tree config + combat resolve (new tree service).
 *
 * Alpha 0.2: hourglass topology
 *   Deep Reserves (×3 chain) → Vigil | Zealot oaths (exclusive) → branch
 *   follow-ups → layer-2 output → [shared mid: mend/zealous potency] →
 *   Vowstrike fork (light/dark, exclusive) → shared crown
 *   (Wrath Ascendant + Vowbound Crown).
 *
 * Multi-rank nodes are spot chains (one purchase = one content entry).
 * Combat never sees the graph — call `combatModsFromTree` (or
 * `resolveCombatMods` on `ownedContents`) at fight start.
 */

import { SPELLS, levelForXp } from './constants';
import { manaBonusesForLevel } from './levelMana';
import { spellById } from './spells';
import { STILL_WATERS, FRENZIED_LITURGY, cooldownById } from './cooldowns';
import type {
  SpellDef,
  SynergyRule,
  MissingHealthBonusRule,
  MissingHealthPctBonusRule,
  FullHealthBonusRule,
  CooldownDef,
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
export type TalentTreeEffect =
  | { kind: 'bonusMaxMana'; amount: number }
  | { kind: 'grantSpell'; spellId: string }
  | { kind: 'synergy'; triggerSpellId: string; buffedSpellId: string; bonusHeal: number }
  | { kind: 'missingHealthBonus'; spellId: string; healPer10PctMissing: number }
  | { kind: 'missingHealthPctBonus'; spellId: string; pctPer10PctMissing: number }
  | { kind: 'fullHealthBonus'; spellId: string; hpPctAtLeast: number; bonusHeal: number }
  | { kind: 'castMod'; spellId: string; castMsDelta: number; manaDelta: number; healDelta?: number }
  | { kind: 'combatPace'; multiplierTenths: number }
  | { kind: 'grantCooldown'; cooldownId: string }
  /**
   * Alpha 0.2 §D6 crown amp: after spells are baked, add `healDelta` and/or
   * `damageDelta` to every outgoing spell whose id appears in `spellIds`
   * (only spells already owned are affected; unknown ids are skipped).
   */
  | { kind: 'ampOwnedSpells'; spellIds: string[]; healDelta?: number; damageDelta?: number };

/** Opaque-to-tree payload: display + effect (+ optional subclass tag for oaths). */
export interface TalentTreeContent {
  name: string;
  description: string;
  effect: TalentTreeEffect;
  subclass?: SubclassId;
  /** Alpha 0.2 §D8 — single-char placeholder glyph for tree node display. */
  glyph?: string;
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
  /** Alpha 0.1 §D6: cooldowns granted by the tree (e.g. Still Waters, Frenzied Liturgy). */
  cooldowns: CooldownDef[];
  /** Alpha 0.2 §D2: combat mana regen from level (or future sources). Absent at level 1. */
  manaRegen?: { amount: number; intervalMs: number };
}

function content(c: TalentTreeContent): TalentTreeContent {
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
  exclusiveGroupFirst?: string;
  contentForRank: (rank: number) => TalentTreeContent;
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
    if (rank === 1 && args.exclusiveGroupFirst !== undefined) node.exclusiveGroup = args.exclusiveGroupFirst;
    nodes.push(node);
  }
  return { nodes, spot: { id: args.spotId, chain } };
}

// ---------------------------------------------------------------------------
// Shared early
// ---------------------------------------------------------------------------

/** Deep Reserves: 3 ranks (was 5), +6 max mana each. Rank ids: deep-reserves-1..3. */
const deepReserves = rankSpot({
  spotId: 'deep-reserves',
  idPrefix: 'deep-reserves',
  ranks: 3,
  costs: Array.from({ length: 3 }, () => ({ currency: 'talent', amount: 1 })),
  contentForRank: () => ({
    name: 'Deep Reserves',
    description: '+6 max mana per rank',
    glyph: 'R',
    effect: { kind: 'bonusMaxMana', amount: 6 },
  }),
});

// ---------------------------------------------------------------------------
// Oath wedge (existing, trimmed)
// ---------------------------------------------------------------------------

const vigilOath: NodeDef = {
  id: 'vigil-oath',
  exclusiveGroup: 'subclass',
  requires: { mode: 'all', nodes: ['deep-reserves-1'] },
  cost: { currency: 'talent', amount: 1 },
  content: content({
    name: 'Path of the Vigil',
    description: 'Swear the Vigil oath (locks out the Zealot). Grants a slow, efficient heal.',
    glyph: 'G',
    subclass: 'vigil',
    effect: { kind: 'grantSpell', spellId: SPELLS.solemnVigil.id },
  }),
};

const zealotOath: NodeDef = {
  id: 'zealot-oath',
  exclusiveGroup: 'subclass',
  requires: { mode: 'all', nodes: ['deep-reserves-1'] },
  cost: { currency: 'talent', amount: 1 },
  content: content({
    name: 'Path of the Zealot',
    description: 'Swear the Zealot oath (locks out the Vigil). Grants a fast, pricey panic heal.',
    glyph: 'F',
    subclass: 'zealot',
    effect: { kind: 'grantSpell', spellId: SPELLS.zealousFlare.id },
  }),
};

const warpedTempoViaVigil: NodeDef = {
  id: 'warped-tempo-via-vigil',
  exclusiveGroup: 'combat-tempo',
  availableIfExclusiveLocked: true,
  requires: { mode: 'all', nodes: ['zealot-oath'] },
  cost: { currency: 'talent', amount: 1 },
  content: content({
    name: 'Warped Tempo',
    description: 'Forsaken gift: unlock 1.5× combat pace (locks the rival consolation).',
    glyph: 'A',
    effect: { kind: 'combatPace', multiplierTenths: 15 },
  }),
};

const warpedTempoViaZealot: NodeDef = {
  id: 'warped-tempo-via-zealot',
  exclusiveGroup: 'combat-tempo',
  availableIfExclusiveLocked: true,
  requires: { mode: 'all', nodes: ['vigil-oath'] },
  cost: { currency: 'talent', amount: 1 },
  content: content({
    name: 'Warped Tempo',
    description: 'Forsaken gift: unlock 1.5× combat pace (locks the rival consolation).',
    glyph: 'A',
    effect: { kind: 'combatPace', multiplierTenths: 15 },
  }),
};

const VIGIL_SPECIALIZATION_GROUP = 'vigil-specialization';

const patientVow = rankSpot({
  spotId: 'vigil-patient-vow',
  idPrefix: 'vigil-patient-vow',
  ranks: 3,
  costs: Array.from({ length: 3 }, () => ({ currency: 'talent', amount: 1 })),
  requiresFirst: { mode: 'all', nodes: ['vigil-oath'] },
  exclusiveGroupFirst: VIGIL_SPECIALIZATION_GROUP,
  contentForRank: () => ({
    name: 'Patient Vow',
    description: `Power path: each ${SPELLS.solemnMend.name} arms +2 heal per rank on your next ${SPELLS.solemnVigil.name}. Locks Measured Devotion.`,
    glyph: 'P',
    subclass: 'vigil',
    effect: {
      kind: 'synergy',
      triggerSpellId: SPELLS.solemnMend.id,
      buffedSpellId: SPELLS.solemnVigil.id,
      bonusHeal: 2,
    },
  }),
});

const measuredDevotion: NodeDef = {
  id: 'vigil-measured-devotion',
  exclusiveGroup: VIGIL_SPECIALIZATION_GROUP,
  requires: { mode: 'all', nodes: ['vigil-oath'] },
  cost: { currency: 'talent', amount: 1 },
  content: content({
    name: 'Measured Devotion',
    description: `Efficiency path: ${SPELLS.solemnVigil.name} casts 1.0s slower and costs 3 less mana. Locks Patient Vow.`,
    glyph: 'D',
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
  costs: Array.from({ length: 3 }, () => ({ currency: 'talent', amount: 1 })),
  requiresFirst: { mode: 'all', nodes: ['zealot-oath'] },
  contentForRank: () => ({
    name: 'Fervent Chain',
    description: `Each ${SPELLS.zealousMending.name} arms +2 heal per rank on your next ${SPELLS.zealousFlare.name}.`,
    glyph: 'E',
    subclass: 'zealot',
    effect: {
      kind: 'synergy',
      triggerSpellId: SPELLS.zealousMending.id,
      buffedSpellId: SPELLS.zealousFlare.id,
      bonusHeal: 2,
    },
  }),
});

/**
 * Alpha 0.1 §D4: `zealot-desperate-zeal` (Zealous Flare flat missing-health
 * bonus) is retired — the missing-health identity moves to Vigil's
 * `vigil-graven-scale` (percent-of-base-heal). `zealot-steady-hands` takes
 * this node's slot in the branch structure (same prereq: zealot-oath).
 * Legacy saves that still own the retired node simply omit it during migration.
 */
const gravenScale: NodeDef = {
  id: 'vigil-graven-scale',
  requires: { mode: 'all', nodes: ['vigil-patient-vow-1'] },
  cost: { currency: 'talent', amount: 1 },
  content: content({
    name: 'Graven Scale',
    description: `${SPELLS.solemnVigil.name}: +5% of base heal per 10% target health missing (rounds up)`,
    glyph: 'K',
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
  cost: { currency: 'talent', amount: 1 },
  content: content({
    name: 'Steady Hands',
    description: `${SPELLS.zealousMending.name}: +2 heal when the target is at 80%+ health`,
    glyph: 'H',
    subclass: 'zealot',
    effect: {
      kind: 'fullHealthBonus',
      spellId: SPELLS.zealousMending.id,
      hpPctAtLeast: 80,
      bonusHeal: 2,
    },
  }),
};

/**
 * Alpha 0.1 §D5 / Alpha 0.2: layer-2 output nodes. Each requires owning at
 * least one existing branch node — `mode: 'any'` — so either follow-up path
 * into that branch unlocks it.
 *
 * Pure-mana nodes (vigil-deep-well, zealot-spendthrift-grace) are cut in
 * Alpha 0.2; only output/tempo nodes remain.
 */
const VIGIL_LAYER2_REQUIRES: NodeDef['requires'] = {
  mode: 'any',
  nodes: ['vigil-patient-vow-1', 'vigil-measured-devotion'],
};

const ZEALOT_LAYER2_REQUIRES: NodeDef['requires'] = {
  mode: 'any',
  nodes: ['zealot-fervent-chain-1', 'zealot-steady-hands'],
};

const vigilThrift: NodeDef = {
  id: 'vigil-thrift',
  requires: VIGIL_LAYER2_REQUIRES,
  cost: { currency: 'talent', amount: 1 },
  content: content({
    name: 'Thrift',
    description: `${SPELLS.solemnMend.name} costs 1 less mana (${SPELLS.solemnMend.mana} → ${SPELLS.solemnMend.mana - 1})`,
    glyph: 'T',
    subclass: 'vigil',
    effect: {
      kind: 'castMod',
      spellId: SPELLS.solemnMend.id,
      castMsDelta: 0,
      manaDelta: -1,
    },
  }),
};

const vigilStillWaters: NodeDef = {
  id: 'vigil-still-waters',
  requires: VIGIL_LAYER2_REQUIRES,
  cost: { currency: 'talent', amount: 1 },
  content: content({
    name: 'Still Waters',
    description: `Grants ${STILL_WATERS.name} (${s(STILL_WATERS.cooldownMs)}): ${STILL_WATERS.description}`,
    glyph: 'S',
    subclass: 'vigil',
    effect: { kind: 'grantCooldown', cooldownId: STILL_WATERS.id },
  }),
};

const zealotQuickBreath: NodeDef = {
  id: 'zealot-quick-breath',
  requires: ZEALOT_LAYER2_REQUIRES,
  cost: { currency: 'talent', amount: 1 },
  content: content({
    name: 'Quick Breath',
    description: `${SPELLS.zealousFlare.name} casts 200ms faster (${s(SPELLS.zealousFlare.castMs)} → ${s(SPELLS.zealousFlare.castMs - 200)})`,
    glyph: 'Q',
    subclass: 'zealot',
    effect: {
      kind: 'castMod',
      spellId: SPELLS.zealousFlare.id,
      castMsDelta: -200,
      manaDelta: 0,
    },
  }),
};

const zealotFrenziedLiturgy: NodeDef = {
  id: 'zealot-frenzied-liturgy',
  requires: ZEALOT_LAYER2_REQUIRES,
  cost: { currency: 'talent', amount: 1 },
  content: content({
    name: 'Frenzied Liturgy',
    description: `Grants ${FRENZIED_LITURGY.name} (${s(FRENZIED_LITURGY.cooldownMs)}): ${FRENZIED_LITURGY.description}`,
    glyph: 'L',
    subclass: 'zealot',
    effect: { kind: 'grantCooldown', cooldownId: FRENZIED_LITURGY.id },
  }),
};

// ---------------------------------------------------------------------------
// Shared mid (Alpha 0.2) — gate: any layer-2 output node (not the specialization
// forks). Keeps Patient Vow / Measured Devotion / Fervent Chain / Steady Hands
// from fanning out to mid + branch options at once.
// ---------------------------------------------------------------------------

const SHARED_MID_REQUIRES: NodeDef['requires'] = {
  mode: 'any',
  nodes: [
    'vigil-thrift',
    'vigil-still-waters',
    'zealot-quick-breath',
    'zealot-frenzied-liturgy',
  ],
};

const sharedMendPotency: NodeDef = {
  id: 'shared-mend-potency',
  requires: SHARED_MID_REQUIRES,
  cost: { currency: 'talent', amount: 1 },
  content: content({
    name: 'Mend Potency',
    description: `${SPELLS.solemnMend.name} heals for 1 more.`,
    glyph: 'm',
    effect: {
      kind: 'castMod',
      spellId: SPELLS.solemnMend.id,
      castMsDelta: 0,
      manaDelta: 0,
      healDelta: 1,
    },
  }),
};

const sharedZealousPotency: NodeDef = {
  id: 'shared-zealous-potency',
  requires: SHARED_MID_REQUIRES,
  cost: { currency: 'talent', amount: 1 },
  content: content({
    name: 'Zealous Potency',
    description: `${SPELLS.zealousMending.name} heals for 1 more.`,
    glyph: 'z',
    effect: {
      kind: 'castMod',
      spellId: SPELLS.zealousMending.id,
      castMsDelta: 0,
      manaDelta: 0,
      healDelta: 1,
    },
  }),
};

// ---------------------------------------------------------------------------
// Vowstrike fork (Alpha 0.2 NEW) — exclusiveGroup: vowstrike-aspect
// ---------------------------------------------------------------------------

const VOWSTRIKE_REQUIRES: NodeDef['requires'] = {
  mode: 'any',
  nodes: ['shared-mend-potency', 'shared-zealous-potency'],
};

const vowstrikeVirtueNode: NodeDef = {
  id: 'vowstrike-virtue',
  exclusiveGroup: 'vowstrike-aspect',
  requires: VOWSTRIKE_REQUIRES,
  cost: { currency: 'talent', amount: 1 },
  content: content({
    name: SPELLS.vowstrikeVirtue.name,
    description: 'Strike, then discount your next spell. Locks Vowstrike: Reckoning.',
    glyph: 'V',
    effect: { kind: 'grantSpell', spellId: SPELLS.vowstrikeVirtue.id },
  }),
};

const vowstrikeVengeanceNode: NodeDef = {
  id: 'vowstrike-vengeance',
  exclusiveGroup: 'vowstrike-aspect',
  requires: VOWSTRIKE_REQUIRES,
  cost: { currency: 'talent', amount: 1 },
  content: content({
    name: SPELLS.vowstrikeVengeance.name,
    description: 'Strike, then empower your next heal. Locks Vowstrike: Absolution.',
    glyph: 'X',
    effect: { kind: 'grantSpell', spellId: SPELLS.vowstrikeVengeance.id },
  }),
};

// ---------------------------------------------------------------------------
// Shared crown (Alpha 0.2 NEW) — requires either Vowstrike aspect
// ---------------------------------------------------------------------------

const CROWN_REQUIRES: NodeDef['requires'] = {
  mode: 'any',
  nodes: ['vowstrike-virtue', 'vowstrike-vengeance'],
};

const wrathAscendantNode: NodeDef = {
  id: 'wrath-ascendant',
  requires: CROWN_REQUIRES,
  cost: { currency: 'talent', amount: 1 },
  content: content({
    name: 'Wrath Ascendant',
    description: 'Grants Wrath Ascendant (45s CD): for 12s, all your heals gain +2. Off-GCD.',
    glyph: 'W',
    effect: { kind: 'grantCooldown', cooldownId: 'wrath-ascendant' },
  }),
};

const vowboundCrownNode: NodeDef = {
  id: 'vowbound-crown',
  requires: CROWN_REQUIRES,
  cost: { currency: 'talent', amount: 1 },
  content: content({
    name: 'Vowbound Crown',
    description: 'Your Vowstrike deals 1 more damage.',
    glyph: 'C',
    effect: {
      kind: 'ampOwnedSpells',
      spellIds: [SPELLS.vowstrikeVirtue.id, SPELLS.vowstrikeVengeance.id],
      damageDelta: 1,
    },
  }),
};

// ---------------------------------------------------------------------------
// Authoritative config
// ---------------------------------------------------------------------------

/** Authoritative talent-tree config for the new service. */
export const TALENT_TREE: TreeConfig = {
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
    vigilThrift,
    vigilStillWaters,
    zealotQuickBreath,
    zealotFrenziedLiturgy,
    sharedMendPotency,
    sharedZealousPotency,
    vowstrikeVirtueNode,
    vowstrikeVengeanceNode,
    wrathAscendantNode,
    vowboundCrownNode,
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
    { id: 'vigil-thrift', chain: ['vigil-thrift'] },
    { id: 'vigil-still-waters', chain: ['vigil-still-waters'] },
    { id: 'zealot-quick-breath', chain: ['zealot-quick-breath'] },
    { id: 'zealot-frenzied-liturgy', chain: ['zealot-frenzied-liturgy'] },
    { id: 'shared-mend-potency', chain: ['shared-mend-potency'] },
    { id: 'shared-zealous-potency', chain: ['shared-zealous-potency'] },
    { id: 'vowstrike-virtue', chain: ['vowstrike-virtue'] },
    { id: 'vowstrike-vengeance', chain: ['vowstrike-vengeance'] },
    { id: 'wrath-ascendant', chain: ['wrath-ascendant'] },
    { id: 'vowbound-crown', chain: ['vowbound-crown'] },
  ],
};

const configError = validateConfig(TALENT_TREE);
if (configError) {
  throw new Error(`TALENT_TREE invalid: ${configError.message}`);
}

// ---------------------------------------------------------------------------
// Oath × Vowstrike resolve twists (Alpha 0.2 §D5)
// ---------------------------------------------------------------------------

/**
 * After combat mods are assembled and spells are baked, apply one small twist
 * when both an oath and a Vowstrike aspect are owned. The twist is data-driven
 * (modifies the already-constructed mods object in place) so the engine needs
 * no new kinds.
 *
 * | Oath × Aspect      | Twist                                                     |
 * |--------------------|-----------------------------------------------------------|
 * | Vigil × Virtue     | vowstrike-virtue mana −1                                  |
 * | Vigil × Vengeance  | vowstrike-vengeance damage +1, next-heal potency +15      |
 * | Zealot × Virtue    | synergy: trigger vowstrike-virtue → buff zealous-mending +1 |
 * | Zealot × Vengeance | vowstrike-vengeance damage +1                             |
 */
export function applyOathVowstrikeTwists(
  mods: CombatMods,
  contents: readonly TalentTreeContent[],
): void {
  const hasVigil = contents.some(
    (c) =>
      c.subclass === 'vigil' ||
      (c.effect.kind === 'grantSpell' && c.effect.spellId === SPELLS.solemnVigil.id),
  );
  const hasZealot = contents.some(
    (c) =>
      c.subclass === 'zealot' ||
      (c.effect.kind === 'grantSpell' && c.effect.spellId === SPELLS.zealousFlare.id),
  );
  const hasVirtue = mods.spells.some((sp) => sp.id === SPELLS.vowstrikeVirtue.id);
  const hasVengeance = mods.spells.some((sp) => sp.id === SPELLS.vowstrikeVengeance.id);

  if ((!hasVirtue && !hasVengeance) || (!hasVigil && !hasZealot)) return;

  const oath = hasVigil ? 'vigil' : 'zealot';
  const aspect = hasVirtue ? 'virtue' : 'vengeance';

  if (oath === 'vigil' && aspect === 'virtue') {
    const spell = mods.spells.find((sp) => sp.id === SPELLS.vowstrikeVirtue.id);
    if (spell) spell.mana = Math.max(0, spell.mana - 1);
  } else if (oath === 'vigil' && aspect === 'vengeance') {
    const spell = mods.spells.find((sp) => sp.id === SPELLS.vowstrikeVengeance.id);
    if (spell) {
      spell.damage = Math.max(0, (spell.damage ?? 0) + 1);
      // Compensate for losing the old instant-heal Vowstrike on this path:
      // stronger next-heal potency so Vigil×Reckoning stays crown-viable.
      if (spell.castBuff?.kind === 'nextHealPotencyPct') {
        spell.castBuff = { kind: 'nextHealPotencyPct', pct: spell.castBuff.pct + 15 };
      }
    }
  } else if (oath === 'zealot' && aspect === 'virtue') {
    const existing = mods.synergies.find(
      (syn) =>
        syn.triggerSpellId === SPELLS.vowstrikeVirtue.id &&
        syn.buffedSpellId === SPELLS.zealousMending.id,
    );
    if (existing) {
      existing.bonusHeal += 1;
    } else {
      mods.synergies.push({
        triggerSpellId: SPELLS.vowstrikeVirtue.id,
        buffedSpellId: SPELLS.zealousMending.id,
        bonusHeal: 1,
      });
    }
  } else if (oath === 'zealot' && aspect === 'vengeance') {
    const spell = mods.spells.find((sp) => sp.id === SPELLS.vowstrikeVengeance.id);
    if (spell) spell.damage = Math.max(0, (spell.damage ?? 0) + 1);
  }
}

// ---------------------------------------------------------------------------
// Combat resolve
// ---------------------------------------------------------------------------

/**
 * Reduce owned tree contents into combat mods. Order/position in the tree do
 * not matter — only which contents are active. `castMod` (including optional
 * `healDelta`) is baked into spell defs; `ampOwnedSpells` is applied after
 * baking; oath×vowstrike twists are applied last.
 */
export function resolveCombatMods(
  contents: readonly TalentTreeContent[],
  unlockedSpellIds: readonly string[],
): CombatMods {
  const spellIds = [...unlockedSpellIds];
  let bonusMaxMana = 0;
  const synergyMap = new Map<string, SynergyRule>();
  const missingMap = new Map<string, MissingHealthBonusRule>();
  const missingPctMap = new Map<string, MissingHealthPctBonusRule>();
  const fullHealthMap = new Map<string, FullHealthBonusRule>();
  const castMods: Extract<TalentTreeEffect, { kind: 'castMod' }>[] = [];
  const ampSpells: Extract<TalentTreeEffect, { kind: 'ampOwnedSpells' }>[] = [];
  const paceTenths = new Set<number>([10]);
  const cooldownMap = new Map<string, CooldownDef>();

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
      case 'ampOwnedSpells':
        ampSpells.push(effect);
        break;
      case 'combatPace':
        paceTenths.add(effect.multiplierTenths);
        break;
      case 'grantCooldown': {
        // Unknown cooldown ids are ignored, same as unknown spell ids above.
        const def = cooldownById(effect.cooldownId);
        if (def) cooldownMap.set(def.id, def);
        break;
      }
    }
  }

  const spells = spellIds
    .map((id) => spellById(id))
    .filter((spell): spell is SpellDef => spell !== undefined)
    .map((spell) => ({ ...spell }));

  // Bake castMods (castMsDelta, manaDelta, optional healDelta).
  for (const mod of castMods) {
    const spell = spells.find((sp) => sp.id === mod.spellId);
    if (spell) {
      spell.castMs = Math.max(0, spell.castMs + mod.castMsDelta);
      spell.mana = Math.max(0, spell.mana + mod.manaDelta);
      spell.heal = Math.max(0, spell.heal + (mod.healDelta ?? 0));
    }
  }

  // Bake ampOwnedSpells (only spells already in the loadout are affected).
  for (const amp of ampSpells) {
    for (const id of amp.spellIds) {
      const spell = spells.find((sp) => sp.id === id);
      if (!spell) continue;
      if (amp.healDelta) spell.heal = Math.max(0, spell.heal + amp.healDelta);
      if (amp.damageDelta) spell.damage = Math.max(0, (spell.damage ?? 0) + amp.damageDelta);
    }
  }

  const mods: CombatMods = {
    spells,
    bonusMaxMana,
    synergies: [...synergyMap.values()],
    missingHealthBonuses: [...missingMap.values()],
    missingHealthPctBonuses: [...missingPctMap.values()],
    fullHealthBonuses: [...fullHealthMap.values()],
    paceMultipliersTenths: [...paceTenths].sort((a, b) => a - b),
    cooldowns: [...cooldownMap.values()],
  };

  applyOathVowstrikeTwists(mods, contents);
  return mods;
}

/**
 * Fight-start helper: opaque tree state → combat mods.
 * Callers that only have a save should use `loadoutFromSave`.
 */
export function combatModsFromTree(
  state: TreeState,
  unlockedSpellIds: readonly string[],
): CombatMods {
  return resolveCombatMods(ownedContents<TalentTreeContent>(TALENT_TREE, state), unlockedSpellIds);
}

/**
 * Canonical combat entry point: save → tree state → flat CombatMods.
 * Applies level-derived mana bonuses (§D2) on top of tree bonuses.
 * When `actionBar` is present, fight spells follow non-empty bar slots
 * (duplicates allowed); omitted `actionBar` keeps all owned spells (tests/bots).
 * Hub / tutorial / balance bots call this at fight start; the engine never
 * sees the skill-tree graph.
 */
export function loadoutFromSave(save: {
  treeRanks: Record<string, number>;
  unlockedSpells: readonly string[];
  xp?: number;
  actionBar?: readonly string[];
}): CombatMods {
  const state = treeStateFromLegacy(save.treeRanks, 0);
  const mods = combatModsFromTree(state, save.unlockedSpells);
  const level = levelForXp(save.xp ?? 0);
  const levelMana = manaBonusesForLevel(level);
  mods.bonusMaxMana += levelMana.bonusMaxMana;
  if (levelMana.manaRegen !== null) {
    mods.manaRegen = levelMana.manaRegen;
  }
  if (save.actionBar !== undefined && save.actionBar.some((id) => id.length > 0)) {
    mods.spells = spellsFromActionBar(mods.spells, save.actionBar);
  }
  return mods;
}

/**
 * Order (and optionally duplicate) owned spell defs by action-bar slot ids.
 * Empty strings are skipped; unknown ids are skipped.
 */
export function spellsFromActionBar(
  owned: readonly SpellDef[],
  actionBar: readonly string[],
): SpellDef[] {
  const byId = new Map(owned.map((spell) => [spell.id, spell]));
  const out: SpellDef[] = [];
  for (const id of actionBar) {
    if (!id) continue;
    const spell = byId.get(id);
    if (spell) out.push({ ...spell });
  }
  return out;
}

/**
 * All owned spells (tree + unlocked) with mods baked — ignores action bar.
 * LoadoutScene uses this for the picker list.
 */
export function ownedSpellsFromSave(save: {
  treeRanks: Record<string, number>;
  unlockedSpells: readonly string[];
  xp?: number;
}): SpellDef[] {
  return loadoutFromSave({
    treeRanks: save.treeRanks,
    unlockedSpells: save.unlockedSpells,
    ...(save.xp !== undefined ? { xp: save.xp } : {}),
  }).spells;
}

// ---------------------------------------------------------------------------
// Legacy bridge (save ↔ tree service)
// ---------------------------------------------------------------------------

/**
 * Map legacy `treeRanks` (nodeId → ranks) onto owned chain node ids for the
 * new config. Used by parity tests and save migration. Retired node ids
 * (e.g. `zealot-desperate-zeal`, `vigil-deep-well`, `zealot-spendthrift-grace`)
 * are never emitted — they no longer exist in `TALENT_TREE` and `create()`
 * throws on unknown owned ids.
 */
export function ownedIdsFromLegacyRanks(treeRanks: Record<string, number>): string[] {
  const owned: string[] = [];
  const pushRanks = (prefix: string, ranks: number, max: number): void => {
    const n = Math.min(Math.max(0, ranks), max);
    for (let i = 1; i <= n; i++) owned.push(max === 1 ? prefix : `${prefix}-${i}`);
  };

  pushRanks('deep-reserves', treeRanks['deep-reserves'] ?? 0, 3);
  if ((treeRanks['vigil-oath'] ?? 0) > 0) owned.push('vigil-oath');
  if ((treeRanks['zealot-oath'] ?? 0) > 0) owned.push('zealot-oath');
  pushRanks('vigil-patient-vow', treeRanks['vigil-patient-vow'] ?? 0, 3);
  if ((treeRanks['vigil-measured-devotion'] ?? 0) > 0) owned.push('vigil-measured-devotion');
  if ((treeRanks['vigil-graven-scale'] ?? 0) > 0) owned.push('vigil-graven-scale');
  pushRanks('zealot-fervent-chain', treeRanks['zealot-fervent-chain'] ?? 0, 3);
  if ((treeRanks['zealot-steady-hands'] ?? 0) > 0) owned.push('zealot-steady-hands');
  if ((treeRanks['warped-tempo-via-vigil'] ?? 0) > 0) owned.push('warped-tempo-via-vigil');
  if ((treeRanks['warped-tempo-via-zealot'] ?? 0) > 0) owned.push('warped-tempo-via-zealot');
  if ((treeRanks['vigil-thrift'] ?? 0) > 0) owned.push('vigil-thrift');
  if ((treeRanks['vigil-still-waters'] ?? 0) > 0) owned.push('vigil-still-waters');
  if ((treeRanks['zealot-quick-breath'] ?? 0) > 0) owned.push('zealot-quick-breath');
  if ((treeRanks['zealot-frenzied-liturgy'] ?? 0) > 0) owned.push('zealot-frenzied-liturgy');
  if ((treeRanks['shared-mend-potency'] ?? 0) > 0) owned.push('shared-mend-potency');
  if ((treeRanks['shared-zealous-potency'] ?? 0) > 0) owned.push('shared-zealous-potency');
  if ((treeRanks['vowstrike-virtue'] ?? 0) > 0) owned.push('vowstrike-virtue');
  if ((treeRanks['vowstrike-vengeance'] ?? 0) > 0) owned.push('vowstrike-vengeance');
  if ((treeRanks['wrath-ascendant'] ?? 0) > 0) owned.push('wrath-ascendant');
  if ((treeRanks['vowbound-crown'] ?? 0) > 0) owned.push('vowbound-crown');
  return owned;
}

/**
 * Build opaque tree state from persisted ranks and currently unallocated
 * talent points.
 */
export function treeStateFromLegacy(
  treeRanks: Record<string, number>,
  availableTalentPoints: number,
): TreeState {
  return create(TALENT_TREE, { talent: availableTalentPoints }, ownedIdsFromLegacyRanks(treeRanks));
}

const MULTI_RANK_PREFIXES: { prefix: string; max: number }[] = [
  { prefix: 'deep-reserves', max: 3 },
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
  'vigil-thrift',
  'vigil-still-waters',
  'zealot-quick-breath',
  'zealot-frenzied-liturgy',
  'shared-mend-potency',
  'shared-zealous-potency',
  'vowstrike-virtue',
  'vowstrike-vengeance',
  'wrath-ascendant',
  'vowbound-crown',
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

/** Push opaque tree ownership into SaveData; XP remains the source of point capacity. */
export function applyTreeStateToSave(
  save: { treeRanks: Record<string, number>; subclass: SubclassId | null },
  state: TreeState,
): void {
  const snap = snapshot(state);
  save.treeRanks = legacyRanksFromOwned(snap.owned);

  if (snap.owned.includes('vigil-oath')) save.subclass = 'vigil';
  else if (snap.owned.includes('zealot-oath')) save.subclass = 'zealot';
  else save.subclass = null;
}
