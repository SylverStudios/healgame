/**
 * WoW-style radial/pie GCD wipe for one ability-button face.
 * Dark overlay sector shrinks clockwise from 12 o'clock as GCD elapses;
 * icons / mana orbs underneath stay visible through the translucent fill.
 */

import Phaser from 'phaser';

const WIPE_COLOR = 0x0a0605;
const WIPE_ALPHA = 0.62;

/** Remaining GCD as 0..1 (1 = just started / full dark, 0 = clear). */
export function gcdWipeProgress(remainingMs: number, gcdMs: number): number {
  if (gcdMs <= 0 || remainingMs <= 0) return 0;
  return Math.min(1, remainingMs / gcdMs);
}

/**
 * Presentation-only overlay: Graphics pie clipped to the button rect via a
 * GeometryMask so Wave 2 icons + mana orbs reappear cleanly as it clears.
 */
export class GcdWipeOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly maskGraphics: Phaser.GameObjects.Graphics;
  private readonly cx: number;
  private readonly cy: number;
  private readonly radius: number;
  private lastProgress = -1;

  constructor(scene: Phaser.Scene, cx: number, cy: number, width: number, height: number) {
    this.cx = cx;
    this.cy = cy;
    // Cover button corners so the sector fully darkens the face at progress=1.
    this.radius = Math.ceil(Math.hypot(width / 2, height / 2)) + 1;

    this.maskGraphics = scene.make.graphics({ x: 0, y: 0 });
    this.maskGraphics.fillStyle(0xffffff, 1);
    this.maskGraphics.fillRect(cx - width / 2, cy - height / 2, width, height);

    this.graphics = scene.add.graphics();
    this.graphics.setMask(this.maskGraphics.createGeometryMask());
    this.graphics.setVisible(false);
  }

  /** Drive from engine `gcdRemainingMs` / `GCD_MS`. No-op redraw when unchanged. */
  setGcd(remainingMs: number, gcdMs: number): void {
    const progress = gcdWipeProgress(remainingMs, gcdMs);
    if (progress === this.lastProgress) return;
    this.lastProgress = progress;

    if (progress <= 0) {
      this.graphics.clear();
      this.graphics.setVisible(false);
      return;
    }

    this.graphics.clear();
    this.graphics.fillStyle(WIPE_COLOR, WIPE_ALPHA);
    this.graphics.beginPath();
    this.graphics.moveTo(this.cx, this.cy);
    // Clockwise remaining wedge from 12 o'clock (WoW action-bar feel).
    this.graphics.arc(
      this.cx,
      this.cy,
      this.radius,
      -Math.PI / 2,
      -Math.PI / 2 + progress * Math.PI * 2,
      false,
    );
    this.graphics.closePath();
    this.graphics.fillPath();
    this.graphics.setVisible(true);
  }

  /** Keep keycap / hotkey readable above the dark pie. */
  setDepth(depth: number): void {
    this.graphics.setDepth(depth);
  }

  destroy(): void {
    this.graphics.clearMask(true);
    this.graphics.destroy();
    this.maskGraphics.destroy();
  }
}
