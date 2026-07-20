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
 * `buildBattlefield(scene, variantKey)` is deliberately keyed by a variant
 * string even though `'ashgate'` is the only variant today — chunk 8
 * (`docs/ui-theme-handoff.md` chunk table) adds `battlefieldForEncounter()`
 * on top of this without reshaping the API.
 */

import Phaser from 'phaser';
import { PALETTE_NUM } from './theme';

export type BattlefieldVariantKey = 'ashgate';

/** One PixelLab-sourced battlefield texture; BootScene preloads every entry
 *  a variant needs via {@link battlefieldTexturesForVariant}. */
export interface BattlefieldTexture {
  readonly key: string;
  readonly url: string;
  /** Native "art grid" size (pre-2x) — informational; drives no scaling here. */
  readonly nativeWidth: number;
  readonly nativeHeight: number;
}

const ASHGATE_GATE_ARCH: BattlefieldTexture = {
  key: 'battlefield-ashgate-gate-arch',
  url: 'assets/battlefields/ashgate/gate-arch.png',
  nativeWidth: 300,
  nativeHeight: 200,
};
const ASHGATE_WALL_FRAGMENT: BattlefieldTexture = {
  key: 'battlefield-ashgate-wall-fragment',
  url: 'assets/battlefields/ashgate/wall-fragment.png',
  nativeWidth: 140,
  nativeHeight: 110,
};
const ASHGATE_PLATFORM: BattlefieldTexture = {
  key: 'battlefield-ashgate-platform',
  url: 'assets/battlefields/ashgate/platform.png',
  nativeWidth: 170,
  nativeHeight: 40,
};

/** variant -> its PixelLab textures. Only 'ashgate' ships; extend this map
 *  (never the function shape) when chunk 8 adds per-dungeon variants. */
const VARIANT_TEXTURES: Record<BattlefieldVariantKey, readonly BattlefieldTexture[]> = {
  ashgate: [ASHGATE_GATE_ARCH, ASHGATE_WALL_FRAGMENT, ASHGATE_PLATFORM],
};

/** Every texture a variant needs — BootScene loops this to `this.load.image(...)`. */
export function battlefieldTexturesForVariant(
  variant: BattlefieldVariantKey,
): readonly BattlefieldTexture[] {
  return VARIANT_TEXTURES[variant];
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
 *  to the screen edges *and* mask that seam. */
const WALL_FRAGMENT_OVERLAP_PX = 100;

/**
 * Ash Gate image-layer placement given the combat view's frozen layout
 * constants (`CombatScene.ts`: GROUND_Y, party/enemy slot centers). Pure —
 * no Phaser objects — so it's unit-testable without a scene.
 */
export function ashGateImageLayouts(params: {
  viewWidth: number;
  groundY: number;
  partyCenterX: number;
  enemyCenterX: number;
}): BattlefieldImageLayout[] {
  const { viewWidth, groundY, partyCenterX, enemyCenterX } = params;
  const centerX = viewWidth / 2;

  const archW = ASHGATE_GATE_ARCH.nativeWidth * 2;
  const archH = ASHGATE_GATE_ARCH.nativeHeight * 2;
  // Arch bottom (its painted walkway/braziers) sits just under GROUND_Y — the
  // platform slices draw in front of it (depth -1 > -4) and cover the seam.
  const archBottomY = groundY + 5;

  const fragW = ASHGATE_WALL_FRAGMENT.nativeWidth * 2;
  const fragH = ASHGATE_WALL_FRAGMENT.nativeHeight * 2;
  const fragBottomY = groundY + 30;
  const fragOffsetX = archW / 2 + fragW / 2 - WALL_FRAGMENT_OVERLAP_PX;

  const platformW = ASHGATE_PLATFORM.nativeWidth * 2;
  const platformH = ASHGATE_PLATFORM.nativeHeight * 2;
  const platformY = groundY + 30;

  return [
    {
      textureKey: ASHGATE_GATE_ARCH.key,
      x: centerX,
      y: archBottomY - archH / 2,
      displayWidth: archW,
      displayHeight: archH,
      depth: BACKDROP_DEPTH_STRUCTURE,
    },
    {
      textureKey: ASHGATE_WALL_FRAGMENT.key,
      x: centerX - fragOffsetX,
      y: fragBottomY - fragH / 2,
      displayWidth: fragW,
      displayHeight: fragH,
      depth: BACKDROP_DEPTH_STRUCTURE,
      flipX: true,
    },
    {
      textureKey: ASHGATE_WALL_FRAGMENT.key,
      x: centerX + fragOffsetX,
      y: fragBottomY - fragH / 2,
      displayWidth: fragW,
      displayHeight: fragH,
      depth: BACKDROP_DEPTH_STRUCTURE,
    },
    {
      textureKey: ASHGATE_PLATFORM.key,
      x: partyCenterX,
      y: platformY,
      displayWidth: platformW,
      displayHeight: platformH,
      depth: BACKDROP_DEPTH_PLATFORM,
    },
    {
      textureKey: ASHGATE_PLATFORM.key,
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
 * Ember-haze band placement (code-drawn — see pixellab-1/README.md: three
 * `create_map_object` rerolls of an ember-haze prop failed to converge
 * — one came back fully transparent, one came back near-empty — so this
 * layer stays code-drawn rather than grinding a fourth reroll, per the
 * phase's timebox rule). Pure numbers so the geometry is testable.
 */
export function ashGateHazeBandLayout(groundY: number): { y: number; height: number } {
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

// ---- scene wiring -----------------------------------------------------------

/**
 * Builds the full layered battlefield for `variant` into `scene`, back to
 * front: sky gradient -> far silhouette -> structure props -> ember haze ->
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

  buildSkyGradient(scene, viewWidth, viewHeight, groundY);
  buildFarSilhouette(scene, viewWidth, groundY);

  const horizonTone = mixPaletteColor(PALETTE_NUM.bg, PALETTE_NUM.danger, 0.18);
  buildEmberHaze(scene, viewWidth, groundY, horizonTone);

  for (const layout of ashGateImageLayouts(params)) {
    const image = scene.add
      .image(layout.x, layout.y, layout.textureKey)
      .setDisplaySize(layout.displayWidth, layout.displayHeight)
      .setDepth(layout.depth);
    if (layout.flipX === true) image.setFlipX(true);
  }
  void variant; // single variant today; kept as a param for the chunk-8 lookup
}

/** Two-stop-feeling gradient: bg -> warm ember horizon -> near-black floor
 *  shadow, drawn as two stacked Graphics gradients (Phaser gradients only
 *  interpolate linearly between two colors per rect). */
function buildSkyGradient(scene: Phaser.Scene, viewWidth: number, viewHeight: number, groundY: number): void {
  const horizonTone = mixPaletteColor(PALETTE_NUM.bg, PALETTE_NUM.danger, 0.18);
  const floorTone = mixPaletteColor(PALETTE_NUM.borderDark, 0x000000, 0.4);

  const graphics = scene.add.graphics().setDepth(-6);
  graphics.fillGradientStyle(PALETTE_NUM.bg, PALETTE_NUM.bg, horizonTone, horizonTone, 1);
  graphics.fillRect(0, 0, viewWidth, groundY);
  graphics.fillGradientStyle(horizonTone, horizonTone, floorTone, floorTone, 1);
  graphics.fillRect(0, groundY, viewWidth, viewHeight - groundY);
}

/** Jagged distant skyline — visible mainly at the corners the structure
 *  props don't reach, giving the backdrop a sense of depth beyond them. */
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

/** Drifting ember-haze band (code fallback for the failed map_object prop —
 *  see {@link ashGateHazeBandLayout}): a soft tinted band plus a few glow
 *  motes, in front of the structure props, behind the platform slices. */
function buildEmberHaze(scene: Phaser.Scene, viewWidth: number, groundY: number, tone: number): void {
  const { y, height } = ashGateHazeBandLayout(groundY);
  const graphics = scene.add.graphics().setDepth(BACKDROP_DEPTH_HAZE);
  graphics.fillStyle(tone, 0.16);
  graphics.fillRect(0, y, viewWidth, height);

  const moteCount = 10;
  for (let i = 0; i < moteCount; i++) {
    const x = ((i + 0.5) / moteCount) * viewWidth;
    const motelY = y + height * (0.25 + 0.5 * ((i * 37) % 10) / 10);
    scene.add
      .circle(x, motelY, 1.5, PALETTE_NUM.gold, 0.35)
      .setDepth(BACKDROP_DEPTH_HAZE);
  }
}
