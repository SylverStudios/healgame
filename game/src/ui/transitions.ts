/**
 * Scene-transition helpers (bible item 6, chunk 6 of
 * docs/ui-theme-handoff.md): a short camera fade wrapped around every
 * `scene.start()` seam, plus a chunkier blocky "into battle" reveal owned by
 * CombatScene itself (it fires whether the fight was entered from the Hub
 * dungeon list or the Tutorial's first fight — both deserve the same beat;
 * see docs/ui-theme-research.md §4 item 6).
 *
 * Presentation only: every scene still builds its full content synchronously
 * inside `create()` exactly as before — these helpers only ever touch camera
 * alpha or a temporary overlay of Rectangle GameObjects removed on a timer.
 * Nothing here defers object creation or renames anything, so
 * `window.__healgame.locate(name)` keeps resolving every journey-named
 * object at its normal position the instant `create()` returns (locked
 * decision: "Journey resolves by setName only").
 *
 * Total transition time stays under the 400ms budget end to end: a plain
 * fade is ~180ms out + ~180ms in (360ms); the combat-entry seam uses a
 * shorter ~150ms fade-out feeding a ~250ms chunky reveal (400ms). journey's
 * poll loop has ~700ms+ slack per tick, so this is comfortably inside safe
 * margin even before accounting for the locked 400ms spec.
 *
 * No Phaser NineSlice / postFX pipelines here (chunks 3/4 already found
 * NineSlice WebGL-only and this project runs `Phaser.AUTO`, which can fall
 * back to Canvas in headless/CI — postFX pixelate has the same WebGL-only
 * limitation). The chunky look is a plain grid of Rectangle GameObjects
 * popped away on a stagger, which renders identically under either
 * renderer.
 */

import type Phaser from 'phaser';
import { PALETTE_NUM } from './theme';

/** Plain fade-out before `scene.start()`; pairs with {@link fadeInOnCreate}
 *  at the top of the target scene's `create()`. Used at every seam except
 *  entering combat (see {@link COMBAT_ENTRY_FADE_OUT_MS} / {@link chunkyWipeIn}). */
export const FADE_OUT_MS = 180;
export const FADE_IN_MS = 180;

/** Shorter fade-out feeding into {@link chunkyWipeIn} — leaves the chunky
 *  reveal the rest of the 400ms budget for its blocky look. */
export const COMBAT_ENTRY_FADE_OUT_MS = 150;
/** Duration of the blocky mosaic reveal CombatScene plays at the end of its
 *  own `create()`. */
export const COMBAT_WIPE_IN_MS = 250;

// Camera fadeOut/fadeIn take separate 0-255 r/g/b channels, not a packed
// hex — reuse the shared bg tone (ui/theme.ts) so the fade reads as "the
// same darkness" the dark-palette scenes already sit on.
const BG_HEX = PALETTE_NUM.bg;
const FADE_R = (BG_HEX >> 16) & 0xff;
const FADE_G = (BG_HEX >> 8) & 0xff;
const FADE_B = BG_HEX & 0xff;

/**
 * Fade the current scene to the shared bg tone, then start `key`. Drop-in
 * replacement for a bare `this.scene.start(key, data)` at every meta-scene
 * seam. Pass `durationMs` only for the shorter combat-entry fade
 * ({@link COMBAT_ENTRY_FADE_OUT_MS}) — every other seam uses the default.
 * `key` is untyped `string` (matching Phaser's own `ScenePlugin.start`
 * signature) rather than `scenes/keys.ts`'s `SceneKey` so this stays a
 * drop-in for `CombatSceneData.returnTo` (also plain `string` — an existing
 * pinned contract this chunk doesn't touch).
 */
export function fadeToScene(
  scene: Phaser.Scene,
  key: string,
  data?: object,
  durationMs: number = FADE_OUT_MS,
): void {
  const camera = scene.cameras.main;
  camera.once('camerafadeoutcomplete', () => {
    scene.scene.start(key, data);
  });
  camera.fadeOut(durationMs, FADE_R, FADE_G, FADE_B);
}

/**
 * Fade the current scene's camera in from the shared bg tone. Call once,
 * anywhere in a scene's `create()` (it's a full-camera overlay, so ordering
 * relative to the rest of `create()`'s content-building calls doesn't
 * matter) — every meta scene except CombatScene (which uses
 * {@link chunkyWipeIn} instead) pairs this with {@link fadeToScene} on the
 * way out.
 */
export function fadeInOnCreate(scene: Phaser.Scene, durationMs: number = FADE_IN_MS): void {
  scene.cameras.main.fadeIn(durationMs, FADE_R, FADE_G, FADE_B);
}

/** Grid density for {@link chunkyWipeIn} — 16×9 divides the fixed 960×540
 *  combat canvas into exact 60×60 squares (no fractional-pixel seams). */
const WIPE_COLS = 16;
const WIPE_ROWS = 9;
/** Comfortably above every combat depth in use (result overlay tops out at
 *  OVERLAY_DEPTH + 3 = 1003 in CombatScene.ts) — the wipe must sit above
 *  everything it's covering. */
const WIPE_DEPTH = 5000;

/**
 * Diagonal stagger, pure and deterministic: cell (col, row) of a
 * `cols`×`rows` grid pops at `delayMs` after the wipe starts, linear in
 * distance from the top-left corner, so the reveal reads as a diagonal
 * sweep. No per-cell fade — each block disappears in one frame at its
 * delay, matching the "no anti-aliasing, no soft gradients" style-bible
 * spirit (a smooth alpha tween across the grid would just be a fade with
 * extra steps). Exported for the colocated test; also usable standalone if
 * a future chunk wants the same stagger shape elsewhere.
 */
export function wipeCellDelayMs(
  col: number,
  row: number,
  cols: number,
  rows: number,
  durationMs: number,
): number {
  const maxIndex = cols - 1 + (rows - 1);
  if (maxIndex <= 0) return 0;
  const progress = (col + row) / maxIndex;
  return Math.round(progress * durationMs);
}

/**
 * Chunky "into battle" reveal. CombatScene calls this as the very last step
 * of `create()`, after every other object (battlefield, HUD, spell bar,
 * party/enemy sprites) is already built — it lays an opaque grid over the
 * finished frame and pops the blocks away in a diagonal stagger, so nothing
 * about object creation order or timing changes; this only ever covers and
 * uncovers what's already there.
 */
export function chunkyWipeIn(
  scene: Phaser.Scene,
  viewWidth: number,
  viewHeight: number,
  durationMs: number = COMBAT_WIPE_IN_MS,
): void {
  const cellW = viewWidth / WIPE_COLS;
  const cellH = viewHeight / WIPE_ROWS;
  for (let row = 0; row < WIPE_ROWS; row++) {
    for (let col = 0; col < WIPE_COLS; col++) {
      // +1px overlap so adjacent blocks don't leave hairline seams.
      const rect = scene.add
        .rectangle(col * cellW + cellW / 2, row * cellH + cellH / 2, cellW + 1, cellH + 1, BG_HEX)
        .setDepth(WIPE_DEPTH);
      const delay = wipeCellDelayMs(col, row, WIPE_COLS, WIPE_ROWS, durationMs);
      scene.time.delayedCall(delay, () => rect.destroy());
    }
  }
}
