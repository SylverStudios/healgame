/**
 * Unit art: Kenney "Tiny Dungeon" (CC0, kenney.nl) — 16×16 tiles shipped as
 * the packed 12×11 tilesheet in public/assets (license copy alongside).
 * Frame index = row * 12 + col, identical to Kenney's tile_XXXX numbering.
 *
 * This is presentation-only mapping (which tile draws which unit); gameplay
 * numbers stay in src/data per the numbers-are-data rule.
 */

import type { Unit } from '../combat/types';

export const UNIT_TEXTURE_KEY = 'tiny-dungeon';
export const UNIT_TEXTURE_URL = 'assets/tiny-dungeon.png';
export const UNIT_FRAME_SIZE = 16;

const FRAME = {
  wizard: 84, // purple robed caster — the player healer
  knight: 96, // full-helm armored knight — tank
  fighter: 98, // sword-and-board fighter — DPS 1
  ranger: 112, // green-bandana skirmisher — DPS 2
  brute: 109, // hulking one-eyed brute — Gate Warden
  demon: 110, // horned demon — Hollow King
  ghost: 121, // ashen ghost — Ash Husk trash
} as const;

const PARTY_FRAMES: Record<string, number> = {
  tank: FRAME.knight,
  dps1: FRAME.fighter,
  dps2: FRAME.ranger,
  healer: FRAME.wizard,
};

const BOSS_FRAMES: Record<string, number> = {
  'gate-warden': FRAME.brute,
  'hollow-king': FRAME.demon,
};

/** Tile frame for a combat unit — party by id, bosses by encounter boss id, trash by role. */
export function frameForUnit(unit: Pick<Unit, 'id' | 'role'>): number {
  if (unit.role === 'boss') return BOSS_FRAMES[unit.id] ?? FRAME.demon;
  if (unit.role === 'enemy') return FRAME.ghost;
  return PARTY_FRAMES[unit.id] ?? FRAME.fighter;
}
