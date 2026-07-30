/**
 * Spell-card album (cards progression mode).
 *
 * Chunk 0 stub: empty album + back to Hub so Hub → Spells does not crash.
 * Chunk 3 replaces with full album + chip draft modal.
 */

import Phaser from 'phaser';
import { SceneKeys } from './keys';
import { FONT, FONT_SIZE_LG, FONT_SIZE_SM } from '../ui/theme';
import { addButton, addPanel } from '../ui/panels';
import { fadeInOnCreate, fadeToScene } from '../ui/transitions';

const BG_COLOR = 0x1a1210;
const BUTTON_COLOR = 0x3a2a22;
const BORDER_COLOR = 0x0a0605;
const TEXT_COLOR = '#e8d8c8';
const DIM_COLOR = '#a89888';

export class CardAlbumScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.CardAlbum);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BG_COLOR);
    fadeInOnCreate(this);
    const { width, height } = this.scale;
    const cx = width / 2;

    this.add
      .text(cx, 40, 'Spells', { fontFamily: FONT, fontSize: FONT_SIZE_LG, color: TEXT_COLOR })
      .setOrigin(0.5);

    addPanel(this, cx, height / 2, 520, 160);
    this.add
      .text(cx, height / 2, 'Spell album — coming next.', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: DIM_COLOR,
        align: 'center',
      })
      .setOrigin(0.5);

    const back = this.add
      .rectangle(cx, height - 48, 200, 44, BUTTON_COLOR)
      .setStrokeStyle(2, BORDER_COLOR)
      .setInteractive({ useHandCursor: true })
      .setName('cardAlbumBack');
    addButton(this, cx, height - 48, 200, 44, { fillColor: BUTTON_COLOR, hitRect: back });
    this.add
      .text(cx, height - 48, 'Back', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: TEXT_COLOR,
      })
      .setOrigin(0.5);
    back.on('pointerdown', () => fadeToScene(this, SceneKeys.Hub, {}));
  }
}
