/**
 * Party banter speech bubble (v0.3 chunk G — locked presentation in
 * docs/v0.3-handoff.md "Banter"). Temp art only: small dark rounded rect +
 * monospace text + a tail, anchored above a unit sprite's home position,
 * clamped to the screen. Fades in, holds, fades out, then self-destroys —
 * callers fire-and-forget.
 */

import Phaser from 'phaser';

/** Above units (max ~50, see ui/unitSprite.ts FLOAT_DEPTH) but below the run-summary
 *  overlay (CombatScene OVERLAY_DEPTH = 1000) so the panel remains readable on top. */
const BUBBLE_DEPTH = 300;

const BUBBLE_FONT = 'monospace';
const BUBBLE_FONT_SIZE = '12px';
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
}

/**
 * Shows one speech bubble above `(x, y)` and lets it fade itself out. Fire-and-forget: the
 * returned container is destroyed automatically at the end of its fade-out tween.
 */
export function showSpeechBubble(scene: Phaser.Scene, options: SpeechBubbleOptions): Phaser.GameObjects.Container {
  const { x, y, text, viewWidth, viewHeight } = options;

  const label = scene.add
    .text(0, 0, text, { fontFamily: BUBBLE_FONT, fontSize: BUBBLE_FONT_SIZE, color: BUBBLE_TEXT_COLOR })
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

  const halfW = boxWidth / 2;
  const totalHeight = boxHeight + TAIL_HEIGHT;
  const clampedX = Phaser.Math.Clamp(x, halfW + SCREEN_MARGIN, viewWidth - halfW - SCREEN_MARGIN);
  const anchorY = y - GAP_ABOVE_ANCHOR;
  const clampedY = Phaser.Math.Clamp(anchorY, totalHeight + SCREEN_MARGIN, viewHeight - SCREEN_MARGIN);

  const container = scene.add
    .container(clampedX, clampedY, [bg, label])
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
