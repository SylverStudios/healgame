/**
 * Radial-mode spell catalog (Wave 5). New ids — do not reuse lattice names
 * like `solemn-mend` for radial grants. Starter Heal + Bonk ship in Chunk 0;
 * Ring 1–3 specialize forms land in later chunks.
 */

import type { SpellDef } from '../../combat/types';

/** Plain-English starter heal (Solemn Mend–ish numbers). */
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

/** Prepurchased radial starter spell ids (bar + unlocked + tree owned). */
export const RADIAL_STARTER_SPELL_IDS = [RADIAL_HEAL.id, RADIAL_BONK.id] as const;

/** Full radial catalog grows in Chunks 1/4; Chunk 0 only needs starters. */
export const RADIAL_SPELLS: SpellDef[] = [RADIAL_HEAL, RADIAL_BONK];

export function radialSpellById(id: string): SpellDef | undefined {
  return RADIAL_SPELLS.find((s) => s.id === id);
}
