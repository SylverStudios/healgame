/**
 * First-clear relic pick: Hub routes here whenever a stable three-card offer
 * is pending. Choosing one appends a permanent stat relic, clears the offer,
 * persists, and returns to the Hub.
 * No skip button — the player must pick. Cards use PixelLab relic icons +
 * pixel-font text; name accents keep role scales (grey defense, red offense,
 * green healing).
 */

import Phaser from 'phaser';
import { SceneKeys } from './keys';
import { loadSave, saveGame } from '../save/save';
import { relicsById } from '../data/relics';
import type { RelicDef } from '../combat/types';
import { drawRunModGlyph } from '../ui/runModsBar';
import { relicGlyphColor, relicGlyphColorCss } from '../ui/relicColors';
import { FONT, FONT_SIZE_SM, FONT_SIZE_MD } from '../ui/theme';
import { addBanner, addPanel } from '../ui/panels';
import { fadeInOnCreate, fadeToScene } from '../ui/transitions';

const BG_COLOR = 0x1a1210;
const CARD_BG = 0x3a2a22;
const BORDER_COLOR = 0x0a0605;
const TEXT_COLOR = '#e8d8c8';
const DIM_COLOR = '#a89888';

const CARD_WIDTH = 240;
const CARD_HEIGHT = 320;
const CARD_GAP = 60;
const CARD_LEFT = 60;
const DESC_WRAP_WIDTH = CARD_WIDTH - 32;
/** Half-size of the relic icon on the pick card (64→64 display = native). */
const GLYPH_RADIUS = 32;

export class RelicScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Relic);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BG_COLOR);
    const { width, height } = this.scale;

    // Chunk 4 (bible item 4): header banner — ui/panels.ts.
    addBanner(this, width / 2, 64, 360, 64);
    this.add
      .text(width / 2, 48, 'Choose a Relic', { fontFamily: FONT, fontSize: FONT_SIZE_MD, color: TEXT_COLOR })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 80, 'This choice is permanent for this save.', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: DIM_COLOR,
      })
      .setOrigin(0.5);

    const offers = relicsById(loadSave().pendingRelicOffers);
    if (offers.length === 0) {
      fadeToScene(this, SceneKeys.Hub);
      return;
    }

    // Chunk 6 (bible item 6): fade in — only once we know Relic is actually
    // going to render (the empty-offers redirect above never shows content).
    fadeInOnCreate(this);

    const y = height / 2 + 20;
    offers.forEach((relic, i) => {
      const x = CARD_LEFT + i * (CARD_WIDTH + CARD_GAP) + CARD_WIDTH / 2;
      this.buildCard(x, y, relic);
    });
  }

  private buildCard(x: number, y: number, relic: RelicDef): void {
    const accent = relicGlyphColor(relic);
    const bg = this.add
      .rectangle(x, y, CARD_WIDTH, CARD_HEIGHT, CARD_BG)
      .setStrokeStyle(2, BORDER_COLOR)
      .setInteractive({ useHandCursor: true })
      .setName(`relicCard:${relic.id}`);
    // Chunk 4: framed card — ui/panels.ts. Hover swaps to 'hover' state via
    // the frame's own API instead of mutating `bg` (which the frame now owns
    // visually) — see the `hitRect` doc in ui/panels.ts.
    const frame = addPanel(this, x, y, CARD_WIDTH, CARD_HEIGHT, {
      fillColor: CARD_BG,
      accentColor: accent,
      hitRect: bg,
    });

    this.add
      .text(x, y - CARD_HEIGHT / 2 + 28, relic.name, {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: relicGlyphColorCss(relic),
      })
      .setOrigin(0.5);

    drawRunModGlyph(this, x, y - CARD_HEIGHT / 2 + 78, relic.id, 'relic', GLYPH_RADIUS);

    this.add
      .text(x, y - CARD_HEIGHT / 2 + 118, relic.description, {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: TEXT_COLOR,
        align: 'center',
        wordWrap: { width: DESC_WRAP_WIDTH },
      })
      .setOrigin(0.5, 0);

    bg.on('pointerover', () => frame.setState('hover'));
    bg.on('pointerout', () => frame.setState('normal'));
    bg.on('pointerdown', () => this.pick(relic));
  }

  private pick(relic: RelicDef): void {
    const save = loadSave();
    if (!save.pendingRelicOffers.includes(relic.id)) return;
    if (!save.relicIds.includes(relic.id)) save.relicIds.push(relic.id);
    save.pendingRelicOffers = [];
    saveGame(save);
    fadeToScene(this, SceneKeys.Hub);
  }
}
