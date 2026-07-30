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
 *
 * When a frame is present, pass `fillInset` (e.g. CAST_BAR_FRAME_FILL_INSET)
 * so bg/fill sit strictly inside the transparent window; end caps then mask
 * the fill. Unframed bars omit inset and keep full outer geometry.
 */

import Phaser from 'phaser';

const DEFAULT_BG_COLOR = 0x2a1e18;
const BORDER_COLOR = 0x0a0605;
const BORDER_WIDTH = 1;

/** Per-edge inset (display px) from the outer Bar box into the fill/bg. */
export interface BarFillInset {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

const ZERO_INSET: BarFillInset = { left: 0, right: 0, top: 0, bottom: 0 };

/**
 * Pure fill/bg geometry inside an outer Bar box. `offsetX`/`offsetY` are
 * added to the outer left-edge / vertical-center origin used by `Bar`.
 * Integers only — callers must pass integer outer size and inset.
 */
export function framedFillSize(
  outerWidth: number,
  outerHeight: number,
  inset: BarFillInset = ZERO_INSET,
): { width: number; height: number; offsetX: number; offsetY: number } {
  return {
    width: outerWidth - inset.left - inset.right,
    height: outerHeight - inset.top - inset.bottom,
    offsetX: inset.left,
    // Vertical origin is 0.5; shift so unequal top/bottom still centers the
    // fill in the transparent window.
    offsetY: (inset.top - inset.bottom) / 2,
  };
}

export class Bar {
  /** Outer width (frame / layout size); fill may be narrower when inset. */
  private readonly outerWidth: number;
  private readonly fillWidth: number;
  private readonly offsetX: number;
  private readonly offsetY: number;
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
    fillInset: BarFillInset = ZERO_INSET,
  ) {
    const geom = framedFillSize(width, height, fillInset);
    this.outerWidth = width;
    this.fillWidth = geom.width;
    this.offsetX = geom.offsetX;
    this.offsetY = geom.offsetY;

    const fillX = x + geom.offsetX;
    const fillY = y + geom.offsetY;

    this.bg = scene.add
      .rectangle(fillX, fillY, geom.width, geom.height, bgColor)
      .setOrigin(0, 0.5);
    // Framed bars: chrome supplies the border; a stroked rect would peek past
    // the transparent window into the opaque end caps.
    if (!frameTextureKey) {
      this.bg.setStrokeStyle(BORDER_WIDTH, BORDER_COLOR);
    }
    this.fill = scene.add
      .rectangle(fillX, fillY, geom.width, geom.height, fillColor)
      .setOrigin(0, 0.5);
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
    this.fill.width = this.fillWidth * clamped;
  }

  setPosition(x: number, y: number): void {
    this.bg.setPosition(x + this.offsetX, y + this.offsetY);
    this.fill.setPosition(x + this.offsetX, y + this.offsetY);
    this.frame?.setPosition(x + this.outerWidth / 2, y);
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
