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

/**
 * v0.3 chunk F: user-provided ragged-healer sheet renders the party healer
 * specifically — the one named temp-art exception (CLAUDE.md "Temp art only,
 * one exception"). 896×256 = 14 cols × 4 rows of 64×64 frames; row order
 * (visually inspected) is down / right / up / left. The party stands on the
 * left facing right (side-view-layout-handoff §A), so row 1 (facing right,
 * confirmed by its cast pose holding golden light in the forward/right hand)
 * is the row used. The sheet's last 3 columns are golden-light cast poses.
 */
export const HEALER_SHEET_TEXTURE_KEY = 'ragged-healer';
export const HEALER_SHEET_URL = 'assets/ragged-healer-sheet.png';
export const HEALER_SHEET_FRAME_SIZE = 64;
export const HEALER_SHEET_COLS = 14;
const HEALER_FACING_ROW = 1;
const HEALER_CAST_COL_START = 11;
const HEALER_CAST_COL_COUNT = 3;

function healerFrame(col: number): number {
  return HEALER_FACING_ROW * HEALER_SHEET_COLS + col;
}

/** Neutral standing pose used whenever the healer is not casting. */
export const HEALER_IDLE_FRAME = healerFrame(0);
/** Golden-light cast pose frames, played in order while the healer casts. */
export const HEALER_CAST_FRAMES: readonly number[] = Array.from(
  { length: HEALER_CAST_COL_COUNT },
  (_, i) => healerFrame(HEALER_CAST_COL_START + i),
);

/** One-shot green sparkle burst played over a heal target (192×32 = 6 frames of 32×32). */
export const HEAL_VFX_TEXTURE_KEY = 'heal-vfx';
export const HEAL_VFX_URL = 'assets/heal-vfx.png';
export const HEAL_VFX_FRAME_SIZE = 32;
export const HEAL_VFX_FRAME_COUNT = 6;

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
  'thorn-husk': FRAME.ghost,
  'thorn-matriarch': FRAME.brute,
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
