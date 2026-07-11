/**
 * Dev/debug combat log (Phase 3 handoff §C). Collapsed by default — a small
 * clickable header in the top-right corner; click toggles an expanded panel
 * of the last 20 log lines. Temp art only (rect + monospace text, dark
 * palette). The scene formats lines and calls `push()`; this widget stays
 * dumb (no event/formatting knowledge).
 */

import Phaser from 'phaser';

const MAX_LINES = 20;

const HEADER_X_FROM_RIGHT = 14; // header right edge sits at screenWidth - 14 (~946 at 960 wide)
const HEADER_Y = 14;
const HEADER_FONT = 'monospace';
const HEADER_FONT_SIZE = '13px';
const HEADER_COLOR = '#e8d8c8';

const PANEL_WIDTH = 280;
const PANEL_TOP_Y = 34;
const PANEL_PADDING = 8;
const LINE_FONT_SIZE = '11px';
const LINE_FONT = 'monospace';
const LINE_COLOR = '#d8c8b8';
const LINE_HEIGHT = 12;

const PANEL_BG_COLOR = 0x1a1210;
const PANEL_BG_ALPHA = 0.9;
const PANEL_BORDER_COLOR = 0x0a0605;

const COLLAPSED_LABEL = 'Log ▸';
const EXPANDED_LABEL = 'Log ▾';

/** Top-right dev combat log: collapsed header, click-to-expand panel. Per-combat (fresh each create()). */
export class CombatLog {
  private readonly headerText: Phaser.GameObjects.Text;
  private readonly panelBg: Phaser.GameObjects.Rectangle;
  private readonly linesText: Phaser.GameObjects.Text;

  private readonly panelX: number;
  private readonly panelHeight: number;

  private lines: string[] = [];
  private expanded = false;

  constructor(scene: Phaser.Scene, screenWidth = 960) {
    const headerX = screenWidth - HEADER_X_FROM_RIGHT;
    this.panelX = screenWidth - HEADER_X_FROM_RIGHT - PANEL_WIDTH;
    this.panelHeight = MAX_LINES * LINE_HEIGHT + PANEL_PADDING * 2;

    this.headerText = scene.add
      .text(headerX, HEADER_Y, COLLAPSED_LABEL, {
        fontFamily: HEADER_FONT,
        fontSize: HEADER_FONT_SIZE,
        color: HEADER_COLOR,
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    this.headerText.on('pointerdown', () => this.toggle());

    this.panelBg = scene.add
      .rectangle(
        this.panelX,
        PANEL_TOP_Y,
        PANEL_WIDTH,
        this.panelHeight,
        PANEL_BG_COLOR,
        PANEL_BG_ALPHA,
      )
      .setOrigin(0, 0)
      .setStrokeStyle(1, PANEL_BORDER_COLOR)
      .setVisible(false);

    this.linesText = scene.add
      .text(this.panelX + PANEL_PADDING, PANEL_TOP_Y + PANEL_PADDING, '', {
        fontFamily: LINE_FONT,
        fontSize: LINE_FONT_SIZE,
        color: LINE_COLOR,
        lineSpacing: LINE_HEIGHT - 11,
      })
      .setOrigin(0, 0)
      .setVisible(false);
  }

  /** Append one preformatted line; drops the oldest once past the 20-line cap. */
  push(line: string): void {
    this.lines.push(line);
    if (this.lines.length > MAX_LINES) this.lines.shift();
    this.linesText.setText(this.lines.join('\n'));
  }

  private toggle(): void {
    this.expanded = !this.expanded;
    this.headerText.setText(this.expanded ? EXPANDED_LABEL : COLLAPSED_LABEL);
    this.panelBg.setVisible(this.expanded);
    this.linesText.setVisible(this.expanded);
  }

  destroy(): void {
    this.headerText.destroy();
    this.panelBg.destroy();
    this.linesText.destroy();
  }
}
