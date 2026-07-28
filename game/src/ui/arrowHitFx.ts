/**
 * Presentation-only archer stuck-arrow hit VFX.
 *
 * Self-cleaning: owns its sprites/tweens/timers and destroys them.
 * Safe no-op if the texture is missing. Removable without combat/engine fallout.
 *
 * No on-screen travel — impact plays at the victim after the archer's bow
 * raises (`DPS2_ARROW_HIT_LEAD_MS`), suggesting the shot was too fast to see.
 */

import Phaser from 'phaser';
import {
  ARROW_HIT_BURST_DURATIONS_MS,
  ARROW_HIT_BURST_FRAME_COUNT,
  ARROW_HIT_BURST_FRAME_START,
  ARROW_HIT_EMBED_FRAME,
  ARROW_HIT_TEXTURE_KEY,
  DPS2_ARROW_HIT_LEAD_MS,
} from './sprites';

const DISPLAY_SIZE = 64;
const DEPTH = 49;
/** Nudge into the body from the party-facing (west) side so the stub reads embedded. */
const EMBED_X_OFFSET = -6;
const ANCHOR_Y_OFFSET = -10;
const EMBED_FADE_MS = 180;
const EMBED_HOLD_AFTER_BURST_MS = 40;

let missingTextureWarned = false;

/** Presentation-only. Safe no-op if textures missing. */
export function showArrowHit(
  scene: Phaser.Scene,
  args: {
    /** Victim anchor (unit home / body center). */
    targetX: number;
    targetY: number;
    /** Optional: fire when the stuck-arrow impact begins (after bow-raise lead). */
    onContact?: () => void;
  },
): void {
  const impactX = args.targetX + EMBED_X_OFFSET;
  const impactY = args.targetY + ANCHOR_Y_OFFSET;
  const onContact = args.onContact;

  const fire = () => {
    if (!scene.textures.exists(ARROW_HIT_TEXTURE_KEY)) {
      if (!missingTextureWarned) {
        missingTextureWarned = true;
        console.warn('[arrowHitFx] texture missing — skipping stuck-arrow VFX');
      }
      onContact?.();
      return;
    }
    onContact?.();
    playImpact(scene, impactX, impactY);
  };

  if (DPS2_ARROW_HIT_LEAD_MS <= 0) {
    fire();
    return;
  }
  scene.time.delayedCall(DPS2_ARROW_HIT_LEAD_MS, fire);
}

function playImpact(scene: Phaser.Scene, x: number, y: number): void {
  const embed = scene.add
    .image(x, y, ARROW_HIT_TEXTURE_KEY, ARROW_HIT_EMBED_FRAME)
    .setDisplaySize(DISPLAY_SIZE, DISPLAY_SIZE)
    .setDepth(DEPTH);

  const burst = scene.add
    .image(x, y, ARROW_HIT_TEXTURE_KEY, ARROW_HIT_BURST_FRAME_START)
    .setDisplaySize(DISPLAY_SIZE, DISPLAY_SIZE)
    .setDepth(DEPTH + 1);

  let frame = 0;
  const stepBurst = () => {
    frame++;
    if (frame >= ARROW_HIT_BURST_FRAME_COUNT) {
      burst.destroy();
      scene.time.delayedCall(EMBED_HOLD_AFTER_BURST_MS, () => {
        scene.tweens.add({
          targets: embed,
          alpha: 0,
          duration: EMBED_FADE_MS,
          onComplete: () => embed.destroy(),
        });
      });
      return;
    }
    burst.setFrame(ARROW_HIT_BURST_FRAME_START + frame);
    const nextDelay =
      ARROW_HIT_BURST_DURATIONS_MS[frame] ??
      ARROW_HIT_BURST_DURATIONS_MS[ARROW_HIT_BURST_DURATIONS_MS.length - 1]!;
    scene.time.delayedCall(nextDelay, stepBurst);
  };

  scene.time.delayedCall(ARROW_HIT_BURST_DURATIONS_MS[0]!, stepBurst);
}
