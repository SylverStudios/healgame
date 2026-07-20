/**
 * Talent-tree node socket + edge-strip presentation (bible item 7, chunk 7 of
 * docs/ui-theme-handoff.md). Replaces `TreeScene`'s plain `add.circle` node
 * background border and `graphics.lineStyle` edge draws with a small PixelLab
 * frame kit, mirroring the split `ui/panels.ts` and `ui/spellSprites.ts`
 * already established: fine bevel/rivet detail is illegible below ~12px
 * (chunk 3/4 findings), so this ships exactly two generated textures — one
 * circular socket ring, one horizontal edge-groove strip — each **tinted per
 * state** via `setTint` rather than generated once per state. The socket's
 * own circular hit-area/fill (`add.circle`, `setName('treeNode:<id>')`) stays
 * exactly as `TreeScene` already draws it; this module only adds a frame
 * `Image` on top and, when the texture isn't loaded, callers keep the
 * original `setStrokeStyle` look (see `TreeScene.renderSpotBox`'s `framed`
 * check) — same graceful-fallback shape as `ui/panels.ts`'s `Frame`.
 *
 * A dedicated module (not `ui/panels.ts`) because a talent-tree socket is a
 * small circular 4(+)-state badge, not a resizable rectangular nine-slice
 * panel/button/banner — `panels.ts`'s `Frame` (corner + stretched-edge
 * rectangle composition) doesn't fit a circle, and forcing it through that
 * shape would be more code than this file. The edge-strip renderer is new
 * for the same reason: nothing else in the UI kit draws a rotated stretched
 * strip between two arbitrary points.
 */

import Phaser from 'phaser';
import { PALETTE_NUM } from './theme';
import type { EdgeState, SpotStatus } from '../tree';

// ---- textures ---------------------------------------------------------

/** Socket ring: native 20×20 art px (half `NODE_SIZE`=40 display, density
 *  rule), hollow center so the existing fill circle shows through. */
export const SOCKET_TEXTURE_KEY = 'ui-tree-socket';
export const SOCKET_TEXTURE_URL = 'assets/ui/tree/socket-ring.png';
export const SOCKET_NATIVE_SIZE = 20;

/** Edge-groove strip: a short native crop stretched to each edge's actual
 *  on-screen length via `setDisplaySize` — same "stretch, don't tile" call
 *  chunk 4 made for the panel-kit edge band (avoids needing a seamlessly
 *  tileable texture / `TileSprite`). Native 48×8 art px (a rim+groove+rim
 *  cross-section band cropped from the generated sheet's rune-tick row —
 *  see artifacts/pixellab-7/README.md; individual rune glyphs don't survive
 *  the downsample, but the alternating light/dark banding still reads as a
 *  carved groove, unlike a flatter crop that reduced to plain mud). */
export const EDGE_STRIP_TEXTURE_KEY = 'ui-tree-edge-strip';
export const EDGE_STRIP_TEXTURE_URL = 'assets/ui/tree/edge-strip.png';
export const EDGE_STRIP_NATIVE_WIDTH = 48;
export const EDGE_STRIP_NATIVE_HEIGHT = 8;

export interface TreeUiTexture {
  readonly key: string;
  readonly url: string;
}

/** Both textures this chunk ships — BootScene preloads via this loop, same
 *  convention as `panelKitTextures()` / `spellBarTextures()`. */
export function treeUiTextures(): readonly TreeUiTexture[] {
  return [
    { key: SOCKET_TEXTURE_KEY, url: SOCKET_TEXTURE_URL },
    { key: EDGE_STRIP_TEXTURE_KEY, url: EDGE_STRIP_TEXTURE_URL },
  ];
}

// ---- edge-state palette (moved here from TreeScene; same hex values) -----

/**
 * v0.3 lattice edge palette — four visually distinct states (handoff §Done-6,
 * "Lattice tree" locked choice): traversed is the bright "lit path", locked
 * is a clearly dead branch (dark red + a broken line / X), available and
 * inactive fall between at decreasing intensity. None of these four have a
 * `PALETTE_NUM` equivalent (they're a distinct semantic ramp, not reused
 * elsewhere), so per the phase's "migrate where it doesn't change semantics"
 * rule they stay local named consts here rather than folding into the
 * general palette.
 */
export const EDGE_TRAVERSED = 0xfff2df;
export const EDGE_AVAILABLE = 0xc79a52;
export const EDGE_INACTIVE = 0x4a3a30;
export const EDGE_LOCKED = 0x8a2a20;

/** Line/strip weight (display px) for a given edge state. Textured strip
 *  states (traversed/available/locked) use a slightly heavier weight than
 *  the old flat line so the groove art actually reads; `inactive` keeps its
 *  original 1px — a textured strip at that weight reads as noise, not
 *  detail (bible §5 "your call" judgment, matches the panels-kit precedent
 *  of leaving very thin elements unframed). */
export function edgeDisplayWeight(state: EdgeState): number {
  switch (state) {
    case 'traversed':
      return 7;
    case 'available':
      return 4;
    case 'locked':
      return 4;
    case 'inactive':
    default:
      return 1;
  }
}

/** Draw alpha for a given edge state — unchanged from the pre-chunk-7 values. */
export function edgeAlpha(state: EdgeState): number {
  switch (state) {
    case 'traversed':
      return 1;
    case 'available':
      return 0.7;
    case 'locked':
      return 0.85;
    case 'inactive':
    default:
      return 0.45;
  }
}

/** Tint color for a given edge state. */
export function edgeTint(state: EdgeState): number {
  switch (state) {
    case 'traversed':
      return EDGE_TRAVERSED;
    case 'available':
      return EDGE_AVAILABLE;
    case 'locked':
      return EDGE_LOCKED;
    case 'inactive':
    default:
      return EDGE_INACTIVE;
  }
}

/** Whether an edge state's strip is drawn with the textured `Image` renderer
 *  (`drawEdgeStrip`) vs. the original thin `Graphics.lineBetween` — only
 *  `inactive` stays a plain line (see `edgeDisplayWeight` doc). */
export function edgeUsesTexturedStrip(state: EdgeState): boolean {
  return state !== 'inactive';
}

// ---- socket state -------------------------------------------------------

/** Socket ring visual state — the "richer visuals, same semantic mapping"
 *  bible instruction: this mirrors `TreeScene.renderSpotBox`'s pre-chunk-7
 *  if/else chain exactly (see `socketVisualState`), just named as its own
 *  small enum instead of inline bg/border color juggling. `armed` is
 *  TreeScene-local (the exclusive-group arm-to-confirm click), not a
 *  `SpotStatus` value. */
export type SocketVisualState = 'locked' | 'affordable' | 'owned' | 'exclusive-locked' | 'armed';

/**
 * Resolves a node's ring/tint state from the same three inputs
 * `renderSpotBox` already had (`spot.status`, whether any rank is owned, and
 * the in-memory arm-confirmation flag) — pulled out to a pure function so
 * the status→visual mapping has a single, testable source of truth instead
 * of living only inside an if/else chain in the scene.
 */
export function socketVisualState(status: SpotStatus, owned: boolean, isArmed: boolean): SocketVisualState {
  if (status === 'exclusive-locked') return 'exclusive-locked';
  if (isArmed) return 'armed';
  if (status === 'affordable') return 'affordable';
  if (status === 'complete' || (owned && status !== 'locked')) return 'owned';
  return 'locked';
}

/** Ring tint per {@link SocketVisualState}. `exclusive-locked` reuses the
 *  edge palette's dead-branch red (`EDGE_LOCKED`) so a permanently-closed
 *  path reads consistently whether you're looking at the node or the edge
 *  feeding it. `armed` reuses `PALETTE_NUM.danger` (equal to the pre-chunk-7
 *  local `ARM_HEX` — a real migration, not a new hex). */
export function socketRingTint(state: SocketVisualState): number {
  switch (state) {
    case 'affordable':
      return PALETTE_NUM.gold;
    case 'armed':
      return PALETTE_NUM.danger;
    case 'owned':
      return PALETTE_NUM.health;
    case 'exclusive-locked':
      return EDGE_LOCKED;
    case 'locked':
    default:
      return PALETTE_NUM.borderDark;
  }
}

// ---- pure geometry (vitest-safe: Math only, no Phaser.Math — see handoff
// "Gotcha for any future module with both a colocated pure-logic test AND a
// real Phaser.Math.* call at module scope") --------------------------------

export interface EdgeGeometry {
  readonly length: number;
  readonly angleRad: number;
  readonly midX: number;
  readonly midY: number;
}

/** Length/angle/midpoint between two points — feeds `drawEdgeStrip`'s
 *  rotate+stretch layout. Plain `Math.hypot`/`Math.atan2`, not
 *  `Phaser.Math.*`, so this is safe to unit-test under vitest. */
export function edgeGeometry(fromX: number, fromY: number, toX: number, toY: number): EdgeGeometry {
  const dx = toX - fromX;
  const dy = toY - fromY;
  return {
    length: Math.hypot(dx, dy),
    angleRad: Math.atan2(dy, dx),
    midX: (fromX + toX) / 2,
    midY: (fromY + toY) / 2,
  };
}

// ---- Phaser draw helpers --------------------------------------------------

/**
 * Adds the socket ring `Image` on top of the caller's existing fill circle,
 * tinted/alpha'd for the given state, into `container`. Returns `null` (and
 * adds nothing) when the texture isn't loaded — caller keeps its own
 * `setStrokeStyle` fallback in that case (see `TreeScene.renderSpotBox`).
 */
export function drawSocketRing(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  x: number,
  y: number,
  displaySize: number,
  tint: number,
  alpha: number,
): Phaser.GameObjects.Image | null {
  if (!scene.textures.exists(SOCKET_TEXTURE_KEY)) return null;
  const ring = scene.add.image(x, y, SOCKET_TEXTURE_KEY).setDisplaySize(displaySize, displaySize).setTint(tint).setAlpha(alpha);
  container.add(ring);
  return ring;
}

/**
 * Adds a rotated, length-stretched edge-strip `Image` between two points into
 * `container`, tinted/alpha'd for the given state. Returns `null` (and adds
 * nothing) when the texture isn't loaded or the two points coincide — caller
 * keeps its own `Graphics.lineBetween` fallback in that case.
 */
export function drawEdgeStrip(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  displayThickness: number,
  tint: number,
  alpha: number,
): Phaser.GameObjects.Image | null {
  if (!scene.textures.exists(EDGE_STRIP_TEXTURE_KEY)) return null;
  const { length, angleRad, midX, midY } = edgeGeometry(fromX, fromY, toX, toY);
  if (length <= 0) return null;
  const strip = scene.add
    .image(midX, midY, EDGE_STRIP_TEXTURE_KEY)
    .setRotation(angleRad)
    .setDisplaySize(length, displayThickness)
    .setTint(tint)
    .setAlpha(alpha);
  container.add(strip);
  return strip;
}
