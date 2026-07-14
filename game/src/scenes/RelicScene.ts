/**
 * First-clear relic pick: Hub routes here whenever a stable three-card offer
 * is pending. Choosing one appends a permanent stat relic, clears the offer,
 * persists, and returns to the Hub.
 * No skip button — the player must pick. Temp art only: rects + monospace
 * text, dark palette, matching Hub/Tree conventions. Card glyphs match the
 * shared RunModsBar icon language (colored circles).
 */

import Phaser from 'phaser';
import { SceneKeys } from './keys';
import { loadSave, saveGame } from '../save/save';
import { relicsById } from '../data/relics';
import type { RelicDef } from '../combat/types';
import { drawRunModGlyph } from '../ui/runModsBar';

const BG_COLOR = 0x1a1210;
const CARD_BG = 0x3a2a22;
const CARD_BG_HOVER = 0x4a3a2e;
const BORDER_COLOR = 0x0a0605;
const HOVER_BORDER_COLOR = 0xf2c14e;
const TEXT_COLOR = '#e8d8c8';
const ACCENT_COLOR = '#f2c14e';
const DIM_COLOR = '#a89888';
const FONT = 'monospace';

const CARD_WIDTH = 240;
const CARD_HEIGHT = 320;
const CARD_GAP = 60;
const CARD_LEFT = 60;
const DESC_WRAP_WIDTH = CARD_WIDTH - 32;
const GLYPH_RADIUS = 18;

export class RelicScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Relic);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BG_COLOR);
    const { width, height } = this.scale;

    this.add
      .text(width / 2, 48, 'Choose a Relic', { fontFamily: FONT, fontSize: '26px', color: TEXT_COLOR })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 80, 'This choice is permanent for this save.', {
        fontFamily: FONT,
        fontSize: '14px',
        color: DIM_COLOR,
      })
      .setOrigin(0.5);

    const offers = relicsById(loadSave().pendingRelicOffers);
    if (offers.length === 0) {
      this.scene.start(SceneKeys.Hub);
      return;
    }

    const y = height / 2 + 20;
    offers.forEach((relic, i) => {
      const x = CARD_LEFT + i * (CARD_WIDTH + CARD_GAP) + CARD_WIDTH / 2;
      this.buildCard(x, y, relic);
    });
  }

  private buildCard(x: number, y: number, relic: RelicDef): void {
    const bg = this.add
      .rectangle(x, y, CARD_WIDTH, CARD_HEIGHT, CARD_BG)
      .setStrokeStyle(2, BORDER_COLOR)
      .setInteractive({ useHandCursor: true })
      .setName(`relicCard:${relic.id}`);

    this.add
      .text(x, y - CARD_HEIGHT / 2 + 28, relic.name, {
        fontFamily: FONT,
        fontSize: '18px',
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5);

    drawRunModGlyph(this, x, y - CARD_HEIGHT / 2 + 78, relic.id, 'relic', GLYPH_RADIUS);

    this.add
      .text(x, y - CARD_HEIGHT / 2 + 118, relic.description, {
        fontFamily: FONT,
        fontSize: '14px',
        color: TEXT_COLOR,
        align: 'center',
        wordWrap: { width: DESC_WRAP_WIDTH },
      })
      .setOrigin(0.5, 0);

    bg.on('pointerover', () => bg.setFillStyle(CARD_BG_HOVER).setStrokeStyle(2, HOVER_BORDER_COLOR));
    bg.on('pointerout', () => bg.setFillStyle(CARD_BG).setStrokeStyle(2, BORDER_COLOR));
    bg.on('pointerdown', () => this.pick(relic));
  }

  private pick(relic: RelicDef): void {
    const save = loadSave();
    if (!save.pendingRelicOffers.includes(relic.id)) return;
    if (!save.relicIds.includes(relic.id)) save.relicIds.push(relic.id);
    save.pendingRelicOffers = [];
    saveGame(save);
    this.scene.start(SceneKeys.Hub);
  }
}
