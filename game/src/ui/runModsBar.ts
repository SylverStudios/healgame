/**
 * Slay-the-Spire-style top bar: sworn oath + relic icons with hover tooltips.
 * Temp art only — colored circle (relic) or diamond (oath) glyphs, monospace
 * tooltip panel. Shared by Hub / Combat / Tree so the player can read effects
 * at any time.
 */

import Phaser from 'phaser';
import type { RunModDisplay, RunModKind } from '../data/runMods';
import { relicGlyphColorById } from './relicColors';

const ICON_RADIUS = 12;
const ICON_GAP = 8;
const ICON_BORDER = 0x0a0605;
const MARGIN_LEFT = 30;
const MARGIN_TOP = 30;

const TOOLTIP_BG = 0x241a15;
const TOOLTIP_BORDER = 0x0a0605;
const TOOLTIP_PADDING = 8;
const TOOLTIP_NAME_COLOR = '#f2c14e';
const TOOLTIP_DESC_COLOR = '#e8d8c8';
const TOOLTIP_KIND_COLOR = '#a89888';
const TOOLTIP_MAX_WIDTH = 220;
const TOOLTIP_DEPTH = 300;
const FONT = 'monospace';

/** Oath diamonds keep distinct subclass hues; relics use role scales. */
const OATH_GLYPH_COLOR: Record<string, number> = {
  'vigil-oath': 0x6a9cc8, // calm blue
  'zealot-oath': 0xe05a4e, // zeal red
};

export interface RunModsBarOptions {
  /** Override default top-left padding. */
  marginLeft?: number;
  marginTop?: number;
  /** Tree HUD needs scrollFactor 0. */
  scrollFactor?: number;
  depth?: number;
}

/**
 * Draws a temp-art glyph for a run mod. Exported so RelicScene cards can match
 * the top-bar icons.
 */
export function drawRunModGlyph(
  scene: Phaser.Scene,
  x: number,
  y: number,
  modId: string,
  kind: RunModKind,
  radius = ICON_RADIUS,
): Phaser.GameObjects.Shape {
  if (kind === 'oath') {
    const color = OATH_GLYPH_COLOR[modId] ?? 0xa89888;
    // Diamond (rotated square) — reads distinct from relic circles.
    return scene.add
      .rectangle(x, y, radius * 1.6, radius * 1.6, color)
      .setAngle(45)
      .setStrokeStyle(2, ICON_BORDER);
  }
  const color = relicGlyphColorById(modId);
  return scene.add.circle(x, y, radius, color).setStrokeStyle(2, ICON_BORDER);
}

/** Semantic journey name for a run-mod icon hit target. */
export function runModTargetName(modId: string): string {
  return `runMod:${modId}`;
}

/**
 * Top-left horizontal strip of hoverable run-mod icons. No-op when `mods` is
 * empty (nothing drawn). Callers own lifecycle — destroy when leaving the scene.
 */
export class RunModsBar {
  private readonly root: Phaser.GameObjects.Container;
  private readonly tooltip: Phaser.GameObjects.Container;
  private readonly tooltipBg: Phaser.GameObjects.Rectangle;
  private readonly kindText: Phaser.GameObjects.Text;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly descText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, mods: readonly RunModDisplay[], options: RunModsBarOptions = {}) {
    const marginLeft = options.marginLeft ?? MARGIN_LEFT;
    const marginTop = options.marginTop ?? MARGIN_TOP;
    const scrollFactor = options.scrollFactor ?? 1;
    const depth = options.depth ?? 200;

    this.root = scene.add.container(0, 0).setDepth(depth).setScrollFactor(scrollFactor);

    this.tooltipBg = scene.add
      .rectangle(0, 0, 10, 10, TOOLTIP_BG)
      .setOrigin(0, 0)
      .setStrokeStyle(1, TOOLTIP_BORDER);
    this.kindText = scene.add.text(0, 0, '', {
      fontFamily: FONT,
      fontSize: '11px',
      color: TOOLTIP_KIND_COLOR,
    });
    this.nameText = scene.add.text(0, 0, '', {
      fontFamily: FONT,
      fontSize: '14px',
      color: TOOLTIP_NAME_COLOR,
    });
    this.descText = scene.add.text(0, 0, '', {
      fontFamily: FONT,
      fontSize: '12px',
      color: TOOLTIP_DESC_COLOR,
      wordWrap: { width: TOOLTIP_MAX_WIDTH },
    });
    this.tooltip = scene.add
      .container(0, 0, [this.tooltipBg, this.kindText, this.nameText, this.descText])
      .setDepth(TOOLTIP_DEPTH)
      .setScrollFactor(scrollFactor)
      .setVisible(false);

    if (mods.length === 0) return;

    const step = ICON_RADIUS * 2 + ICON_GAP;
    const startX = marginLeft + ICON_RADIUS;
    const y = marginTop;

    mods.forEach((mod, i) => {
      // Oath first, then relics — strip grows rightward from the left edge.
      const x = startX + i * step;
      const glyph = drawRunModGlyph(scene, x, y, mod.id, mod.kind);
      // Invisible hit circle — diamonds' rotated bounds are awkward for hover.
      const hit = scene.add
        .circle(x, y, ICON_RADIUS + 2, 0x000000, 0)
        .setInteractive({ useHandCursor: true })
        .setName(runModTargetName(mod.id));

      hit.on('pointerover', () => this.showTooltip(x, y, mod));
      hit.on('pointerout', () => this.hideTooltip());

      this.root.add([glyph, hit]);
    });
  }

  private showTooltip(iconX: number, iconY: number, mod: RunModDisplay): void {
    this.kindText.setText(mod.kind === 'oath' ? 'Oath' : 'Relic');
    this.nameText.setText(mod.name);
    this.descText.setText(mod.description);

    this.kindText.setPosition(TOOLTIP_PADDING, TOOLTIP_PADDING);
    this.nameText.setPosition(TOOLTIP_PADDING, TOOLTIP_PADDING + this.kindText.height + 2);
    this.descText.setPosition(
      TOOLTIP_PADDING,
      TOOLTIP_PADDING + this.kindText.height + this.nameText.height + 6,
    );

    const panelWidth =
      Math.max(this.kindText.width, this.nameText.width, this.descText.width) + TOOLTIP_PADDING * 2;
    const panelHeight =
      this.kindText.height + this.nameText.height + this.descText.height + TOOLTIP_PADDING * 2 + 8;
    this.tooltipBg.setSize(panelWidth, panelHeight);
    this.tooltip.setPosition(iconX + ICON_RADIUS + 6, iconY + ICON_RADIUS + 6);
    this.tooltip.setVisible(true);
  }

  private hideTooltip(): void {
    this.tooltip.setVisible(false);
  }

  destroy(): void {
    this.root.destroy(true);
    this.tooltip.destroy(true);
  }
}
