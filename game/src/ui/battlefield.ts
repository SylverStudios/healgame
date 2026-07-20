/**
 * Combat battlefield: layered backdrop (code sky gradient + far silhouette +
 * PixelLab structure props) and two FE-GBA-style perspective platform slices
 * under the party/enemy lines (docs/ui-theme-research.md §1/§4 item 1).
 * Replaces the old flat 2px ground-line rect.
 *
 * Everything here is presentation-only, non-interactive (no `setInteractive`
 * calls — journey never targets battlefield objects), and drawn at depth
 * <= -1 so it always sits behind unit bodies (unit bodies start at depth 1,
 * see `unitSprite.ts`).
 *
 * Density rule (art/STYLE.md, docs/ui-theme-research.md "Hard constraints"):
 * every PixelLab texture here is authored at native "art grid" size (1 art
 * px = 2 screen px) and displayed at exactly 2x with nearest-neighbor
 * (`pixelArt: true`, set once in `main.ts`) — only x/y/depth vary per layout,
 * texture pixels are never rescaled.
 *
 * `buildBattlefield(scene, variantKey, params)` is keyed by a variant string
 * — chunk 2 shipped only `'ash-gate'`; chunk 8 (`docs/ui-theme-handoff.md`
 * chunk table) generalized `VARIANT_TEXTURES`/the image-layout math to all 6
 * dungeon ids and added `battlefieldForEncounter()` on top, without
 * reshaping `buildBattlefield`/`battlefieldTexturesForVariant` themselves.
 */

import Phaser from 'phaser';
import { PALETTE_NUM } from './theme';

/** One entry per dungeon (`data/dungeons/index.ts` DUNGEON_ORDER) — closed
 *  union so an unknown/mistyped variant is a compile error, not a silent
 *  runtime miss. Not every key necessarily has shipped art yet; see
 *  `VARIANT_TEXTURES` below and `battlefieldForEncounter()`'s fallback. */
export type BattlefieldVariantKey =
  | 'ash-gate'
  | 'iron-pass'
  | 'cinder-vault'
  | 'verdant-rift'
  | 'black-choir'
  | 'the-maw';

/** One PixelLab-sourced battlefield texture; BootScene preloads every entry
 *  a variant needs via {@link battlefieldTexturesForVariant} /
 *  {@link allBattlefieldTextures}. */
export interface BattlefieldTexture {
  readonly key: string;
  readonly url: string;
  /** Native "art grid" size (pre-2x) — informational; drives no scaling here. */
  readonly nativeWidth: number;
  readonly nativeHeight: number;
}

/** The three structure-prop textures every battlefield variant composes:
 *  a centered gate/arch-equivalent, a mirrored wall-fragment prop, and one
 *  platform slice (reused under both the party and enemy line). */
interface BattlefieldVariantTextures {
  readonly gateArch: BattlefieldTexture;
  readonly wallFragment: BattlefieldTexture;
  readonly platform: BattlefieldTexture;
}

// Recolors of the ash-gate source objects (chunk 8) keep the exact same
// canvas sizes as their source (PixelLab `create_object_state` re-skins
// color/material, not composition) — one shared size per asset slot.
const GATE_ARCH_NATIVE = { nativeWidth: 300, nativeHeight: 200 } as const;
const WALL_FRAGMENT_NATIVE = { nativeWidth: 140, nativeHeight: 110 } as const;
const PLATFORM_NATIVE = { nativeWidth: 170, nativeHeight: 40 } as const;

// ---- Ash Gate (chunk 2) — frozen; do not regenerate or rename these keys ---

const ASHGATE_GATE_ARCH: BattlefieldTexture = {
  key: 'battlefield-ashgate-gate-arch',
  url: 'assets/battlefields/ashgate/gate-arch.png',
  ...GATE_ARCH_NATIVE,
};
const ASHGATE_WALL_FRAGMENT: BattlefieldTexture = {
  key: 'battlefield-ashgate-wall-fragment',
  url: 'assets/battlefields/ashgate/wall-fragment.png',
  ...WALL_FRAGMENT_NATIVE,
};
const ASHGATE_PLATFORM: BattlefieldTexture = {
  key: 'battlefield-ashgate-platform',
  url: 'assets/battlefields/ashgate/platform.png',
  ...PLATFORM_NATIVE,
};

/** Builds the 3-texture set for a variant whose art lives at
 *  `assets/battlefields/<folder>/{gate-arch,wall-fragment,platform}.png`,
 *  keyed `battlefield-<variant>-...` for BootScene/Phaser texture lookup. */
function variantTextures(variant: BattlefieldVariantKey, folder: string): BattlefieldVariantTextures {
  return {
    gateArch: {
      key: `battlefield-${variant}-gate-arch`,
      url: `assets/battlefields/${folder}/gate-arch.png`,
      ...GATE_ARCH_NATIVE,
    },
    wallFragment: {
      key: `battlefield-${variant}-wall-fragment`,
      url: `assets/battlefields/${folder}/wall-fragment.png`,
      ...WALL_FRAGMENT_NATIVE,
    },
    platform: {
      key: `battlefield-${variant}-platform`,
      url: `assets/battlefields/${folder}/platform.png`,
      ...PLATFORM_NATIVE,
    },
  };
}

/** variant -> its PixelLab structure-prop textures. `Partial` because a
 *  dungeon whose art didn't ship (budget/timebox) simply has no entry here
 *  — {@link battlefieldTexturesForVariant} and {@link battlefieldForEncounter}
 *  both fall back to `'ash-gate'` in that case, never a runtime crash. */
const VARIANT_TEXTURES: Partial<Record<BattlefieldVariantKey, BattlefieldVariantTextures>> = {
  'ash-gate': {
    gateArch: ASHGATE_GATE_ARCH,
    wallFragment: ASHGATE_WALL_FRAGMENT,
    platform: ASHGATE_PLATFORM,
  },
  'iron-pass': variantTextures('iron-pass', 'iron-pass'),
  'cinder-vault': variantTextures('cinder-vault', 'cinder-vault'),
  'verdant-rift': variantTextures('verdant-rift', 'verdant-rift'),
  'black-choir': variantTextures('black-choir', 'black-choir'),
  'the-maw': variantTextures('the-maw', 'the-maw'),
};

function texturesForVariant(variant: BattlefieldVariantKey): BattlefieldVariantTextures {
  // Non-null: 'ash-gate' always has an entry above, so this can only be
  // undefined for a variant with no shipped art, which falls back to it.
  return VARIANT_TEXTURES[variant] ?? (VARIANT_TEXTURES['ash-gate'] as BattlefieldVariantTextures);
}

/** Every texture a variant needs — BootScene loops this to `this.load.image(...)`. */
export function battlefieldTexturesForVariant(
  variant: BattlefieldVariantKey,
): readonly BattlefieldTexture[] {
  const textures = texturesForVariant(variant);
  return [textures.gateArch, textures.wallFragment, textures.platform];
}

const ALL_VARIANT_KEYS: readonly BattlefieldVariantKey[] = [
  'ash-gate',
  'iron-pass',
  'cinder-vault',
  'verdant-rift',
  'black-choir',
  'the-maw',
];

/** Union of every texture across every variant, deduped by key — BootScene
 *  preloads this once instead of looping `battlefieldTexturesForVariant` per
 *  variant and re-queuing the same ash-gate fallback images repeatedly for
 *  any dungeon that didn't ship its own art. */
export function allBattlefieldTextures(): readonly BattlefieldTexture[] {
  const seen = new Map<string, BattlefieldTexture>();
  for (const variant of ALL_VARIANT_KEYS) {
    for (const texture of battlefieldTexturesForVariant(variant)) {
      seen.set(texture.key, texture);
    }
  }
  return [...seen.values()];
}

// ---- encounter -> variant lookup (chunk 8) ---------------------------------

// Only variants with shipped art are listed — compile.ts pins
// `EncounterDef.id === dungeon.id`, so this keys directly off encounterId
// with no extra lookup table. Any dungeon id not listed here (art not shipped
// this chunk, or a genuinely unknown id) falls back to 'ash-gate' below.
const ENCOUNTER_VARIANT: Partial<Record<string, BattlefieldVariantKey>> = {
  'ash-gate': 'ash-gate',
  'iron-pass': 'iron-pass',
  'cinder-vault': 'cinder-vault',
  'verdant-rift': 'verdant-rift',
  'black-choir': 'black-choir',
  'the-maw': 'the-maw',
};

/** Resolves an encounter/dungeon id to its battlefield variant, defaulting
 *  unknown or not-yet-themed ids to `'ash-gate'` (safe fallback — matches
 *  the chunk-2-era behavior where every dungeon reused Ash Gate art). */
export function battlefieldForEncounter(encounterId: string): BattlefieldVariantKey {
  return ENCOUNTER_VARIANT[encounterId] ?? 'ash-gate';
}

// ---- pure layout math (colocated battlefield.test.ts covers this) ---------

/** Placement for one PixelLab image layer — everything Phaser needs to add + position it. */
export interface BattlefieldImageLayout {
  readonly textureKey: string;
  readonly x: number;
  readonly y: number;
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly depth: number;
  readonly flipX?: boolean;
}

/** Pinned contract (chunk-2 brief): battlefield objects never intercept input,
 *  so every depth here must stay behind unit bodies (depth 1+, unitSprite.ts). */
export const BACKDROP_DEPTH_STRUCTURE = -4;
export const BACKDROP_DEPTH_HAZE = -2;
export const BACKDROP_DEPTH_PLATFORM = -1;

/** How much the wall-fragment props overlap the gate arch's outer edge — the
 *  arch renders as a self-contained opaque diorama (see pixellab-1/README.md
 *  "gate-arch has no alpha channel"), so the fragments both extend the ruins
 *  to the screen edges *and* mask that seam. Every variant's gate-arch is a
 *  recolor of the same source object, so it shares this property. */
const WALL_FRAGMENT_OVERLAP_PX = 100;

/**
 * Image-layer placement for `textures` given the combat view's frozen layout
 * constants (`CombatScene.ts`: GROUND_Y, party/enemy slot centers). Pure —
 * no Phaser objects — so it's unit-testable without a scene. Composition is
 * locked across every variant (arch centered, two mirrored wall-fragments,
 * platform under each line) — chunk 8 parameterized this by texture set
 * instead of forking a copy per dungeon; only the art referenced changes.
 */
export function battlefieldImageLayouts(
  textures: BattlefieldVariantTextures,
  params: { viewWidth: number; groundY: number; partyCenterX: number; enemyCenterX: number },
): BattlefieldImageLayout[] {
  const { viewWidth, groundY, partyCenterX, enemyCenterX } = params;
  const { gateArch, wallFragment, platform } = textures;
  const centerX = viewWidth / 2;

  const archW = gateArch.nativeWidth * 2;
  const archH = gateArch.nativeHeight * 2;
  // Arch bottom (its painted walkway/braziers) sits just under GROUND_Y — the
  // platform slices draw in front of it (depth -1 > -4) and cover the seam.
  const archBottomY = groundY + 5;

  const fragW = wallFragment.nativeWidth * 2;
  const fragH = wallFragment.nativeHeight * 2;
  const fragBottomY = groundY + 30;
  const fragOffsetX = archW / 2 + fragW / 2 - WALL_FRAGMENT_OVERLAP_PX;

  const platformW = platform.nativeWidth * 2;
  const platformH = platform.nativeHeight * 2;
  const platformY = groundY + 30;

  return [
    {
      textureKey: gateArch.key,
      x: centerX,
      y: archBottomY - archH / 2,
      displayWidth: archW,
      displayHeight: archH,
      depth: BACKDROP_DEPTH_STRUCTURE,
    },
    {
      textureKey: wallFragment.key,
      x: centerX - fragOffsetX,
      y: fragBottomY - fragH / 2,
      displayWidth: fragW,
      displayHeight: fragH,
      depth: BACKDROP_DEPTH_STRUCTURE,
      flipX: true,
    },
    {
      textureKey: wallFragment.key,
      x: centerX + fragOffsetX,
      y: fragBottomY - fragH / 2,
      displayWidth: fragW,
      displayHeight: fragH,
      depth: BACKDROP_DEPTH_STRUCTURE,
    },
    {
      textureKey: platform.key,
      x: partyCenterX,
      y: platformY,
      displayWidth: platformW,
      displayHeight: platformH,
      depth: BACKDROP_DEPTH_PLATFORM,
    },
    {
      textureKey: platform.key,
      x: enemyCenterX,
      y: platformY,
      displayWidth: platformW,
      displayHeight: platformH,
      depth: BACKDROP_DEPTH_PLATFORM,
      flipX: true,
    },
  ];
}

/**
 * Haze-band placement (code-drawn — see pixellab-1/README.md: three
 * `create_map_object` rerolls of an ember-haze prop failed to converge
 * — one came back fully transparent, one came back near-empty — so this
 * layer stays code-drawn rather than grinding a fourth reroll, per the
 * phase's timebox rule). Geometry is identical for every variant (only the
 * tone passed to {@link buildAtmosphereHaze} changes) — pure numbers so the
 * geometry is testable.
 */
export function battlefieldHazeBandLayout(groundY: number): { y: number; height: number } {
  return { y: groundY - 40, height: 36 };
}

// ---- linear-interpolate two theme colors (no new hex constants) -----------

function mixPaletteColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

/** Per-variant sky-horizon/haze tone + haze-mote color — all `mixPaletteColor`
 *  blends of `PALETTE_NUM` entries (no new hex constants), chosen to read as
 *  each dungeon's flavor (chunk 8, docs/ui-theme-research.md §4 item 8):
 *  ash-gate = ember orange (unchanged from chunk 2), iron-pass = cool
 *  blue-white frost, cinder-vault = hotter ember, verdant-rift = bio green,
 *  black-choir = faint ghost-blue candlelight, the-maw = deep void red. */
const VARIANT_ATMOSPHERE: Record<BattlefieldVariantKey, { hazeTone: number; moteColor: number }> = {
  'ash-gate': {
    hazeTone: mixPaletteColor(PALETTE_NUM.bg, PALETTE_NUM.danger, 0.18),
    moteColor: PALETTE_NUM.gold,
  },
  'iron-pass': {
    hazeTone: mixPaletteColor(PALETTE_NUM.bg, PALETTE_NUM.mana, 0.24),
    moteColor: PALETTE_NUM.mana,
  },
  'cinder-vault': {
    hazeTone: mixPaletteColor(PALETTE_NUM.bg, PALETTE_NUM.danger, 0.32),
    moteColor: PALETTE_NUM.gold,
  },
  'verdant-rift': {
    hazeTone: mixPaletteColor(PALETTE_NUM.bg, PALETTE_NUM.health, 0.22),
    moteColor: PALETTE_NUM.health,
  },
  'black-choir': {
    hazeTone: mixPaletteColor(PALETTE_NUM.bg, PALETTE_NUM.mana, 0.12),
    moteColor: PALETTE_NUM.dim,
  },
  'the-maw': {
    hazeTone: mixPaletteColor(PALETTE_NUM.bg, PALETTE_NUM.danger, 0.1),
    moteColor: PALETTE_NUM.danger,
  },
};

// ---- scene wiring -----------------------------------------------------------

/**
 * Builds the full layered battlefield for `variant` into `scene`, back to
 * front: sky gradient -> far silhouette -> structure props -> haze band ->
 * platform slices. Call once from `CombatScene.create()` in place of the old
 * `buildGroundLine()`. No return value — every object it creates is static,
 * non-interactive set-dressing; the scene never needs to reach back into it.
 */
export function buildBattlefield(
  scene: Phaser.Scene,
  variant: BattlefieldVariantKey,
  params: { viewWidth: number; viewHeight: number; groundY: number; partyCenterX: number; enemyCenterX: number },
): void {
  const { viewWidth, viewHeight, groundY } = params;
  const atmosphere = VARIANT_ATMOSPHERE[variant];

  buildSkyGradient(scene, viewWidth, viewHeight, groundY, atmosphere.hazeTone);
  buildFarSilhouette(scene, viewWidth, groundY);
  buildAtmosphereHaze(scene, viewWidth, groundY, atmosphere.hazeTone, atmosphere.moteColor);

  const textures = texturesForVariant(variant);
  for (const layout of battlefieldImageLayouts(textures, params)) {
    const image = scene.add
      .image(layout.x, layout.y, layout.textureKey)
      .setDisplaySize(layout.displayWidth, layout.displayHeight)
      .setDepth(layout.depth);
    if (layout.flipX === true) image.setFlipX(true);
  }
}

/** Two-stop-feeling gradient: bg -> horizon tone -> near-black floor shadow,
 *  drawn as two stacked Graphics gradients (Phaser gradients only
 *  interpolate linearly between two colors per rect). */
function buildSkyGradient(
  scene: Phaser.Scene,
  viewWidth: number,
  viewHeight: number,
  groundY: number,
  horizonTone: number,
): void {
  const floorTone = mixPaletteColor(PALETTE_NUM.borderDark, 0x000000, 0.4);

  const graphics = scene.add.graphics().setDepth(-6);
  graphics.fillGradientStyle(PALETTE_NUM.bg, PALETTE_NUM.bg, horizonTone, horizonTone, 1);
  graphics.fillRect(0, 0, viewWidth, groundY);
  graphics.fillGradientStyle(horizonTone, horizonTone, floorTone, floorTone, 1);
  graphics.fillRect(0, groundY, viewWidth, viewHeight - groundY);
}

/** Jagged distant skyline — visible mainly at the corners the structure
 *  props don't reach, giving the backdrop a sense of depth beyond them.
 *  Stays a flat dark silhouette across every variant (no theme-specific
 *  tone) — it reads as distant terrain regardless of the foreground dungeon. */
function buildFarSilhouette(scene: Phaser.Scene, viewWidth: number, groundY: number): void {
  const baseY = groundY - 80;
  const peakSpan = 60;
  const points: number[] = [0, groundY + 4];
  const step = 48;
  let toggle = 0;
  for (let x = 0; x <= viewWidth; x += step) {
    const y = toggle % 2 === 0 ? baseY : baseY + peakSpan;
    points.push(x, y);
    toggle++;
  }
  points.push(viewWidth, groundY + 4);

  const graphics = scene.add.graphics().setDepth(-5);
  graphics.fillStyle(PALETTE_NUM.borderDark, 0.9);
  graphics.beginPath();
  graphics.moveTo(points[0] ?? 0, points[1] ?? baseY);
  for (let i = 2; i < points.length; i += 2) {
    graphics.lineTo(points[i] ?? 0, points[i + 1] ?? baseY);
  }
  graphics.closePath();
  graphics.fillPath();
}

/** Drifting haze band (code fallback for the failed map_object prop — see
 *  {@link battlefieldHazeBandLayout}): a soft tinted band plus a few glow
 *  motes, in front of the structure props, behind the platform slices.
 *  `tone`/`moteColor` are the only per-variant inputs (chunk 8) — geometry
 *  is shared. */
function buildAtmosphereHaze(
  scene: Phaser.Scene,
  viewWidth: number,
  groundY: number,
  tone: number,
  moteColor: number,
): void {
  const { y, height } = battlefieldHazeBandLayout(groundY);
  const graphics = scene.add.graphics().setDepth(BACKDROP_DEPTH_HAZE);
  graphics.fillStyle(tone, 0.16);
  graphics.fillRect(0, y, viewWidth, height);

  const moteCount = 10;
  for (let i = 0; i < moteCount; i++) {
    const x = ((i + 0.5) / moteCount) * viewWidth;
    const motelY = y + height * (0.25 + 0.5 * ((i * 37) % 10) / 10);
    scene.add
      .circle(x, motelY, 1.5, moteColor, 0.35)
      .setDepth(BACKDROP_DEPTH_HAZE);
  }
}
