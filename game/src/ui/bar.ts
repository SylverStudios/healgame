/**
 * A generic horizontal progress bar (HP/mana/cast/GCD) — two stacked
 * rectangles (background + fill), left-anchored so the fill shrinks/grows
 * from the left edge without re-centering. Temp-art only (poc-spec §4,
 * tech-options.md "Temp art plan"): flat colors, no textures.
 */

import Phaser from 'phaser';

const DEFAULT_BG_COLOR = 0x2a1e18;
const BORDER_COLOR = 0x0a0605;
const BORDER_WIDTH = 1;

export class Bar {
  private readonly width: number;
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly fill: Phaser.GameObjects.Rectangle;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor: number,
    bgColor: number = DEFAULT_BG_COLOR,
  ) {
    this.width = width;
    this.bg = scene.add
      .rectangle(x, y, width, height, bgColor)
      .setOrigin(0, 0.5)
      .setStrokeStyle(BORDER_WIDTH, BORDER_COLOR);
    this.fill = scene.add.rectangle(x, y, width, height, fillColor).setOrigin(0, 0.5);
  }

  /** ratio in [0, 1]; clamped. Fill shrinks from the right edge (left-anchored origin). */
  setRatio(ratio: number): void {
    const clamped = Phaser.Math.Clamp(ratio, 0, 1);
    this.fill.width = this.width * clamped;
  }

  setPosition(x: number, y: number): void {
    this.bg.setPosition(x, y);
    this.fill.setPosition(x, y);
  }

  /** Re-parents both rectangles into `container` (their x/y become local offsets). */
  addToContainer(container: Phaser.GameObjects.Container): void {
    container.add([this.bg, this.fill]);
  }

  setDepth(depth: number): this {
    this.bg.setDepth(depth);
    this.fill.setDepth(depth);
    return this;
  }

  setVisible(visible: boolean): void {
    this.bg.setVisible(visible);
    this.fill.setVisible(visible);
  }

  destroy(): void {
    this.bg.destroy();
    this.fill.destroy();
  }
}
