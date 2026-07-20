/**
 * Unit art: Kenney "Tiny Dungeon" (CC0, kenney.nl) — 16×16 tiles shipped as
 * the packed 12×11 tilesheet in public/assets (license copy alongside), plus
 * custom stills (party mercs + ash-husk) and the 32×32 armored-paladin
 * healer sheet. Frame index for Kenney = row * 12 + col.
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
  /**
   * Per-frame hold times (ms). Length must equal `frameCount`. Entries ≤0 are
   * omitted from the Phaser anim (frame 0 is the rest still — skip it).
   */
  frameDurationsMs: readonly number[];
}

/**
 * One-shot hurt reaction strip for a party merc. Same shape as
 * `UnitAttackAnimDef` (separate per-frame PNGs, FE exposure sheet); kept as a
 * distinct type because not every merc has a hurt strip yet.
 */
export interface UnitHurtAnimDef {
  /** Party unit id this strip belongs to. */
  unitId: 'tank' | 'dps1' | 'dps2';
  animKey: string;
  /** Rest still shown when not flinching. */
  restTextureKey: CustomUnitTextureKey;
  frameCount: number;
  frameKey: (index: number) => string;
  frameUrl: (index: number) => string;
  /** Per-frame hold times (ms); length must equal `frameCount`. */
  frameDurationsMs: readonly number[];
}

/**
 * FE-style exposure sheet for the 7-frame PixelLab merc strips.
 *
 * Equal-duration GIFs read floaty; Fire Emblem holds anticipation / contact
 * and flashes smears (typically 1–2 display frames) — see
 * https://lost-worlds.neocities.org/blog/2024/10/20/fire-emblem-animation/
 *
 * Roles at ~60Hz: 0 rest (skipped), 1 antic hold, 2–3 snappy in-betweens /
 * smear, 4 contact hold, 5–6 recovery before UnitSprite restores the rest still.
 */
export const MERC_ATTACK_FRAME_DURATIONS_MS: readonly number[] = [
  0, // 0 rest still (identical to east.png) — omit
  150, // 1 anticipation (~9 frames)
  33, // 2 approach (~2)
  33, // 3 smear / snap (~2)
  183, // 4 contact (~11)
  50, // 5 follow-through (~3)
  67, // 6 settle (~4)
] as const;

/**
 * Tank's own exposure sheet for its tight 32×32 attack strip. Same 7-frame
 * shape as the other tight mercs, faster overall read than the legacy
 * `MERC_ATTACK_FRAME_DURATIONS_MS`.
 */
export const TANK_ATTACK_FRAME_DURATIONS_MS: readonly number[] = [
  50, 100, 33, 167, 67, 83, 100,
] as const;

/**
 * Tank's hurt reaction exposure sheet (5 frames): quick antic, snap into the
 * flinch, held recoil, then recover back to rest.
 */
export const TANK_HURT_FRAME_DURATIONS_MS: readonly number[] = [50, 100, 150, 83, 100] as const;

/**
 * DPS1's own exposure sheet for its tight 32×32 attack strip. Same 7-frame
 * shape as the tank's.
 */
export const DPS1_ATTACK_FRAME_DURATIONS_MS: readonly number[] = [
  50, 100, 33, 167, 67, 83, 100,
] as const;

/**
 * DPS1's hurt reaction exposure sheet (5 frames): quick antic, snap into the
 * flinch, held recoil, then recover back to rest.
 */
export const DPS1_HURT_FRAME_DURATIONS_MS: readonly number[] = [50, 100, 150, 83, 100] as const;

/**
 * DPS2's own exposure sheet for its tight 32×32 attack strip (installed in
 * chunk D2). Same 7-frame shape as tank/dps1 — no more legacy padded dps2.
 */
export const DPS2_ATTACK_FRAME_DURATIONS_MS: readonly number[] = [
  50, 100, 33, 167, 67, 83, 100,
] as const;

/**
 * DPS2's hurt reaction exposure sheet (5 frames): quick antic, snap into the
 * flinch, held recoil, then recover back to rest.
 */
export const DPS2_HURT_FRAME_DURATIONS_MS: readonly number[] = [50, 100, 150, 83, 100] as const;

/** Shared shape for building Phaser anim frame lists from a per-frame exposure sheet. */
interface FrameStripSource {
  animKey: string;
  frameCount: number;
  frameKey: (index: number) => string;
  frameDurationsMs: readonly number[];
}

/** Builds Phaser anim frame entries from an exposure sheet (skips duration ≤ 0). */
function buildStripFrames(
  def: FrameStripSource,
): ReadonlyArray<{ key: string; duration: number }> {
  if (def.frameDurationsMs.length !== def.frameCount) {
    throw new Error(
      `strip anim ${def.animKey}: frameDurationsMs length ${def.frameDurationsMs.length} !== frameCount ${def.frameCount}`,
    );
  }
  const frames: { key: string; duration: number }[] = [];
  for (let i = 0; i < def.frameCount; i++) {
    const duration = def.frameDurationsMs[i]!;
    if (duration <= 0) continue;
    frames.push({ key: def.frameKey(i), duration });
  }
  return frames;
}

/** Phaser anim frame entries with FE holds (skips duration ≤ 0). */
export function attackAnimFrames(
  def: UnitAttackAnimDef,
): ReadonlyArray<{ key: string; duration: number }> {
  return buildStripFrames(def);
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
    frameDurationsMs: TANK_ATTACK_FRAME_DURATIONS_MS,
  },
  {
    unitId: 'dps1',
    animKey: 'unit-dps1-attack',
    restTextureKey: DPS1_TEXTURE_KEY,
    frameCount: 7,
    frameKey: (i) => attackFrameKey('dps1', i),
    frameUrl: (i) => attackFrameUrl('dps1', 'east', i),
    frameDurationsMs: DPS1_ATTACK_FRAME_DURATIONS_MS,
  },
  {
    unitId: 'dps2',
    animKey: 'unit-dps2-attack',
    restTextureKey: DPS2_TEXTURE_KEY,
    frameCount: 7,
    frameKey: (i) => attackFrameKey('dps2', i),
    frameUrl: (i) => attackFrameUrl('dps2', 'east', i),
    frameDurationsMs: DPS2_ATTACK_FRAME_DURATIONS_MS,
  },
] as const;

/** Phaser anim key for a party merc's attack strip, if one is wired. */
export function attackAnimKeyForUnit(unit: Pick<Unit, 'id'>): string | undefined {
  return UNIT_ATTACK_ANIMS.find((def) => def.unitId === unit.id)?.animKey;
}

function hurtFrameKey(slug: string, index: number): string {
  return `unit-${slug}-hurt-${index}`;
}

function hurtFrameUrl(slug: string, facing: 'east' | 'west', index: number): string {
  return `assets/units/${slug}/hurt-${facing}/${index}.png`;
}

/** Tank + dps1 + dps2 east hurt strips (5 frames each). */
export const UNIT_HURT_ANIMS: readonly UnitHurtAnimDef[] = [
  {
    unitId: 'tank',
    animKey: 'unit-tank-hurt',
    restTextureKey: TANK_TEXTURE_KEY,
    frameCount: 5,
    frameKey: (i) => hurtFrameKey('tank', i),
    frameUrl: (i) => hurtFrameUrl('tank', 'east', i),
    frameDurationsMs: TANK_HURT_FRAME_DURATIONS_MS,
  },
  {
    unitId: 'dps1',
    animKey: 'unit-dps1-hurt',
    restTextureKey: DPS1_TEXTURE_KEY,
    frameCount: 5,
    frameKey: (i) => hurtFrameKey('dps1', i),
    frameUrl: (i) => hurtFrameUrl('dps1', 'east', i),
    frameDurationsMs: DPS1_HURT_FRAME_DURATIONS_MS,
  },
  {
    unitId: 'dps2',
    animKey: 'unit-dps2-hurt',
    restTextureKey: DPS2_TEXTURE_KEY,
    frameCount: 5,
    frameKey: (i) => hurtFrameKey('dps2', i),
    frameUrl: (i) => hurtFrameUrl('dps2', 'east', i),
    frameDurationsMs: DPS2_HURT_FRAME_DURATIONS_MS,
  },
] as const;

/** Phaser anim key for a party merc's hurt reaction strip, if one is wired. */
export function hurtAnimKeyForUnit(unit: Pick<Unit, 'id'>): string | undefined {
  return UNIT_HURT_ANIMS.find((def) => def.unitId === unit.id)?.animKey;
}

/** Phaser anim frame entries with FE holds (skips duration ≤ 0). */
export function hurtAnimFrames(
  def: UnitHurtAnimDef,
): ReadonlyArray<{ key: string; duration: number }> {
  return buildStripFrames(def);
}

/**
 * Party healer: native 32×32 armored-paladin, combat facing **south**.
 * Source: `art/source/armored-paladin/`. CombatScene sets `fixedFacing` (no flipX).
 *
 * Cast pipeline (Method B Solemn / Zealous, 2026-07-19):
 *   - Charge = looping climax strip while channeling (per cast style)
 *   - Cast-action = one-shot release (per cast style), then idle loop
 *   - Bonk = zap strip only
 * Sheet.png remains a rest/preload still; charge/cast are individual PNGs.
 */
export const HEALER_SHEET_TEXTURE_KEY = 'unit-healer';
export const HEALER_SHEET_URL = 'assets/units/healer/sheet.png';
export const HEALER_SHEET_FRAME_SIZE = 32;
export const HEALER_SHEET_COLS = 13;

/** Neutral standing pose on the sheet (preload / fallback before idle anim). */
export const HEALER_IDLE_FRAME = 0;

/** Solemn vs Zealous cast body language — selected per spell id. */
export type HealerCastStyle = 'solemn' | 'zealous';

/**
 * Map spell → cast style. Solemn-* → solemn; Zealous-* → zealous;
 * everything else → solemn. Vowstrike uses its own attack strip (not this).
 */
export function healerCastStyleForSpell(spellId: string): HealerCastStyle {
  if (spellId.startsWith('zealous-')) {
    return 'zealous';
  }
  return 'solemn';
}

/** Instant oath-strike — both aspects share one attack strip. */
export function isVowstrikeSpell(spellId: string): boolean {
  return spellId === 'vowstrike-virtue' || spellId === 'vowstrike-vengeance';
}

/**
 * Charge loop while channeling (4 climax frames, both styles share exposure).
 * Dwell on the deepest hold pose (index 2).
 */
export const HEALER_CHARGE_FRAME_DURATIONS_MS: readonly number[] = [
  120, // settle into coil/prayer
  140, // breathe
  180, // peak hold
  140, // ease before loop
] as const;

/**
 * One-shot release (9 frames charge-key → release climax). Shared exposure for
 * both styles. Final frame is the contact hold; lead times so it begins near
 * castFinished.
 */
export const HEALER_CAST_FRAME_DURATIONS_MS: readonly number[] = [
  40, // leave charge pose
  40,
  40,
  50,
  50,
  60,
  70,
  90, // approach climax
  167, // contact / widest silhouette hold
] as const;

/**
 * Start the cast-action this many ms before `castFinished` so the contact hold
 * (last frame) begins near the heal resolve.
 */
export const HEALER_CAST_RELEASE_LEAD_MS: number = HEALER_CAST_FRAME_DURATIONS_MS.slice(
  0,
  -1,
).reduce((sum, ms) => sum + ms, 0);

/**
 * Healer south breathing loop (chunk 1B) — plays whenever the healer is not
 * charging/casting/zapping. 5 frames, individual PNGs (not part of sheet.png).
 */
export const HEALER_IDLE_ANIM_KEY = 'unit-healer-idle';
/** FE holds: settle → glow-ish rise → peak dwell → fall → settle. Not equal times. */
export const HEALER_IDLE_FRAME_DURATIONS_MS: readonly number[] = [220, 180, 250, 180, 220] as const;

/**
 * Healer south Bonk zap strip (chunk 1B) — Bonk only. 7 frames under
 * `attack-south/`.
 */
export const HEALER_ZAP_ANIM_KEY = 'unit-healer-zap';
/** FE exposure: quick antic, held spark (contact), snappy recovery. Not equal times. */
export const HEALER_ZAP_FRAME_DURATIONS_MS: readonly number[] = [
  50, 150, 267, 83, 167, 117, 100,
] as const;
/** Index of the held spark / contact silhouette in the Bonk zap strip. */
export const HEALER_ZAP_CLIMAX_FRAME_INDEX = 2;
/**
 * Delay Bonk hit presentation (float / hurt / zap-vfx) this many ms after
 * castStarted so the impact lands when the spark frame begins. Engine damage
 * still resolves instantly; this is presentation-only.
 */
export const HEALER_ZAP_IMPACT_LEAD_MS: number = HEALER_ZAP_FRAME_DURATIONS_MS.slice(
  0,
  HEALER_ZAP_CLIMAX_FRAME_INDEX,
).reduce((sum, ms) => sum + ms, 0);

/**
 * Healer south Vowstrike oath-strike — both aspects. Method B approach strip
 * (idle → raised-fist climax); recovery snaps to idle on complete. 5 frames
 * under `vowstrike-south/`.
 */
export const HEALER_VOWSTRIKE_ANIM_KEY = 'unit-healer-vowstrike';
/** FE exposure: snappy raise, held climax glow. Total well under GCD_MS. */
export const HEALER_VOWSTRIKE_FRAME_DURATIONS_MS: readonly number[] = [
  33, // leave idle
  40, // arm rising
  50, // near peak
  67, // approach glow
  167, // climax hold (raised fist + pale-gold burst)
] as const;
/** Index of the raised-fist contact silhouette. */
export const HEALER_VOWSTRIKE_CLIMAX_FRAME_INDEX = 4;
/** Presentation delay until Vowstrike climax begins (engine still instant). */
export const HEALER_VOWSTRIKE_IMPACT_LEAD_MS: number = HEALER_VOWSTRIKE_FRAME_DURATIONS_MS.slice(
  0,
  HEALER_VOWSTRIKE_CLIMAX_FRAME_INDEX,
).reduce((sum, ms) => sum + ms, 0);

export const HEALER_SOLEMN_CHARGE_ANIM_KEY = 'unit-healer-charge-solemn';
export const HEALER_ZEALOUS_CHARGE_ANIM_KEY = 'unit-healer-charge-zealous';
export const HEALER_SOLEMN_CAST_ANIM_KEY = 'unit-healer-cast-solemn';
export const HEALER_ZEALOUS_CAST_ANIM_KEY = 'unit-healer-cast-zealous';

function healerFrameKey(strip: string, index: number): string {
  return `unit-healer-${strip}-${index}`;
}

function healerFrameUrl(dir: string, index: number): string {
  return `assets/units/healer/${dir}/${index}.png`;
}

/** Per-frame strip def for a healer body anim (idle / zap / charge / cast). */
export interface HealerStripAnimDef {
  animKey: string;
  frameCount: number;
  /** Registered with Phaser `repeat: -1` (loop) vs `repeat: 0` (one-shot). */
  loop: boolean;
  frameKey: (index: number) => string;
  frameUrl: (index: number) => string;
  frameDurationsMs: readonly number[];
}

export const HEALER_IDLE_ANIM: HealerStripAnimDef = {
  animKey: HEALER_IDLE_ANIM_KEY,
  frameCount: 5,
  loop: true,
  frameKey: (i) => healerFrameKey('idle', i),
  frameUrl: (i) => healerFrameUrl('idle-south', i),
  frameDurationsMs: HEALER_IDLE_FRAME_DURATIONS_MS,
};

export const HEALER_ZAP_ANIM: HealerStripAnimDef = {
  animKey: HEALER_ZAP_ANIM_KEY,
  frameCount: 7,
  loop: false,
  frameKey: (i) => healerFrameKey('zap', i),
  frameUrl: (i) => healerFrameUrl('attack-south', i),
  frameDurationsMs: HEALER_ZAP_FRAME_DURATIONS_MS,
};

export const HEALER_VOWSTRIKE_ANIM: HealerStripAnimDef = {
  animKey: HEALER_VOWSTRIKE_ANIM_KEY,
  frameCount: 5,
  loop: false,
  frameKey: (i) => healerFrameKey('vowstrike', i),
  frameUrl: (i) => healerFrameUrl('vowstrike-south', i),
  frameDurationsMs: HEALER_VOWSTRIKE_FRAME_DURATIONS_MS,
};

export const HEALER_SOLEMN_CHARGE_ANIM: HealerStripAnimDef = {
  animKey: HEALER_SOLEMN_CHARGE_ANIM_KEY,
  frameCount: 4,
  loop: true,
  frameKey: (i) => healerFrameKey('charge-solemn', i),
  frameUrl: (i) => healerFrameUrl('charge-solemn-south', i),
  frameDurationsMs: HEALER_CHARGE_FRAME_DURATIONS_MS,
};

export const HEALER_ZEALOUS_CHARGE_ANIM: HealerStripAnimDef = {
  animKey: HEALER_ZEALOUS_CHARGE_ANIM_KEY,
  frameCount: 4,
  loop: true,
  frameKey: (i) => healerFrameKey('charge-zealous', i),
  frameUrl: (i) => healerFrameUrl('charge-zealous-south', i),
  frameDurationsMs: HEALER_CHARGE_FRAME_DURATIONS_MS,
};

export const HEALER_SOLEMN_CAST_ANIM: HealerStripAnimDef = {
  animKey: HEALER_SOLEMN_CAST_ANIM_KEY,
  frameCount: 9,
  loop: false,
  frameKey: (i) => healerFrameKey('cast-solemn', i),
  frameUrl: (i) => healerFrameUrl('cast-solemn-south', i),
  frameDurationsMs: HEALER_CAST_FRAME_DURATIONS_MS,
};

export const HEALER_ZEALOUS_CAST_ANIM: HealerStripAnimDef = {
  animKey: HEALER_ZEALOUS_CAST_ANIM_KEY,
  frameCount: 9,
  loop: false,
  frameKey: (i) => healerFrameKey('cast-zealous', i),
  frameUrl: (i) => healerFrameUrl('cast-zealous-south', i),
  frameDurationsMs: HEALER_CAST_FRAME_DURATIONS_MS,
};

/** BootScene preloads + registers all healer strips from this list. */
export const HEALER_STRIP_ANIMS: readonly HealerStripAnimDef[] = [
  HEALER_IDLE_ANIM,
  HEALER_ZAP_ANIM,
  HEALER_VOWSTRIKE_ANIM,
  HEALER_SOLEMN_CHARGE_ANIM,
  HEALER_ZEALOUS_CHARGE_ANIM,
  HEALER_SOLEMN_CAST_ANIM,
  HEALER_ZEALOUS_CAST_ANIM,
];

/** Anim keys for the active Solemn / Zealous cast pipeline. */
export const HEALER_CAST_STYLE_ANIMS: Record<
  HealerCastStyle,
  { chargeAnimKey: string; castAnimKey: string }
> = {
  solemn: {
    chargeAnimKey: HEALER_SOLEMN_CHARGE_ANIM_KEY,
    castAnimKey: HEALER_SOLEMN_CAST_ANIM_KEY,
  },
  zealous: {
    chargeAnimKey: HEALER_ZEALOUS_CHARGE_ANIM_KEY,
    castAnimKey: HEALER_ZEALOUS_CAST_ANIM_KEY,
  },
};

/** Phaser anim frame entries for a healer strip (skips duration ≤ 0). */
export function healerStripAnimFrames(
  def: HealerStripAnimDef,
): ReadonlyArray<{ key: string; duration: number }> {
  return buildStripFrames(def);
}

/** One-shot green sparkle burst played over a heal target (192×32 = 6 frames of 32×32). */
export const HEAL_VFX_TEXTURE_KEY = 'heal-vfx';
export const HEAL_VFX_URL = 'assets/heal-vfx.png';
export const HEAL_VFX_FRAME_SIZE = 32;
export const HEAL_VFX_FRAME_COUNT = 6;

/** One-shot pale-gold impact burst played on the enemy target when Bonk lands
 *  (192×32 = 6 frames of 32×32), mirroring the heal sparkle wiring. */
export const ZAP_VFX_TEXTURE_KEY = 'zap-vfx';
export const ZAP_VFX_URL = 'assets/zap-vfx.png';
export const ZAP_VFX_FRAME_SIZE = 32;
export const ZAP_VFX_FRAME_COUNT = 6;
/** Per-frame holds: quick pop, brief dwell on the flash, fade. Not equal times. */
export const ZAP_VFX_FRAME_DURATIONS_MS: readonly number[] = [50, 67, 100, 83, 67, 50] as const;

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
 * PixelLab stills; the 32×32 healer sheet is wired separately in CombatScene
 * (cast frames). Remaining trash/bosses stay on Kenney.
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
