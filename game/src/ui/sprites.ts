/**
 * Unit art: Kenney "Tiny Dungeon" (CC0, kenney.nl) — 16×16 tiles shipped as
 * the packed 12×11 tilesheet in public/assets (license copy alongside), plus
 * a dual-path for PixelLab / custom stills (party mercs + ash-husk) and the
 * ragged healer sheet. Frame index for Kenney = row * 12 + col.
 *
 * This is presentation-only mapping (which tile/texture draws which unit);
 * gameplay numbers stay in src/data per the numbers-are-data rule.
 */

import type { Unit } from '../combat/types';
import type { MobVisualKey } from '../data/content/types';
import { MOB_REGISTRY } from '../data/mobs';

export const UNIT_TEXTURE_KEY = 'tiny-dungeon';
export const UNIT_TEXTURE_URL = 'assets/tiny-dungeon.png';
export const UNIT_FRAME_SIZE = 16;

/** PixelLab Ash Husk still — combat-facing west (enemies face left). */
export const ASH_HUSK_TEXTURE_KEY = 'unit-ash-husk';
export const ASH_HUSK_TEXTURE_URL = 'assets/units/ash-husk/west.png';

/** PixelLab Starter Tank still — combat-facing east (party faces right). */
export const TANK_TEXTURE_KEY = 'unit-tank';
export const TANK_TEXTURE_URL = 'assets/units/tank/east.png';

/** PixelLab starter melee DPS — combat-facing east. */
export const DPS1_TEXTURE_KEY = 'unit-dps1';
export const DPS1_TEXTURE_URL = 'assets/units/dps1/east.png';

/** PixelLab starter ranger DPS — combat-facing east. */
export const DPS2_TEXTURE_KEY = 'unit-dps2';
export const DPS2_TEXTURE_URL = 'assets/units/dps2/east.png';

/** Texture keys for PixelLab stills (authored facing; UnitSprite skips flipX). */
export type CustomUnitTextureKey =
  | typeof ASH_HUSK_TEXTURE_KEY
  | typeof TANK_TEXTURE_KEY
  | typeof DPS1_TEXTURE_KEY
  | typeof DPS2_TEXTURE_KEY;

/**
 * One-shot attack strip for a PixelLab merc. Frames are separate PNGs loaded as
 * individual textures; BootScene registers the Phaser anim from these keys.
 */
export interface UnitAttackAnimDef {
  /** Party unit id this strip belongs to. */
  unitId: 'tank' | 'dps1' | 'dps2';
  animKey: string;
  /** Rest still shown when not attacking. */
  restTextureKey: CustomUnitTextureKey;
  frameCount: number;
  frameKey: (index: number) => string;
  frameUrl: (index: number) => string;
}

function attackFrameKey(slug: string, index: number): string {
  return `unit-${slug}-attack-${index}`;
}

function attackFrameUrl(slug: string, facing: 'east' | 'west', index: number): string {
  return `assets/units/${slug}/attack-${facing}/${index}.png`;
}

/** Tank / DPS1 / DPS2 east attack strips (7 frames: rest + 6 generated). */
export const UNIT_ATTACK_ANIMS: readonly UnitAttackAnimDef[] = [
  {
    unitId: 'tank',
    animKey: 'unit-tank-attack',
    restTextureKey: TANK_TEXTURE_KEY,
    frameCount: 7,
    frameKey: (i) => attackFrameKey('tank', i),
    frameUrl: (i) => attackFrameUrl('tank', 'east', i),
  },
  {
    unitId: 'dps1',
    animKey: 'unit-dps1-attack',
    restTextureKey: DPS1_TEXTURE_KEY,
    frameCount: 7,
    frameKey: (i) => attackFrameKey('dps1', i),
    frameUrl: (i) => attackFrameUrl('dps1', 'east', i),
  },
  {
    unitId: 'dps2',
    animKey: 'unit-dps2-attack',
    restTextureKey: DPS2_TEXTURE_KEY,
    frameCount: 7,
    frameKey: (i) => attackFrameKey('dps2', i),
    frameUrl: (i) => attackFrameUrl('dps2', 'east', i),
  },
] as const;

/** Playback rate for PixelLab attack strips (~10fps reads as a clear swing). */
export const UNIT_ATTACK_FRAME_RATE = 10;

/** Phaser anim key for a party merc's attack strip, if one is wired. */
export function attackAnimKeyForUnit(unit: Pick<Unit, 'id'>): string | undefined {
  return UNIT_ATTACK_ANIMS.find((def) => def.unitId === unit.id)?.animKey;
}

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

/**
 * Dual-path unit presentation:
 * - `kenney` — frame into the Tiny Dungeon sheet; CombatScene may flipX by side
 * - `texture` — single custom still (already correct facing; do not flipX)
 */
export type UnitPresentation =
  | { kind: 'kenney'; frame: number }
  | { kind: 'texture'; key: CustomUnitTextureKey };

/** Supported tile frame for an authored mob visual key. */
export function frameForMobVisualKey(visualKey: string): number | undefined {
  return Object.prototype.hasOwnProperty.call(MOB_VISUAL_FRAMES, visualKey)
    ? MOB_VISUAL_FRAMES[visualKey as MobVisualKey]
    : undefined;
}

/**
 * Kenney tile frame for a combat unit. Catalog mobs resolve through stable
 * mobId and MobDef.visualKey; generated runtime ids never select enemy
 * presentation. Prefer `presentationForUnit` when wiring UnitSprite — custom
 * textures still report their legacy Kenney frame here for catalog coverage
 * tests.
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

/**
 * Presentation choice for a combat unit. Party mercs (tank/dps) + ash-husk use
 * PixelLab stills; the healer sheet is wired separately in CombatScene (cast
 * frames). Remaining trash/bosses stay on Kenney.
 */
export function presentationForUnit(
  unit: Pick<Unit, 'id' | 'role' | 'mobId'>,
): UnitPresentation {
  if (unit.id === 'tank') {
    return { kind: 'texture', key: TANK_TEXTURE_KEY };
  }
  if (unit.id === 'dps1') {
    return { kind: 'texture', key: DPS1_TEXTURE_KEY };
  }
  if (unit.id === 'dps2') {
    return { kind: 'texture', key: DPS2_TEXTURE_KEY };
  }
  if (unit.role === 'enemy' || unit.role === 'boss') {
    const mob =
      unit.mobId !== undefined && Object.prototype.hasOwnProperty.call(MOB_REGISTRY, unit.mobId)
        ? MOB_REGISTRY[unit.mobId]
        : undefined;
    if (mob?.visualKey === 'ash-husk') {
      return { kind: 'texture', key: ASH_HUSK_TEXTURE_KEY };
    }
  }
  return { kind: 'kenney', frame: frameForUnit(unit) };
}
