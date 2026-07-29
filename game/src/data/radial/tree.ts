/**
 * Radial talent tree config — Wave 5 Ring 1 + Ring 2.
 *
 * Effect types and the authoritative RADIAL_TREE TreeConfig live here.
 * Combat-facing resolution and applyRadialPurchase live in resolve.ts.
 *
 * Design:
 *   - Spot id === node id (all radial spots are single-rank).
 *   - Root node: `heal` (no requires). `bonk` requires `heal`.
 *   - A/B choices are modelled as two spots sharing an exclusiveGroup — the
 *     UI (Chunk 3) renders them as a single socket with a choice modal.
 *   - `specializeSpell` effects are applied to the save by applyRadialPurchase;
 *     the other effects are resolved at loadout time by loadoutFromRadialSave.
 */

import type { TreeConfig, NodeDef, SpotDef } from '../../tree';

// ---------------------------------------------------------------------------
// Radial effect types (opaque to the tree service)
// ---------------------------------------------------------------------------

/**
 * Gameplay effects carried in radial node content.
 * `effects` is an array — a single node can carry multiple effects.
 */
export type RadialTreeEffect =
  /** Grant a spell to unlockedSpells + actionBar (bar gets it on first free slot). */
  | { kind: 'grantSpell'; spellId: string }
  /**
   * Specialize: remove `fromId` from unlockedSpells + actionBar, grant `toId`,
   * placing it in the same bar slot `fromId` occupied.
   */
  | { kind: 'specializeSpell'; fromId: string; toId: string }
  /** Grant a major cooldown (resolved via cooldownById at loadout time). */
  | { kind: 'grantCooldown'; cooldownId: string }
  /**
   * Bake stat delta into a spell at loadout time.
   * `damageDelta` / `cooldownMsDelta` / `castBuffCapDelta` are radial-only.
   * Applied only if the spell is already in the loadout.
   * `cooldownMsDelta`: added to `spell.cooldownMs` (clamped to 0 minimum).
   * `castBuffCapDelta`: added to `spell.castBuff.cap` when the buff is
   *   `stackNextHealPotencyPct` (Blessed Bonk stack cap).
   */
  | {
      kind: 'castMod';
      spellId: string;
      castMsDelta?: number;
      manaDelta?: number;
      healDelta?: number;
      damageDelta?: number;
      cooldownMsDelta?: number;
      castBuffCapDelta?: number;
    }
  /** Arms a bonus heal when triggerSpellId completes and buffedSpellId fires next. */
  | { kind: 'synergy'; triggerSpellId: string; buffedSpellId: string; bonusHeal: number }
  /**
   * Chunk 4 implements engine: after triggerSpellId, next cast of targetSpellId
   * costs `max(0, mana + manaDelta)`. Stored here as data only.
   */
  | { kind: 'manaSynergy'; triggerSpellId: string; targetSpellId: string; manaDelta: number }
  /** Flat bonus heal per 10% of target's HP missing. */
  | { kind: 'missingHealthBonus'; spellId: string; healPer10PctMissing: number }
  /** Bonus max mana. */
  | { kind: 'bonusMaxMana'; amount: number }
  /**
   * Upgrade an already-granted cooldown at loadout time.
   * The cooldown must have been granted by a prior `grantCooldown` effect in
   * the same resolve pass (ring 3 crown nodes require the ring 2 CD node).
   * `healBonusDelta`: added to `healBonus.bonusHeal` on a `healBonus` cooldown.
   * `durationMsDelta`: added to `durationMs` on any timed-effect cooldown.
   * `cooldownMsDelta`: added to the cooldown's own `cooldownMs` (negative = shorter).
   */
  | {
      kind: 'upgradeCooldown';
      cooldownId: string;
      healBonusDelta?: number;
      durationMsDelta?: number;
      cooldownMsDelta?: number;
    };

/** Content payload attached to each radial tree node (opaque to the tree service). */
export interface RadialTreeContent {
  name: string;
  description: string;
  /** Multiple effects allowed (e.g. synergy pair, or castMod on two spells). */
  effects: RadialTreeEffect[];
  glyph?: string;
}

// ---------------------------------------------------------------------------
// Choice table — logical A/B spot id → actual tree spot ids
// ---------------------------------------------------------------------------

export interface ChoiceEntry {
  a: string;
  b: string;
}

/**
 * Maps a logical A/B spot id to the two rival tree spot ids.
 * applyRadialPurchase(save, 'heal-s1', 'a') → buys spot 'heal-s1-zealous'.
 */
export const RADIAL_CHOICE_TABLE: Record<string, ChoiceEntry> = {
  'heal-s1': { a: 'heal-s1-zealous', b: 'heal-s1-solemn' },
  'mend-s1': { a: 'mend-s1-arming', b: 'mend-s1-battle' },
  offense: { a: 'vowstrike-entry', b: 'bonk-upgrade' },
  'bonk-s1': { a: 'bonk-s1-mana', b: 'bonk-s1-blessed' },
  'vowstrike-s1': { a: 'vowstrike-s1-absolution', b: 'vowstrike-s1-reckoning' },
  'big-heal-s1': { a: 'big-heal-s1-prepared', b: 'big-heal-s1-thrifty' },
  'heal-s2': { a: 'heal-s2-fast', b: 'heal-s2-slow' },
  // Ring 3
  'heal-s3': { a: 'heal-s3-committed', b: 'heal-s3-thrifty' },
  'offense-s2': { a: 'offense-s2-a', b: 'offense-s2-b' },
};

/** Free starter spots (cost 0; excluded from talent-point accounting). */
export const RADIAL_FREE_SPOT_IDS = new Set<string>(['heal', 'bonk']);

// ---------------------------------------------------------------------------
// Helper to build a single-rank spot + node
// ---------------------------------------------------------------------------

function radialSpot(
  id: string,
  content: RadialTreeContent,
  opts: {
    minLevel?: number;
    cost?: number;
    requires?: NodeDef['requires'];
    exclusiveGroup?: string;
  } = {},
): { node: NodeDef; spot: SpotDef } {
  const node: NodeDef = {
    id,
    content,
    cost: { currency: 'talent', amount: opts.cost ?? 1 },
  };
  if (opts.requires !== undefined) node.requires = opts.requires;
  if (opts.exclusiveGroup !== undefined) node.exclusiveGroup = opts.exclusiveGroup;
  if (opts.minLevel !== undefined) node.minLevel = opts.minLevel;
  return { node, spot: { id, chain: [id] } };
}

// ---------------------------------------------------------------------------
// Ring 0 — prepurchased starters (cost 0; owned at save creation)
// ---------------------------------------------------------------------------

const healEntry = radialSpot(
  'heal',
  {
    name: 'Heal',
    glyph: 'H',
    description: 'Starter heal. Already yours.',
    effects: [{ kind: 'grantSpell', spellId: 'heal' }],
  },
  { cost: 0 },
);

const bonkEntry = radialSpot(
  'bonk',
  {
    name: 'Bonk',
    glyph: '/',
    description: 'Starter poke. Already yours.',
    effects: [{ kind: 'grantSpell', spellId: 'bonk' }],
  },
  { cost: 0, requires: { mode: 'all', nodes: ['heal'] } },
);

// ---------------------------------------------------------------------------
// Ring 1 — minLevel 1, cost 1 talent each
// ---------------------------------------------------------------------------

const mendEntry = radialSpot(
  'mend',
  {
    name: 'Mend',
    glyph: 'M',
    description: 'Unlock Mend — a quick, cheap secondary heal.',
    effects: [{ kind: 'grantSpell', spellId: 'mend' }],
  },
  { requires: { mode: 'all', nodes: ['heal'] } },
);

const healS1Zealous = radialSpot(
  'heal-s1-zealous',
  {
    name: 'Zealous Heal',
    glyph: 'Z',
    description: 'Specialize Heal into Zealous Heal — faster, pricier. Locks Solemn Heal.',
    effects: [{ kind: 'specializeSpell', fromId: 'heal', toId: 'zealous-heal' }],
  },
  { exclusiveGroup: 'heal-s1', requires: { mode: 'all', nodes: ['heal'] } },
);

const healS1Solemn = radialSpot(
  'heal-s1-solemn',
  {
    name: 'Solemn Heal',
    glyph: 'S',
    description: 'Specialize Heal into Solemn Heal — slower, cheaper, harder-hitting. Locks Zealous Heal.',
    effects: [{ kind: 'specializeSpell', fromId: 'heal', toId: 'solemn-heal' }],
  },
  { exclusiveGroup: 'heal-s1', requires: { mode: 'all', nodes: ['heal'] } },
);

const bigHealEntry = radialSpot(
  'big-heal',
  {
    name: 'Big Heal',
    glyph: 'B',
    description: 'Unlock Big Heal — slow, but heals for 6. The serious button.',
    effects: [{ kind: 'grantSpell', spellId: 'big-heal' }],
  },
  { requires: { mode: 'all', nodes: ['heal'] } },
);

const mendS1Arming = radialSpot(
  'mend-s1-arming',
  {
    name: 'Arming Mend',
    glyph: 'A',
    description: 'Each Mend arms your next Heal or Big Heal for +2 heal. Locks Battle Mend.',
    effects: [
      { kind: 'synergy', triggerSpellId: 'mend', buffedSpellId: 'heal', bonusHeal: 2 },
      { kind: 'synergy', triggerSpellId: 'mend', buffedSpellId: 'zealous-heal', bonusHeal: 2 },
      { kind: 'synergy', triggerSpellId: 'mend', buffedSpellId: 'solemn-heal', bonusHeal: 2 },
      { kind: 'synergy', triggerSpellId: 'mend', buffedSpellId: 'big-heal', bonusHeal: 2 },
      { kind: 'synergy', triggerSpellId: 'mend', buffedSpellId: 'big-heal-prepared', bonusHeal: 2 },
      { kind: 'synergy', triggerSpellId: 'mend', buffedSpellId: 'big-heal-thrifty', bonusHeal: 2 },
    ],
  },
  { exclusiveGroup: 'mend-s1', requires: { mode: 'all', nodes: ['mend'] } },
);

const mendS1Battle = radialSpot(
  'mend-s1-battle',
  {
    name: 'Battle Mend',
    glyph: 'T',
    description:
      'After Bonk or Vowstrike, your next Mend costs 1 less mana (min 0). Locks Arming Mend.',
    effects: [
      { kind: 'manaSynergy', triggerSpellId: 'bonk', targetSpellId: 'mend', manaDelta: -1 },
      { kind: 'manaSynergy', triggerSpellId: 'mana-bonk', targetSpellId: 'mend', manaDelta: -1 },
      { kind: 'manaSynergy', triggerSpellId: 'blessed-bonk', targetSpellId: 'mend', manaDelta: -1 },
      { kind: 'manaSynergy', triggerSpellId: 'vowstrike', targetSpellId: 'mend', manaDelta: -1 },
      {
        kind: 'manaSynergy',
        triggerSpellId: 'vowstrike-absolution',
        targetSpellId: 'mend',
        manaDelta: -1,
      },
      {
        kind: 'manaSynergy',
        triggerSpellId: 'vowstrike-reckoning',
        targetSpellId: 'mend',
        manaDelta: -1,
      },
    ],
  },
  { exclusiveGroup: 'mend-s1', requires: { mode: 'all', nodes: ['mend'] } },
);

// ---------------------------------------------------------------------------
// Ring 2 — minLevel 5, cost 1 talent each
// ---------------------------------------------------------------------------

const vowstrikeEntry = radialSpot(
  'vowstrike-entry',
  {
    name: 'Vowstrike',
    glyph: 'V',
    description: 'Unlock Vowstrike — instant damage with a personal CD. Locks Bonk Upgrade.',
    effects: [{ kind: 'grantSpell', spellId: 'vowstrike' }],
  },
  {
    exclusiveGroup: 'offense',
    minLevel: 5,
    requires: { mode: 'all', nodes: ['heal'] },
  },
);

const bonkUpgrade = radialSpot(
  'bonk-upgrade',
  {
    name: 'Bonk Upgrade',
    glyph: '/',
    description: 'Upgrade Bonk (+1 damage). Unlocks Mana Bonk / Blessed Bonk. Locks Vowstrike.',
    effects: [
      { kind: 'castMod', spellId: 'bonk', damageDelta: 1 },
      { kind: 'castMod', spellId: 'mana-bonk', damageDelta: 1 },
      { kind: 'castMod', spellId: 'blessed-bonk', damageDelta: 1 },
    ],
  },
  {
    exclusiveGroup: 'offense',
    minLevel: 5,
    requires: { mode: 'all', nodes: ['bonk'] },
  },
);

const bonkS1Mana = radialSpot(
  'bonk-s1-mana',
  {
    name: 'Mana Bonk',
    glyph: '/',
    description:
      'Specialize Bonk into Mana Bonk — restores 1 mana on hit (Chunk 2 engine). Locks Blessed Bonk.',
    effects: [{ kind: 'specializeSpell', fromId: 'bonk', toId: 'mana-bonk' }],
  },
  { exclusiveGroup: 'bonk-s1', requires: { mode: 'all', nodes: ['bonk-upgrade'] } },
);

const bonkS1Blessed = radialSpot(
  'bonk-s1-blessed',
  {
    name: 'Blessed Bonk',
    glyph: '/',
    description:
      'Specialize Bonk into Blessed Bonk — stacks +10% next-heal amp (cap 3). Locks Mana Bonk.',
    effects: [{ kind: 'specializeSpell', fromId: 'bonk', toId: 'blessed-bonk' }],
  },
  { exclusiveGroup: 'bonk-s1', requires: { mode: 'all', nodes: ['bonk-upgrade'] } },
);

const vowstrikeS1Absolution = radialSpot(
  'vowstrike-s1-absolution',
  {
    name: 'Vowstrike: Absolution',
    glyph: 'V',
    description:
      'Specialize Vowstrike into Absolution — discount next spell 2 mana. Locks Reckoning.',
    effects: [{ kind: 'specializeSpell', fromId: 'vowstrike', toId: 'vowstrike-absolution' }],
  },
  { exclusiveGroup: 'vowstrike-s1', requires: { mode: 'all', nodes: ['vowstrike-entry'] } },
);

const vowstrikeS1Reckoning = radialSpot(
  'vowstrike-s1-reckoning',
  {
    name: 'Vowstrike: Reckoning',
    glyph: 'V',
    description:
      'Specialize Vowstrike into Reckoning — empower next heal +25%. Locks Absolution.',
    effects: [{ kind: 'specializeSpell', fromId: 'vowstrike', toId: 'vowstrike-reckoning' }],
  },
  { exclusiveGroup: 'vowstrike-s1', requires: { mode: 'all', nodes: ['vowstrike-entry'] } },
);

const stillWatersEntry = radialSpot(
  'still-waters',
  {
    name: 'Still Waters',
    glyph: 'S',
    description: 'Grant Still Waters — next heal costs 0 mana. OOM panic button.',
    effects: [{ kind: 'grantCooldown', cooldownId: 'still-waters' }],
  },
  { minLevel: 5, requires: { mode: 'all', nodes: ['heal'] } },
);

const wrathEntry = radialSpot(
  'wrath',
  {
    name: 'Wrath Ascendant',
    glyph: 'W',
    description: 'Grant Wrath Ascendant — 12s window where heals gain +2.',
    effects: [{ kind: 'grantCooldown', cooldownId: 'wrath-ascendant' }],
  },
  { minLevel: 5, requires: { mode: 'all', nodes: ['heal'] } },
);

const liturgyEntry = radialSpot(
  'liturgy',
  {
    name: 'Frenzied Liturgy',
    glyph: 'L',
    description: 'Grant Frenzied Liturgy — 30s window heals cost 1 less mana. Great for fast casters.',
    effects: [{ kind: 'grantCooldown', cooldownId: 'frenzied-liturgy' }],
  },
  { minLevel: 5, requires: { mode: 'all', nodes: ['heal'] } },
);

const bigHealS1Prepared = radialSpot(
  'big-heal-s1-prepared',
  {
    name: 'Big Heal: Prepared',
    glyph: 'B',
    description: 'Specialize Big Heal — Prepared version: bigger heal, longer cast. Locks Thrifty.',
    effects: [{ kind: 'specializeSpell', fromId: 'big-heal', toId: 'big-heal-prepared' }],
  },
  {
    exclusiveGroup: 'big-heal-s1',
    minLevel: 5,
    requires: { mode: 'all', nodes: ['big-heal'] },
  },
);

const bigHealS1Thrifty = radialSpot(
  'big-heal-s1-thrifty',
  {
    name: 'Big Heal: Thrifty',
    glyph: 'B',
    description: 'Specialize Big Heal — Thrifty version: cheaper mana, slightly less heal. Locks Prepared.',
    effects: [{ kind: 'specializeSpell', fromId: 'big-heal', toId: 'big-heal-thrifty' }],
  },
  {
    exclusiveGroup: 'big-heal-s1',
    minLevel: 5,
    requires: { mode: 'all', nodes: ['big-heal'] },
  },
);

// heal-s2 requires EITHER heal-s1-zealous OR heal-s1-solemn
const healS2Fast = radialSpot(
  'heal-s2-fast',
  {
    name: 'Blazing Conviction',
    glyph: 'Z',
    description:
      'Shorten cast time further on your specialized Heal. Locks the slow-path. Must feel dope.',
    effects: [
      { kind: 'castMod', spellId: 'zealous-heal', castMsDelta: -400 },
      { kind: 'castMod', spellId: 'solemn-heal', castMsDelta: -500 },
    ],
  },
  {
    exclusiveGroup: 'heal-s2',
    minLevel: 5,
    requires: { mode: 'any', nodes: ['heal-s1-zealous', 'heal-s1-solemn'] },
  },
);

const healS2Slow = radialSpot(
  'heal-s2-slow',
  {
    name: 'Resonant Vow',
    glyph: 'R',
    description:
      'Your specialized Heal gains +1 heal per 10% HP missing on the target. Locks fast-path.',
    effects: [
      { kind: 'missingHealthBonus', spellId: 'zealous-heal', healPer10PctMissing: 1 },
      { kind: 'missingHealthBonus', spellId: 'solemn-heal', healPer10PctMissing: 1 },
    ],
  },
  {
    exclusiveGroup: 'heal-s2',
    minLevel: 5,
    requires: { mode: 'any', nodes: ['heal-s1-zealous', 'heal-s1-solemn'] },
  },
);

// ---------------------------------------------------------------------------
// Ring 3 — minLevel 10, cost 1 talent each
// ---------------------------------------------------------------------------

// heal-s3: further identity spike on the heal specialization line.
// A = "Burning Faith" — +2 heal on your specialized heal (bigger committed hit).
// B = "Thrifty Grace" — -1 mana on your specialized heal (sustain path).

const healS3Committed = radialSpot(
  'heal-s3-committed',
  {
    name: 'Burning Faith',
    glyph: '!',
    description: 'Your specialized Heal gains +2 heal. Commit, hit hard. Locks Thrifty Grace.',
    effects: [
      { kind: 'castMod', spellId: 'zealous-heal', healDelta: 2 },
      { kind: 'castMod', spellId: 'solemn-heal', healDelta: 2 },
    ],
  },
  {
    exclusiveGroup: 'heal-s3',
    minLevel: 10,
    requires: { mode: 'any', nodes: ['heal-s2-fast', 'heal-s2-slow'] },
  },
);

const healS3Thrifty = radialSpot(
  'heal-s3-thrifty',
  {
    name: 'Thrifty Grace',
    glyph: 'G',
    description: 'Your specialized Heal costs 1 less mana. Sustain longer, heal often. Locks Burning Faith.',
    effects: [
      { kind: 'castMod', spellId: 'zealous-heal', manaDelta: -1 },
      { kind: 'castMod', spellId: 'solemn-heal', manaDelta: -1 },
    ],
  },
  {
    exclusiveGroup: 'heal-s3',
    minLevel: 10,
    requires: { mode: 'any', nodes: ['heal-s2-fast', 'heal-s2-slow'] },
  },
);

// offense-s2: further upgrade on the chosen offense line.
// A = "Swift Conviction" — Vowstrike: -2s CD; Bonk: +1 damage.
// B = "Crushing Blow"   — Vowstrike: +2 damage; Bonk: +1 Blessed Bonk stack cap.

const offenseS2A = radialSpot(
  'offense-s2-a',
  {
    name: 'Swift Conviction',
    glyph: 'S',
    description: 'Vowstrike: \u22122s cooldown. Bonk: +1 damage. Locks Crushing Blow.',
    effects: [
      { kind: 'castMod', spellId: 'vowstrike', cooldownMsDelta: -2000 },
      { kind: 'castMod', spellId: 'vowstrike-absolution', cooldownMsDelta: -2000 },
      { kind: 'castMod', spellId: 'vowstrike-reckoning', cooldownMsDelta: -2000 },
      { kind: 'castMod', spellId: 'bonk', damageDelta: 1 },
      { kind: 'castMod', spellId: 'mana-bonk', damageDelta: 1 },
      { kind: 'castMod', spellId: 'blessed-bonk', damageDelta: 1 },
    ],
  },
  {
    exclusiveGroup: 'offense-s2',
    minLevel: 10,
    requires: {
      mode: 'any',
      nodes: [
        'vowstrike-s1-absolution',
        'vowstrike-s1-reckoning',
        'bonk-s1-mana',
        'bonk-s1-blessed',
      ],
    },
  },
);

const offenseS2B = radialSpot(
  'offense-s2-b',
  {
    name: 'Crushing Blow',
    glyph: 'C',
    description: 'Vowstrike: +2 damage. Bonk: +1 Blessed Bonk stack cap (cap 4). Locks Swift Conviction.',
    effects: [
      { kind: 'castMod', spellId: 'vowstrike', damageDelta: 2 },
      { kind: 'castMod', spellId: 'vowstrike-absolution', damageDelta: 2 },
      { kind: 'castMod', spellId: 'vowstrike-reckoning', damageDelta: 2 },
      { kind: 'castMod', spellId: 'blessed-bonk', castBuffCapDelta: 1 },
    ],
  },
  {
    exclusiveGroup: 'offense-s2',
    minLevel: 10,
    requires: {
      mode: 'any',
      nodes: [
        'vowstrike-s1-absolution',
        'vowstrike-s1-reckoning',
        'bonk-s1-mana',
        'bonk-s1-blessed',
      ],
    },
  },
);

// crown-wrath: upgrade Wrath Ascendant to grant +3 to heals (up from +2).

const crownWrath = radialSpot(
  'crown-wrath',
  {
    name: 'Wrath Crowned',
    glyph: 'W',
    description: 'Wrath Ascendant now grants +3 to heals (up from +2) during its window.',
    effects: [{ kind: 'upgradeCooldown', cooldownId: 'wrath-ascendant', healBonusDelta: 1 }],
  },
  {
    minLevel: 10,
    requires: { mode: 'all', nodes: ['wrath'] },
  },
);

// crown-waters: reduce Still Waters cooldown to 45s (from 60s).

const crownWaters = radialSpot(
  'crown-waters',
  {
    name: 'Blessed Reservoir',
    glyph: 'R',
    description: "Still Waters' cooldown is reduced to 45s (from 60s). The panic button recharges faster.",
    effects: [{ kind: 'upgradeCooldown', cooldownId: 'still-waters', cooldownMsDelta: -15000 }],
  },
  {
    minLevel: 10,
    requires: { mode: 'all', nodes: ['still-waters'] },
  },
);

// ---------------------------------------------------------------------------
// Assemble RADIAL_TREE
// ---------------------------------------------------------------------------

const ALL_SPOTS = [
  // Ring 0
  healEntry,
  bonkEntry,
  // Ring 1
  mendEntry,
  healS1Zealous,
  healS1Solemn,
  bigHealEntry,
  mendS1Arming,
  mendS1Battle,
  // Ring 2
  vowstrikeEntry,
  bonkUpgrade,
  bonkS1Mana,
  bonkS1Blessed,
  vowstrikeS1Absolution,
  vowstrikeS1Reckoning,
  stillWatersEntry,
  wrathEntry,
  liturgyEntry,
  bigHealS1Prepared,
  bigHealS1Thrifty,
  healS2Fast,
  healS2Slow,
  // Ring 3
  healS3Committed,
  healS3Thrifty,
  offenseS2A,
  offenseS2B,
  crownWrath,
  crownWaters,
];

export const RADIAL_TREE: TreeConfig = {
  nodes: ALL_SPOTS.map((s) => s.node),
  spots: ALL_SPOTS.map((s) => s.spot),
};
