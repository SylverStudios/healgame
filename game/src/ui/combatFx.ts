/**
 * Lightweight combat presentation helpers (shake, cast beam, heal juice, mana aura).
 * Temp geometry only — no particle packs / art assets.
 */

import Phaser from 'phaser';
import {
  MANA_AURA_WINDOW_MS,
  manaAuraIntensity,
  manaSpentInWindow,
  pruneManaSpends,
  type ManaSpendEntry,
} from './manaSpendTracker';

const BOSS_SHAKE_DURATION_MS = 150;
const BOSS_SHAKE_INTENSITY = 0.004;

/** Soft camera nudge when a heal lands — lighter than boss impact. */
const HEAL_SHAKE_DURATION_MS = 90;
const HEAL_SHAKE_INTENSITY = 0.0022;

const CAST_BEAM_COLOR = 0xf2c14e;
const CAST_BEAM_WIDTH = 2;
const CAST_BEAM_DURATION_MS = 280;

const HEAL_RIPPLE_COLOR = 0x5dff7a;
const HEAL_PARTICLE_COLOR = 0x7ad67a;
const HEAL_PARTICLE_COUNT = 6;
const HEAL_PARTICLE_DURATION_MS = 480;

const AURA_DEPTH = 8;
const AURA_CORE_COLOR = 0xf2e6a0;
const AURA_OUTER_COLOR = 0xf2c14e;
const AURA_SPARK_COLOR = 0xfff4c0;

/** Modest camera shake on boss ability impact (handoff §K). */
export function shakeBossImpact(scene: Phaser.Scene): void {
  scene.cameras.main.shake(BOSS_SHAKE_DURATION_MS, BOSS_SHAKE_INTENSITY);
}

/** Light camera nudge on heal land — basic-heal juice for playtest feel. */
export function shakeHealImpact(scene: Phaser.Scene): void {
  scene.cameras.main.shake(HEAL_SHAKE_DURATION_MS, HEAL_SHAKE_INTENSITY);
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

/** Ground ripple under a healed target — green to match heal floats. */
export function showHealRipple(scene: Phaser.Scene, x: number, groundY: number): void {
  const ripple = scene.add
    .ellipse(x, groundY + 4, 52, 12, HEAL_RIPPLE_COLOR, 0.4)
    .setStrokeStyle(1, 0x3a8a4a)
    .setDepth(5);
  scene.tweens.add({
    targets: ripple,
    scaleX: 1.7,
    scaleY: 1.5,
    alpha: 0,
    duration: 360,
    onComplete: () => ripple.destroy(),
  });
}

/**
 * Simplest particle burst: a handful of small green dots that drift up and out
 * from the heal target, then fade. Temp circles only — no emitter manager.
 */
export function showHealParticles(scene: Phaser.Scene, x: number, y: number): void {
  for (let i = 0; i < HEAL_PARTICLE_COUNT; i++) {
    const angle = -Math.PI / 2 + (i - (HEAL_PARTICLE_COUNT - 1) / 2) * 0.35;
    const dist = 28 + (i % 3) * 10;
    const size = 4 + (i % 2);
    const dot = scene.add
      .circle(x, y - 8, size, HEAL_PARTICLE_COLOR, 0.85)
      .setDepth(48);
    scene.tweens.add({
      targets: dot,
      x: x + Math.cos(angle) * dist,
      y: y - 8 + Math.sin(angle) * dist - 18,
      alpha: 0,
      scale: 0.3,
      duration: HEAL_PARTICLE_DURATION_MS + i * 30,
      ease: 'Quad.easeOut',
      onComplete: () => dot.destroy(),
    });
  }
}

/**
 * DBZ-style power aura around the healer. Intensity grows with mana spent in
 * the last 30s (presentation-only; does not touch the combat engine).
 */
export class ManaSpendAura {
  private readonly outer: Phaser.GameObjects.Ellipse;
  private readonly mid: Phaser.GameObjects.Ellipse;
  private readonly core: Phaser.GameObjects.Ellipse;
  private readonly sparks: Phaser.GameObjects.Arc[];
  private spends: ManaSpendEntry[] = [];
  private pulsePhase = 0;

  constructor(scene: Phaser.Scene) {
    this.outer = scene.add
      .ellipse(0, 0, 90, 110, AURA_OUTER_COLOR, 0)
      .setStrokeStyle(2, AURA_OUTER_COLOR, 0)
      .setDepth(AURA_DEPTH)
      .setVisible(false);
    this.mid = scene.add
      .ellipse(0, 0, 70, 88, AURA_CORE_COLOR, 0)
      .setStrokeStyle(1, AURA_SPARK_COLOR, 0)
      .setDepth(AURA_DEPTH + 1)
      .setVisible(false);
    this.core = scene.add
      .ellipse(0, 0, 48, 62, AURA_SPARK_COLOR, 0)
      .setDepth(AURA_DEPTH + 2)
      .setVisible(false);
    this.sparks = [0, 1, 2, 3].map((i) =>
      scene.add
        .circle(0, 0, 3, AURA_SPARK_COLOR, 0)
        .setDepth(AURA_DEPTH + 3)
        .setVisible(false)
        .setData('orbit', i),
    );
  }

  /** Record a mana spend at the current combat clock (ms since fight start). */
  recordSpend(amount: number, atMs: number): void {
    if (amount <= 0) return;
    this.spends.push({ atMs, amount });
    this.spends = pruneManaSpends(this.spends, atMs, MANA_AURA_WINDOW_MS);
  }

  /** Per-frame sync: place on healer and scale glow from recent mana spend. */
  update(nowMs: number, x: number, y: number, dtMs: number): void {
    this.spends = pruneManaSpends(this.spends, nowMs, MANA_AURA_WINDOW_MS);
    const intensity = manaAuraIntensity(manaSpentInWindow(this.spends, nowMs));
    this.pulsePhase += dtMs * 0.006;

    if (intensity <= 0.02) {
      this.setVisible(false);
      return;
    }

    this.setVisible(true);
    const pulse = 1 + Math.sin(this.pulsePhase) * 0.06 * intensity;
    const scale = (0.55 + intensity * 0.7) * pulse;

    this.outer.setPosition(x, y).setScale(scale).setAlpha(0.12 + intensity * 0.28);
    this.outer.setStrokeStyle(2, AURA_OUTER_COLOR, 0.25 + intensity * 0.55);

    this.mid.setPosition(x, y).setScale(scale * 0.92).setAlpha(0.08 + intensity * 0.22);
    this.mid.setStrokeStyle(1, AURA_SPARK_COLOR, 0.2 + intensity * 0.5);

    this.core.setPosition(x, y).setScale(scale * 0.85).setAlpha(0.05 + intensity * 0.18);

    const orbitR = 38 + intensity * 22;
    for (let i = 0; i < this.sparks.length; i++) {
      const spark = this.sparks[i]!;
      const angle = this.pulsePhase * (1.2 + i * 0.15) + (i * Math.PI) / 2;
      spark
        .setPosition(x + Math.cos(angle) * orbitR, y + Math.sin(angle) * orbitR * 1.15)
        .setAlpha(0.35 + intensity * 0.55)
        .setScale(0.7 + intensity * 0.8);
    }
  }

  destroy(): void {
    this.outer.destroy();
    this.mid.destroy();
    this.core.destroy();
    for (const spark of this.sparks) spark.destroy();
    this.spends = [];
  }

  private setVisible(visible: boolean): void {
    this.outer.setVisible(visible);
    this.mid.setVisible(visible);
    this.core.setVisible(visible);
    for (const spark of this.sparks) spark.setVisible(visible);
  }
}
