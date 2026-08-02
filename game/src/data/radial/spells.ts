/**
 * Radial-mode spell catalog (Wave 5). New ids — do not reuse lattice names
 * like `solemn-mend` for radial grants. Starter Heal + Bonk ship in Chunk 0;
 * Ring 1–3 specialize forms added in Chunk 1.
 */

import type { SpellDef } from '../../combat/types';

// ---------------------------------------------------------------------------
// Ring 0 — prepurchased starters
// ---------------------------------------------------------------------------

/** Plain-English starter heal (Solemn Mend-ish numbers). */
export const RADIAL_HEAL: SpellDef = {
  id: 'heal',
  name: 'Heal',
  heal: 4,
  mana: 3,
  castMs: 2000,
  glyph: 'H',
  description: 'Plain single-target heal. Spend a point on Mend next.',
};

/** Radial starter Bonk — same combat shape as lattice Bonk, owned via radial kit. */
export const RADIAL_BONK: SpellDef = {
  id: 'bonk',
  name: 'Bonk',
  heal: 0,
  damage: 1,
  mana: 0,
  castMs: 0,
  glyph: '/',
  description: 'Stick poke. Free filler until you specialize or replace it.',
};

// ---------------------------------------------------------------------------
// Ring 1 — grant unlocks
// ---------------------------------------------------------------------------

/** Radial Mend — quick, cheap secondary heal unlocked by the mend spoke. */
export const RADIAL_MEND: SpellDef = {
  id: 'mend',
  name: 'Mend',
  heal: 2,
  mana: 1,
  castMs: 1500,
  glyph: 'M',
  description: 'Quick cheap heal. Pairs with synergy nodes from mend-s1.',
};

/** Big Heal — slow big heal (≈ Solemn Vigil numbers). */
export const RADIAL_BIG_HEAL: SpellDef = {
  id: 'big-heal',
  name: 'Big Heal',
  heal: 6,
  mana: 5,
  castMs: 3000,
  glyph: 'B',
  description: 'Slow big heal. Plan the cast; spec it further at Ring 2.',
};

// ---------------------------------------------------------------------------
// heal-s1 specializations (replace Heal)
// ---------------------------------------------------------------------------

/** Zealous Heal — faster, pricier (A choice on heal-s1). Replaces Heal. */
export const RADIAL_ZEALOUS_HEAL: SpellDef = {
  id: 'zealous-heal',
  name: 'Zealous Heal',
  heal: 4,
  mana: 4,
  castMs: 1200,
  glyph: 'Z',
  description: 'Faster heal at steeper mana cost. Good for reactive pops.',
};

/** Solemn Heal — slower, cheaper, harder-hitting (B choice on heal-s1). Replaces Heal. */
export const RADIAL_SOLEMN_HEAL: SpellDef = {
  id: 'solemn-heal',
  name: 'Solemn Heal',
  heal: 5,
  mana: 2,
  castMs: 2800,
  glyph: 'S',
  description: 'Efficient deliberate heal. Pair with cooldowns to bridge gaps.',
};

// ---------------------------------------------------------------------------
// big-heal-s1 specializations (replace Big Heal)
// ---------------------------------------------------------------------------

/** Prepared — more heal but longer cast (A choice on big-heal-s1). Replaces Big Heal. */
export const RADIAL_BIG_HEAL_PREPARED: SpellDef = {
  id: 'big-heal-prepared',
  name: 'Big Heal: Prepared',
  heal: 8,
  mana: 5,
  castMs: 3500,
  glyph: 'B',
  description: 'Bigger heal at the cost of a longer cast. Commit early.',
};

/** Thrifty — cheaper but weaker (B choice on big-heal-s1). Replaces Big Heal. */
export const RADIAL_BIG_HEAL_THRIFTY: SpellDef = {
  id: 'big-heal-thrifty',
  name: 'Big Heal: Thrifty',
  heal: 5,
  mana: 4,
  castMs: 3000,
  glyph: 'B',
  description: 'Lighter on mana. Pairs with Liturgy for sustained burst windows.',
};

// ---------------------------------------------------------------------------
// Ring 2 — offense spells
// ---------------------------------------------------------------------------

/** Base radial Vowstrike — granted by the vowstrike-entry spoke. */
export const RADIAL_VOWSTRIKE: SpellDef = {
  id: 'vowstrike',
  name: 'Vowstrike',
  heal: 0,
  damage: 6,
  mana: 2,
  castMs: 0,
  cooldownMs: 6_000,
  glyph: 'V',
  description: 'Strike vow. Specialize into Absolution or Reckoning next.',
};

/** Vowstrike: Absolution — mana-discount flavour. Replaces Vowstrike. */
export const RADIAL_VOWSTRIKE_ABSOLUTION: SpellDef = {
  id: 'vowstrike-absolution',
  name: 'Vowstrike: Absolution',
  heal: 0,
  damage: 7,
  mana: 3,
  castMs: 0,
  cooldownMs: 6_000,
  castBuff: { kind: 'nextSpellManaReduction', amount: 2 },
  glyph: 'V',
  description: 'Strike, then discount your next spell by 2 mana.',
};

/** Vowstrike: Reckoning — potency-amp flavour. Replaces Vowstrike. */
export const RADIAL_VOWSTRIKE_RECKONING: SpellDef = {
  id: 'vowstrike-reckoning',
  name: 'Vowstrike: Reckoning',
  heal: 0,
  damage: 7,
  mana: 3,
  castMs: 0,
  cooldownMs: 6_000,
  castBuff: { kind: 'nextHealPotencyPct', pct: 25 },
  glyph: 'V',
  description: 'Strike, then empower your next heal by 25%.',
};

/** Mana Bonk — Bonk that restores 1 mana on hit. Replaces Bonk. */
export const RADIAL_MANA_BONK: SpellDef = {
  id: 'mana-bonk',
  name: 'Mana Bonk',
  heal: 0,
  damage: 2,
  mana: 0,
  castMs: 0,
  manaOnHit: 1,
  glyph: '/',
  description: 'Upgraded poke that restores 1 mana on each hit.',
};

/** Blessed Bonk — stacking next-heal amp castBuff (Chunk 2 implements engine). Replaces Bonk. */
export const RADIAL_BLESSED_BONK: SpellDef = {
  id: 'blessed-bonk',
  name: 'Blessed Bonk',
  heal: 0,
  damage: 2,
  mana: 0,
  castMs: 0,
  castBuff: { kind: 'stackNextHealPotencyPct', pct: 10, cap: 3 },
  glyph: '/',
  description: 'Each poke adds a stack. Your next heal gains +10% per stack (max 3 stacks).',
};

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

/** Prepurchased radial starter spell ids (bar + unlocked + tree owned). */
export const RADIAL_STARTER_SPELL_IDS = [RADIAL_HEAL.id, RADIAL_BONK.id] as const;

/** Full radial spell catalog — all spells that can appear in an radial loadout. */
export const RADIAL_SPELLS: SpellDef[] = [
  // Starters
  RADIAL_HEAL,
  RADIAL_BONK,
  // Ring 1 grants
  RADIAL_MEND,
  RADIAL_BIG_HEAL,
  // heal-s1 specializations
  RADIAL_ZEALOUS_HEAL,
  RADIAL_SOLEMN_HEAL,
  // big-heal-s1 specializations
  RADIAL_BIG_HEAL_PREPARED,
  RADIAL_BIG_HEAL_THRIFTY,
  // Ring 2 offense
  RADIAL_VOWSTRIKE,
  RADIAL_VOWSTRIKE_ABSOLUTION,
  RADIAL_VOWSTRIKE_RECKONING,
  RADIAL_MANA_BONK,
  RADIAL_BLESSED_BONK,
];

export function radialSpellById(id: string): SpellDef | undefined {
  return RADIAL_SPELLS.find((s) => s.id === id);
}
