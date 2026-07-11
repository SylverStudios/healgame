/**
 * Lightweight combat presentation helpers (shake, cast beam). Temp geometry only.
 */

import Phaser from 'phaser';

const SHAKE_DURATION_MS = 150;
const SHAKE_INTENSITY = 0.004;

const CAST_BEAM_COLOR = 0xf2c14e;
const CAST_BEAM_WIDTH = 2;
const CAST_BEAM_DURATION_MS = 280;

/** Modest camera shake on boss ability impact (handoff §K). */
export function shakeBossImpact(scene: Phaser.Scene): void {
  scene.cameras.main.shake(SHAKE_DURATION_MS, SHAKE_INTENSITY);
}

/** Brief ember line from caster to target on cast start (handoff §N). */
export function showCastBeam(
  scene: Phaser.Scene,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): Phaser.GameObjects.Line {
  const line = scene.add
    .line(0, 0, fromX, fromY, toX, toY, CAST_BEAM_COLOR)
    .setOrigin(0, 0)
    .setLineWidth(CAST_BEAM_WIDTH)
    .setDepth(45)
    .setAlpha(0.9);
  scene.tweens.add({
    targets: line,
    alpha: 0,
    duration: CAST_BEAM_DURATION_MS,
    onComplete: () => line.destroy(),
  });
  return line;
}

/** Optional ground ripple under a healed target (handoff §N). */
export function showHealRipple(scene: Phaser.Scene, x: number, groundY: number): void {
  const ripple = scene.add
    .ellipse(x, groundY + 4, 48, 10, 0xf2c14e, 0.35)
    .setStrokeStyle(1, 0x8a7868)
    .setDepth(5);
  scene.tweens.add({
    targets: ripple,
    scaleX: 1.6,
    scaleY: 1.4,
    alpha: 0,
    duration: 320,
    onComplete: () => ripple.destroy(),
  });
}
