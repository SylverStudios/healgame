/**
 * Spell / cooldown tooltip panel.
 * Spells use the slot-card layout (name → effect band → cost/cast/cd →
 * description → notes). Cooldowns still use a simple colored line stack.
 * One shared instance per SpellBar / TreeScene — showing new content replaces
 * the panel in place.
 */

import Phaser from 'phaser';
import type { SpellCardModel } from './spellCard';

const PADDING = 8;
const LINE_GAP = 3;
const SECTION_GAP = 6;
const BG_COLOR = 0x241a15;
const BORDER_COLOR = 0x0a0605;
const EFFECT_BAND_COLOR = 0x2e241e;
const DIVIDER_COLOR = 0x3a2a22;
const FONT = 'monospace';
const FONT_SIZE = '12px';
const LABEL_SIZE = '10px';
const DEPTH = 300;
/** Keeps the three-column strip readable and consistent across spells. */
const MIN_CARD_WIDTH = 220;
const DESC_WRAP = 240;

const NAME_LINE_COLOR = '#e8d8c8';
const LABEL_COLOR = '#8a7868';
const HEAL_COLOR = '#7ad67a';
const DAMAGE_COLOR = '#e0a06a';
const MANA_COLOR = '#a8c8f0';
const TEMPO_COLOR = '#d8c8b8';
const DESC_COLOR = '#a89888';
const SYNERGY_LINE_COLOR = '#f2c14e';

export interface TooltipLine {
  text: string;
  color: string;
}

export interface SpellTooltipOptions {
  screenWidth?: number;
  depth?: number;
  scrollFactor?: number;
}

export interface PanelSize {
  width: number;
  height: number;
}

/** Dark bordered panel: slot-card for spells, line stack for cooldowns / talent fluff. */
export class SpellTooltip {
  private readonly scene: Phaser.Scene;
  private readonly screenWidth: number;
  private readonly container: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly dynamic: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene, options: SpellTooltipOptions | number = {}) {
    // Backward-compatible: SpellBar historically passed screenWidth as a number.
    const opts: SpellTooltipOptions = typeof options === 'number' ? { screenWidth: options } : options;
    this.scene = scene;
    this.screenWidth = opts.screenWidth ?? 960;
    this.bg = scene.add.rectangle(0, 0, 10, 10, BG_COLOR).setOrigin(0, 0).setStrokeStyle(1, BORDER_COLOR);
    this.container = scene.add
      .container(0, 0, [this.bg])
      .setDepth(opts.depth ?? DEPTH)
      .setScrollFactor(opts.scrollFactor ?? 0)
      .setVisible(false);
  }

  /** Fills the panel with a spell slot card; returns size for caller placement. */
  fillCard(card: SpellCardModel): PanelSize {
    this.clearDynamic();
    let cursorY = PADDING;
    let contentWidth = MIN_CARD_WIDTH - PADDING * 2;

    if (card.eyebrow) {
      const eyebrow = this.addText(PADDING, cursorY, card.eyebrow, LABEL_SIZE, LABEL_COLOR);
      contentWidth = Math.max(contentWidth, eyebrow.width);
      cursorY += eyebrow.height + 2;
    }

    const name = this.addText(PADDING, cursorY, card.name, FONT_SIZE, NAME_LINE_COLOR);
    contentWidth = Math.max(contentWidth, name.width);
    cursorY += name.height + SECTION_GAP;

    const effectColor = card.effectTone === 'heal' ? HEAL_COLOR : DAMAGE_COLOR;
    const bandX = PADDING;
    const bandY = cursorY;
    const band = this.scene.add
      .rectangle(bandX, bandY, contentWidth, 10, EFFECT_BAND_COLOR)
      .setOrigin(0, 0);
    this.container.add(band);
    this.dynamic.push(band);

    const effectLabel = this.addText(bandX + 6, bandY + 4, 'EFFECT', LABEL_SIZE, LABEL_COLOR);
    const effectValue = this.addText(
      bandX + 6,
      bandY + 4 + effectLabel.height,
      card.effect,
      FONT_SIZE,
      effectColor,
    );
    const bandH = effectLabel.height + effectValue.height + 10;
    const bandInner = Math.max(effectLabel.width, effectValue.width) + 12;
    contentWidth = Math.max(contentWidth, bandInner);
    band.setSize(contentWidth, bandH);
    cursorY += bandH + SECTION_GAP;

    const colWidth = Math.floor(Math.max(contentWidth, MIN_CARD_WIDTH - PADDING * 2) / 3);
    const stripTop = cursorY;
    const costH = this.addStatColumn(PADDING, stripTop, 'COST', card.cost, MANA_COLOR, colWidth);
    const castH = this.addStatColumn(
      PADDING + colWidth,
      stripTop,
      'CAST',
      card.cast,
      TEMPO_COLOR,
      colWidth,
    );
    const cdH = this.addStatColumn(
      PADDING + colWidth * 2,
      stripTop,
      'CD',
      card.cooldown ?? '—',
      TEMPO_COLOR,
      colWidth,
    );
    cursorY = stripTop + Math.max(costH, castH, cdH) + SECTION_GAP;

    let divider: Phaser.GameObjects.Rectangle | null = null;
    const needsBody = Boolean(card.description) || card.notes.length > 0;
    if (needsBody) {
      divider = this.scene.add.rectangle(PADDING, cursorY, contentWidth, 1, DIVIDER_COLOR).setOrigin(0, 0);
      this.container.add(divider);
      this.dynamic.push(divider);
      cursorY += 1 + SECTION_GAP;
    }

    if (card.description) {
      const desc = this.addText(PADDING, cursorY, card.description, FONT_SIZE, DESC_COLOR, DESC_WRAP);
      contentWidth = Math.max(contentWidth, Math.min(desc.width, DESC_WRAP));
      cursorY += desc.height + LINE_GAP;
    }

    for (const note of card.notes) {
      const line = this.addText(PADDING, cursorY, note, FONT_SIZE, SYNERGY_LINE_COLOR, DESC_WRAP);
      contentWidth = Math.max(contentWidth, Math.min(line.width, DESC_WRAP));
      cursorY += line.height + LINE_GAP;
    }

    const panelWidth = Math.max(contentWidth + PADDING * 2, MIN_CARD_WIDTH);
    const finalInner = panelWidth - PADDING * 2;
    band.setSize(finalInner, bandH);
    if (divider) divider.setSize(finalInner, 1);

    const panelHeight = cursorY - (card.notes.length > 0 || card.description ? LINE_GAP : 0) + PADDING;
    this.bg.setSize(panelWidth, Math.max(panelHeight, PADDING * 2));
    return { width: panelWidth, height: this.bg.height };
  }

  /** Fills the panel with a simple colored line stack (cooldowns, talent nodes). */
  fillLines(lines: TooltipLine[]): PanelSize {
    this.clearDynamic();
    let cursorY = PADDING;
    let maxWidth = 0;
    for (const line of lines) {
      const text = this.addText(PADDING, cursorY, line.text, FONT_SIZE, line.color, DESC_WRAP);
      maxWidth = Math.max(maxWidth, Math.min(text.width, DESC_WRAP));
      cursorY += text.height + LINE_GAP;
    }
    const panelWidth = maxWidth + PADDING * 2;
    const panelHeight = Math.max(cursorY - LINE_GAP + PADDING, PADDING * 2);
    this.bg.setSize(panelWidth, panelHeight);
    return { width: panelWidth, height: panelHeight };
  }

  /** Places the panel's top-left at (x, y) and shows it. */
  place(x: number, y: number): void {
    this.container.setPosition(x, y);
    this.container.setVisible(true);
  }

  /** Legacy / cooldown helper: line stack centered above a button. */
  show(anchorX: number, buttonTopY: number, lines: TooltipLine[]): void {
    const size = this.fillLines(lines);
    const panelX = Phaser.Math.Clamp(anchorX - size.width / 2, 0, this.screenWidth - size.width);
    const panelY = buttonTopY - size.height;
    this.place(panelX, panelY);
  }

  /** SpellBar helper: slot card centered above a button. */
  showCard(anchorX: number, buttonTopY: number, card: SpellCardModel): void {
    const size = this.fillCard(card);
    const panelX = Phaser.Math.Clamp(anchorX - size.width / 2, 0, this.screenWidth - size.width);
    const panelY = buttonTopY - size.height;
    this.place(panelX, panelY);
  }

  hide(): void {
    this.container.setVisible(false);
  }

  destroy(): void {
    this.container.destroy();
  }

  private clearDynamic(): void {
    for (const obj of this.dynamic) obj.destroy();
    this.dynamic.length = 0;
  }

  private addText(
    x: number,
    y: number,
    content: string,
    fontSize: string,
    color: string,
    wordWrapWidth?: number,
  ): Phaser.GameObjects.Text {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT,
      fontSize,
      color,
    };
    if (wordWrapWidth) style.wordWrap = { width: wordWrapWidth };
    const text = this.scene.add.text(x, y, content, style);
    this.container.add(text);
    this.dynamic.push(text);
    return text;
  }

  private addStatColumn(
    x: number,
    y: number,
    label: string,
    value: string,
    valueColor: string,
    colWidth: number,
  ): number {
    const labelText = this.addText(x, y, label, LABEL_SIZE, LABEL_COLOR);
    const valueText = this.addText(x, y + labelText.height + 1, value, FONT_SIZE, valueColor);
    if (labelText.width < colWidth) {
      labelText.setX(x + Math.floor((colWidth - labelText.width) / 2));
    }
    if (valueText.width < colWidth) {
      valueText.setX(x + Math.floor((colWidth - valueText.width) / 2));
    }
    return labelText.height + 1 + valueText.height;
  }
}
