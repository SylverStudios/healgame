/**
 * Party banter speech bubble (v0.3 chunk G — locked presentation in
 * docs/v0.3-handoff.md "Banter"). Temp art only: small dark rounded rect +
 * pixel-font text + a tail, anchored above a unit sprite's home position,
 * clamped to the screen. Fades in, holds, fades out, then self-destroys —
 * callers fire-and-forget.
 */

import Phaser from 'phaser';
import { FONT, FONT_SIZE_SM } from './theme';

/** Above units (max ~50, see ui/unitSprite.ts FLOAT_DEPTH) but below the run-summary
 *  overlay (CombatScene OVERLAY_DEPTH = 1000) so the panel remains readable on top. */
const BUBBLE_DEPTH = 300;

const BUBBLE_FONT_SIZE = FONT_SIZE_SM;
const BUBBLE_TEXT_COLOR = '#e8d8c8';
const BUBBLE_BG_COLOR = 0x1a1210;
const BUBBLE_BG_ALPHA = 0.94;
const BUBBLE_BORDER_COLOR = 0x8a7868;
const BUBBLE_RADIUS = 6;
const BUBBLE_PADDING_X = 10;
const BUBBLE_PADDING_Y = 7;

const TAIL_WIDTH = 10;
const TAIL_HEIGHT = 7;

/** Gap between the tail's tip and the anchor point passed by the caller (typically a few
 *  pixels above the unit's topmost HUD element — HP bar / mana bar / target chevron). */
const GAP_ABOVE_ANCHOR = 16;

/** Keeps the whole bubble (box + tail) on screen even for edge-slot speakers. */
const SCREEN_MARGIN = 6;

// ---- optional speaker portrait (chunk 5, bible item 5) ---------------------
// Bust sits to the box's left, FE-dialogue style — much bigger than the box
// itself (density rule: 48 art px native, always displayed at exactly 2×,
// never resized to "fit" the bubble). Additive: omitting `portraitTextureKey`
// (or passing one with no loaded texture) reproduces the original text-only
// bubble exactly, byte-for-byte layout.
const PORTRAIT_NATIVE_SIZE = 48;
const PORTRAIT_DISPLAY_SIZE = PORTRAIT_NATIVE_SIZE * 2;
const PORTRAIT_GAP = 6;
const PORTRAIT_BG_PAD = 3;

const FADE_IN_MS = 220;
const HOLD_MS = 2500;
const FADE_OUT_MS = 320;

export interface SpeechBubbleOptions {
  /** Speaker's world X (typically `UnitSprite.getHomeX()`). */
  x: number;
  /** World Y the tail should point at — typically the speaker's home Y minus enough
   *  offset to clear its HP/mana bars (the caller knows its own unit-sprite layout). */
  y: number;
  text: string;
  /** Scene view bounds, used to clamp the bubble fully on screen. */
  viewWidth: number;
  viewHeight: number;
  /** Optional speaker bust (ui/portraitSprites.ts `portraitTextureKey(speaker)`). Drawn to
   *  the box's left when the texture is loaded; silently omitted (identical layout to no
   *  portrait at all) when it isn't — see `scene.textures.exists()` check in the impl. */
  portraitTextureKey?: string;
}

// ---- pure layout helpers (colocated speechBubble.test.ts covers these) ----

/** Local-space half-extents (from the container's tail-tip origin) the bubble occupies to
 *  the left and right of center, given the text box's width. The portrait sits on the left
 *  only, so it widens `left` and leaves `right` (the box's own half-width) untouched. */
export function bubbleHorizontalExtents(boxWidth: number, hasPortrait: boolean): { left: number; right: number } {
  const right = boxWidth / 2;
  const left = hasPortrait ? boxWidth / 2 + PORTRAIT_GAP + PORTRAIT_DISPLAY_SIZE : boxWidth / 2;
  return { left, right };
}

/** Local-space height (from the tail tip at y=0 up to the assembly's topmost pixel) used to
 *  clamp the whole bubble on screen. The portrait is anchored to the box's bottom edge (see
 *  `showSpeechBubble`), so when it's taller than the box it's what determines this height. */
export function bubbleTotalHeight(boxHeight: number, hasPortrait: boolean): number {
  const boxTotal = boxHeight + TAIL_HEIGHT;
  return hasPortrait ? Math.max(boxTotal, PORTRAIT_DISPLAY_SIZE + TAIL_HEIGHT) : boxTotal;
}

/** Plain clamp (not `Phaser.Math.Clamp`) so this module's only `Phaser` usages stay in type
 *  positions — keeps it elidable at transform time like `ui/battlefield.ts`, which matters
 *  because `speechBubble.test.ts` imports pure helpers from this same file: a real runtime
 *  `Phaser` import here would load Phaser's browser device-detection under vitest's default
 *  (non-browser) test environment and crash with "navigator is not defined". */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Shows one speech bubble above `(x, y)` and lets it fade itself out. Fire-and-forget: the
 * returned container is destroyed automatically at the end of its fade-out tween.
 */
export function showSpeechBubble(scene: Phaser.Scene, options: SpeechBubbleOptions): Phaser.GameObjects.Container {
  const { x, y, text, viewWidth, viewHeight, portraitTextureKey } = options;

  const label = scene.add
    .text(0, 0, text, { fontFamily: FONT, fontSize: BUBBLE_FONT_SIZE, color: BUBBLE_TEXT_COLOR })
    .setOrigin(0.5);

  const boxWidth = label.width + BUBBLE_PADDING_X * 2;
  const boxHeight = label.height + BUBBLE_PADDING_Y * 2;

  // Local coordinates: container origin (0, 0) is the tail's tip, pointing down at the
  // anchor; the box sits entirely above it (from -boxHeight to 0).
  const bg = scene.add.graphics();
  bg.fillStyle(BUBBLE_BG_COLOR, BUBBLE_BG_ALPHA);
  bg.fillRoundedRect(-boxWidth / 2, -boxHeight - TAIL_HEIGHT, boxWidth, boxHeight, BUBBLE_RADIUS);
  bg.fillTriangle(-TAIL_WIDTH / 2, -TAIL_HEIGHT, TAIL_WIDTH / 2, -TAIL_HEIGHT, 0, 0);
  bg.lineStyle(1, BUBBLE_BORDER_COLOR, 1);
  bg.strokeRoundedRect(-boxWidth / 2, -boxHeight - TAIL_HEIGHT, boxWidth, boxHeight, BUBBLE_RADIUS);

  label.setPosition(0, -boxHeight / 2 - TAIL_HEIGHT);

  // Optional speaker bust (chunk 5): sits to the box's left, bottom-anchored to the box's
  // bottom edge so it reads as "grounded" next to the tail rather than floating. Silently
  // skipped when the caller passed no key, or the texture never loaded — the fallback is
  // exactly the pre-chunk-5 text-only layout, never a broken image.
  const hasPortrait = Boolean(portraitTextureKey && scene.textures.exists(portraitTextureKey));
  const extraPieces: Phaser.GameObjects.GameObject[] = [];
  if (hasPortrait) {
    const boxBottomY = -TAIL_HEIGHT;
    const portraitCenterX = -boxWidth / 2 - PORTRAIT_GAP - PORTRAIT_DISPLAY_SIZE / 2;
    const portraitCenterY = boxBottomY - PORTRAIT_DISPLAY_SIZE / 2;
    const portraitBg = scene.add
      .rectangle(
        portraitCenterX,
        portraitCenterY,
        PORTRAIT_DISPLAY_SIZE + PORTRAIT_BG_PAD * 2,
        PORTRAIT_DISPLAY_SIZE + PORTRAIT_BG_PAD * 2,
        BUBBLE_BG_COLOR,
        BUBBLE_BG_ALPHA,
      )
      .setStrokeStyle(1, BUBBLE_BORDER_COLOR);
    const portrait = scene.add
      .image(portraitCenterX, portraitCenterY, portraitTextureKey!)
      .setDisplaySize(PORTRAIT_DISPLAY_SIZE, PORTRAIT_DISPLAY_SIZE);
    extraPieces.push(portraitBg, portrait);
  }

  const { left, right } = bubbleHorizontalExtents(boxWidth, hasPortrait);
  const totalHeight = bubbleTotalHeight(boxHeight, hasPortrait);
  const clampedX = clamp(x, left + SCREEN_MARGIN, viewWidth - right - SCREEN_MARGIN);
  const anchorY = y - GAP_ABOVE_ANCHOR;
  const clampedY = clamp(anchorY, totalHeight + SCREEN_MARGIN, viewHeight - SCREEN_MARGIN);

  const container = scene.add
    .container(clampedX, clampedY, [bg, label, ...extraPieces])
    .setDepth(BUBBLE_DEPTH)
    .setAlpha(0);

  scene.tweens.add({
    targets: container,
    alpha: 1,
    duration: FADE_IN_MS,
    onComplete: () => {
      scene.tweens.add({
        targets: container,
        alpha: 0,
        delay: HOLD_MS,
        duration: FADE_OUT_MS,
        onComplete: () => container.destroy(),
      });
    },
  });

  return container;
}
