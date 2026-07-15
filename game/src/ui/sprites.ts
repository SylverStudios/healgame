/**
 * Unit art: Kenney "Tiny Dungeon" (CC0, kenney.nl) — 16×16 tiles shipped as
 * the packed 12×11 tilesheet in public/assets (license copy alongside).
 * Frame index = row * 12 + col, identical to Kenney's tile_XXXX numbering.
 *
 * This is presentation-only mapping (which tile draws which unit); gameplay
 * numbers stay in src/data per the numbers-are-data rule.
 */

import type { Unit } from '../combat/types';
import type { MobVisualKey } from '../data/content/types';
import { MOB_REGISTRY } from '../data/mobs';

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

const MOB_VISUAL_FRAMES = {
  'ash-husk': FRAME.ghost,
  'iron-husk': FRAME.ghost,
  'gate-warden': FRAME.brute,
  'spire-lancer': FRAME.demon,
  'hollow-king': FRAME.demon,
  'cinder-wraith': FRAME.ghost,
  'ember-colossus': FRAME.brute,
  'choir-shade': FRAME.ghost,
  'dirge-sovereign': FRAME.demon,
} as const satisfies Readonly<Record<MobVisualKey, number>>;

/** Supported tile frame for an authored mob visual key. */
export function frameForMobVisualKey(visualKey: string): number | undefined {
  return Object.prototype.hasOwnProperty.call(MOB_VISUAL_FRAMES, visualKey)
    ? MOB_VISUAL_FRAMES[visualKey as MobVisualKey]
    : undefined;
}

/**
 * Tile frame for a combat unit. Catalog mobs resolve through stable mobId and
 * MobDef.visualKey; generated runtime ids never select enemy presentation.
 */
export function frameForUnit(unit: Pick<Unit, 'id' | 'role' | 'mobId'>): number {
  if (unit.role === 'boss' || unit.role === 'enemy') {
    const mob =
      unit.mobId !== undefined && Object.prototype.hasOwnProperty.call(MOB_REGISTRY, unit.mobId)
        ? MOB_REGISTRY[unit.mobId]
        : undefined;
    const catalogFrame = mob === undefined ? undefined : frameForMobVisualKey(mob.visualKey);
    if (catalogFrame !== undefined) return catalogFrame;
    return unit.role === 'boss' ? FRAME.demon : FRAME.ghost;
  }
  return PARTY_FRAMES[unit.id] ?? FRAME.fighter;
}
