/**
 * A generic horizontal progress bar (HP/mana/cast/GCD) — two stacked
 * rectangles (background + fill), left-anchored so the fill shrinks/grows
 * from the left edge without re-centering. Temp-art only (poc-spec §4,
 * tech-options.md "Temp art plan"): flat colors, no textures.
 *
 * Chunk 3 (docs/ui-theme-handoff.md, bible item 3) adds an *optional* pixel-
 * art frame overlay (`frameTextureKey`) drawn centered on top of the bar —
 * additive only, every existing constructor call keeps compiling unchanged.
 * The frame texture must be authored at exactly half this Bar's `width`/
 * `height` (density rule: 1 art px = 2 screen px) with a transparent center
 * window so the fill rectangle shows through — see
 * `spellSprites.ts` CAST_BAR_FRAME_* and `CombatScene.buildCastBars()`.
 */

import Phaser from 'phaser';

const DEFAULT_BG_COLOR = 0x2a1e18;
const BORDER_COLOR = 0x0a0605;
const BORDER_WIDTH = 1;

export class Bar {
  private readonly width: number;
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly frame: Phaser.GameObjects.Image | null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor: number,
    bgColor: number = DEFAULT_BG_COLOR,
    frameTextureKey?: string,
  ) {
    this.width = width;
    this.bg = scene.add
      .rectangle(x, y, width, height, bgColor)
      .setOrigin(0, 0.5)
      .setStrokeStyle(BORDER_WIDTH, BORDER_COLOR);
    this.fill = scene.add.rectangle(x, y, width, height, fillColor).setOrigin(0, 0.5);
    this.frame =
      frameTextureKey && scene.textures.exists(frameTextureKey)
        ? scene.add
            .image(x + width / 2, y, frameTextureKey)
            .setOrigin(0.5, 0.5)
            .setDisplaySize(width, height)
        : null;
  }

  /** ratio in [0, 1]; clamped. Fill shrinks from the right edge (left-anchored origin). */
  setRatio(ratio: number): void {
    const clamped = Phaser.Math.Clamp(ratio, 0, 1);
    this.fill.width = this.width * clamped;
  }

  setPosition(x: number, y: number): void {
    this.bg.setPosition(x, y);
    this.fill.setPosition(x, y);
    this.frame?.setPosition(x + this.width / 2, y);
  }

  /** Re-parents both rectangles (+ frame, if any) into `container` (their x/y become local offsets). */
  addToContainer(container: Phaser.GameObjects.Container): void {
    container.add([this.bg, this.fill]);
    if (this.frame) container.add(this.frame);
  }

  setDepth(depth: number): this {
    this.bg.setDepth(depth);
    this.fill.setDepth(depth);
    this.frame?.setDepth(depth + 1);
    return this;
  }

  setVisible(visible: boolean): void {
    this.bg.setVisible(visible);
    this.fill.setVisible(visible);
    this.frame?.setVisible(visible);
  }

  destroy(): void {
    this.bg.destroy();
    this.fill.destroy();
    this.frame?.destroy();
  }
}
