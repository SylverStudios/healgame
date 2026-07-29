/**
 * Radial talent wheel (Wave 5). Chunk 0 stub — polar layout + A/B modal land
 * in Chunk 3. Keeps lattice TreeScene untouched.
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
const ACCENT_COLOR = '#f2c14e';

export class RadialTreeScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.RadialTree);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BG_COLOR);
    fadeInOnCreate(this);
    const { width, height } = this.scale;
    const cx = width / 2;

    this.add
      .text(cx, 48, 'Radial Tree', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_LG,
        color: TEXT_COLOR,
      })
      .setOrigin(0.5);

    addPanel(this, cx, height / 2 - 20, 520, 220);

    this.add
      .text(cx, height / 2 - 60, 'Wheel coming in Wave 5', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5);

    this.add
      .text(cx, height / 2 - 10, 'Heal + Bonk are prepurchased.\nMend unlocks on Ring 1.', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: DIM_COLOR,
        align: 'center',
      })
      .setOrigin(0.5);

    const back = this.add
      .rectangle(cx, height - 56, 200, 44, BUTTON_COLOR)
      .setStrokeStyle(2, BORDER_COLOR)
      .setInteractive({ useHandCursor: true })
      .setName('treeBack');
    addButton(this, cx, height - 56, 200, 44, { fillColor: BUTTON_COLOR, hitRect: back });
    this.add
      .text(cx, height - 56, 'Back', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: TEXT_COLOR,
      })
      .setOrigin(0.5);
    back.on('pointerdown', () => fadeToScene(this, SceneKeys.Hub, {}));
  }
}
