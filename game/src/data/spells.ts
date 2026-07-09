/**
 * Spell defs for the combat engine, sourced from constants.ts (poc-spec §4.2).
 * The engine only ever casts spells it's handed by the caller (the player's
 * unlocked spell list) — this file just exposes the full catalog + a lookup.
 */

import type { SpellDef } from '../combat/types';
import { SPELLS } from './constants';

export const ALL_SPELLS: SpellDef[] = [
  SPELLS.solemnMend,
  SPELLS.zealousMending,
  SPELLS.solemnVigil,
  SPELLS.zealousFlare,
];

export function spellById(id: string): SpellDef | undefined {
  return ALL_SPELLS.find((s) => s.id === id);
}
