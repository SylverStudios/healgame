/**
 * Cooldown data (Alpha 0.1 §D6 — first major CDs). All numbers live here;
 * gameplay rules/interactions are documented in combat/README.md and encoded
 * in combat/engine.ts (activateCooldown, effectiveManaCost, beginCast).
 */

import type { CooldownDef } from '../combat/types';

/** Vigil CD: arms a free-heal charge, consumed by the next cast that starts (OOM panic button). */
export const STILL_WATERS: CooldownDef = {
  id: 'still-waters',
  name: 'Still Waters',
  description: 'Next heal cast costs no mana (consumed when the cast starts).',
  cooldownMs: 60_000,
  effect: { kind: 'freeNextHeal' },
  glyph: 'S',
};

/** Zealot CD: a 30s tempo window, followed by 10s of recovery before reuse. */
export const FRENZIED_LITURGY: CooldownDef = {
  id: 'frenzied-liturgy',
  name: 'Frenzied Liturgy',
  description: 'For 30s, heals cost 1 less mana. Then 10s recovery before reuse.',
  cooldownMs: 40_000,
  effect: { kind: 'manaCostReduction', durationMs: 30_000, costReduction: 1 },
  glyph: 'L',
};

/** Crown CD (Alpha 0.2 §D6): shared Wings-feel cooldown, granted by the wrath-ascendant tree node. */
export const WRATH_ASCENDANT: CooldownDef = {
  id: 'wrath-ascendant',
  name: 'Wrath Ascendant',
  description: 'For 12s, your heals gain +2. Off-GCD.',
  cooldownMs: 45_000,
  effect: { kind: 'healBonus', durationMs: 12_000, bonusHeal: 2 },
  glyph: 'W',
};

// ---------------------------------------------------------------------------
// Cards Set B (L8 cooldown choice) — stub magnitudes; Balance retunes later.
// Distinct ids from Set A (still-waters / wrath-ascendant / frenzied-liturgy).
// ---------------------------------------------------------------------------

/** Set B: short heal-bonus burst (stub near Wrath, shorter window). */
export const IRON_CANTICLE: CooldownDef = {
  id: 'iron-canticle',
  name: 'Iron Canticle',
  description: 'For 8s, your heals gain +2. Off-GCD. (stub)',
  cooldownMs: 50_000,
  effect: { kind: 'healBonus', durationMs: 8_000, bonusHeal: 2 },
  glyph: 'I',
};

/** Set B: free-heal panic (stub near Still Waters, longer CD). */
export const MERCY_RESERVE: CooldownDef = {
  id: 'mercy-reserve',
  name: 'Mercy Reserve',
  description: 'Next heal cast costs no mana (consumed when the cast starts). (stub)',
  cooldownMs: 75_000,
  effect: { kind: 'freeNextHeal' },
  glyph: 'M',
};

/** Set B: mana-cost window (stub near Liturgy, shorter duration). */
export const ASHEN_RITE: CooldownDef = {
  id: 'ashen-rite',
  name: 'Ashen Rite',
  description: 'For 20s, heals cost 1 less mana. (stub)',
  cooldownMs: 55_000,
  effect: { kind: 'manaCostReduction', durationMs: 20_000, costReduction: 1 },
  glyph: 'A',
};

/** Cards L6 cooldown choice — existing majors. */
export const COOLDOWN_SET_A_IDS = [
  'still-waters',
  'wrath-ascendant',
  'frenzied-liturgy',
] as const;

/** Cards L8 cooldown choice — three new distinct ids. */
export const COOLDOWN_SET_B_IDS = [
  'iron-canticle',
  'mercy-reserve',
  'ashen-rite',
] as const;

export const COOLDOWNS: CooldownDef[] = [
  STILL_WATERS,
  FRENZIED_LITURGY,
  WRATH_ASCENDANT,
  IRON_CANTICLE,
  MERCY_RESERVE,
  ASHEN_RITE,
];

export function cooldownById(id: string): CooldownDef | undefined {
  return COOLDOWNS.find((c) => c.id === id);
}
