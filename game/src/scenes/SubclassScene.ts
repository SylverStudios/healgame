/**
 * Ruby subclass split (poc-spec §6): after Ash Gate's first clear the player
 * has 1 ruby and may commit to a subclass. Two cards, label + short flavor
 * only — no branch tree-node details shown, since the choice is meant to be
 * made blind (poc-spec §6: "player commits blind between the two labels").
 * Click a card to arm it, click again to seal it (spends the ruby, no
 * respec). Temp art only — panels + text, dark palette, monospace.
 */

import Phaser from 'phaser';
import { SceneKeys } from './keys';
import { loadSave, saveGame, type SubclassId } from '../save/save';
import { chooseSubclass } from '../meta/progression';

const BG_COLOR = 0x1a1210;
const CARD_BG_COLOR = 0x241a15;
const CARD_BG_ARMED_COLOR = 0x3a2a10;
const BUTTON_COLOR = 0x3a2a22;
const BORDER_COLOR = 0x0a0605;
const ARMED_BORDER_COLOR = 0xf2c14e;
const TEXT_COLOR = '#e8d8c8';
const DIM_COLOR = '#a89888';
const ACCENT_COLOR = '#f2c14e';
const DANGER_COLOR = '#e05a4e';
const FONT = 'monospace';

const CARD_WIDTH = 400;
const CARD_HEIGHT = 260;
const CARD_Y = 280;
const CARD_GAP = 40;

interface SubclassCardDef {
  id: SubclassId;
  label: string;
  lines: string[];
  sealedText: string;
}

const CARDS: SubclassCardDef[] = [
  {
    id: 'vigil',
    label: 'Path of the Vigil',
    lines: ['Patient, efficient discipline.', 'You master the slow, sure heal —', 'never a wasted drop.'],
    sealedText: 'The Vigil accepts you.',
  },
  {
    id: 'zealot',
    label: 'Path of the Zealot',
    lines: ['Fast, reckless devotion.', 'You master the emergency heal —', 'burn hot, burn now.'],
    sealedText: 'The Zealot accepts you.',
  },
];

export class SubclassScene extends Phaser.Scene {
  private armed: SubclassId | null = null;
  private cardContainers = new Map<SubclassId, Phaser.GameObjects.Container>();
  private sealed = false;

  constructor() {
    super(SceneKeys.Subclass);
  }

  create(): void {
    this.armed = null;
    this.sealed = false;
    this.cardContainers.clear();

    this.cameras.main.setBackgroundColor(BG_COLOR);
    const { width, height } = this.scale;
    const save = loadSave();

    this.add
      .text(width / 2, 50, 'Choose Your Subclass', { fontFamily: FONT, fontSize: '28px', color: TEXT_COLOR })
      .setOrigin(0.5);

    if (save.subclass !== null) {
      this.showBlocked(`You have already sworn: ${this.oathLabel(save.subclass)}.\nThere is no respec.`);
      return;
    }
    if (save.rubies < 1) {
      this.showBlocked('You need 1 ruby to swear a subclass oath.\nClear Ash Gate to earn one.');
      return;
    }

    this.add
      .text(width / 2, 90, 'Spend 1 Ruby — this choice is permanent. Choose blind.', {
        fontFamily: FONT,
        fontSize: '14px',
        color: DIM_COLOR,
      })
      .setOrigin(0.5);

    const startX = width / 2 - (CARD_WIDTH + CARD_GAP) / 2;
    CARDS.forEach((card, i) => {
      const x = startX + i * (CARD_WIDTH + CARD_GAP);
      this.buildCard(card, x, CARD_Y);
    });

    this.buildBackButton(width / 2, height - 36);
  }

  private buildCard(card: SubclassCardDef, x: number, y: number): void {
    const container = this.add.container(x, y);

    const bg = this.add
      .rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT, CARD_BG_COLOR)
      .setStrokeStyle(2, BORDER_COLOR)
      .setInteractive({ useHandCursor: true });

    const labelText = this.add
      .text(0, -CARD_HEIGHT / 2 + 34, card.label, { fontFamily: FONT, fontSize: '20px', color: ACCENT_COLOR })
      .setOrigin(0.5);

    const descText = this.add
      .text(0, -20, card.lines.join('\n'), {
        fontFamily: FONT,
        fontSize: '14px',
        color: TEXT_COLOR,
        align: 'center',
      })
      .setOrigin(0.5);

    const costText = this.add
      .text(0, CARD_HEIGHT / 2 - 66, 'Cost: 1 Ruby', { fontFamily: FONT, fontSize: '13px', color: DIM_COLOR })
      .setOrigin(0.5);

    const promptText = this.add
      .text(0, CARD_HEIGHT / 2 - 34, '', { fontFamily: FONT, fontSize: '13px', color: DANGER_COLOR })
      .setOrigin(0.5);

    container.add([bg, labelText, descText, costText, promptText]);
    container.setData('bg', bg);
    container.setData('prompt', promptText);
    this.cardContainers.set(card.id, container);

    bg.on('pointerdown', () => this.onCardClicked(card));
  }

  private onCardClicked(card: SubclassCardDef): void {
    if (this.sealed) return;

    if (this.armed !== card.id) {
      this.armed = card.id;
      this.refreshCardVisuals();
      return;
    }

    // Second click on the already-armed card: seal it.
    const save = loadSave();
    const ok = chooseSubclass(save, card.id);
    if (!ok) {
      // Shouldn't happen from a freshly-loaded valid scene, but stay safe.
      this.showBlocked('Something changed — this choice is no longer available.');
      return;
    }
    saveGame(save);
    this.sealed = true;
    this.showSealedConfirmation(card);
  }

  private refreshCardVisuals(): void {
    for (const [id, container] of this.cardContainers) {
      const bg = container.getData('bg') as Phaser.GameObjects.Rectangle;
      const prompt = container.getData('prompt') as Phaser.GameObjects.Text;
      const isArmed = id === this.armed;
      bg.setFillStyle(isArmed ? CARD_BG_ARMED_COLOR : CARD_BG_COLOR);
      bg.setStrokeStyle(2, isArmed ? ARMED_BORDER_COLOR : BORDER_COLOR);
      prompt.setText(isArmed ? 'Seal your oath — no turning back' : '');
    }
  }

  private showSealedConfirmation(card: SubclassCardDef): void {
    // Clear the board and show a brief confirmation before returning to Hub.
    this.cardContainers.clear();
    this.children.removeAll(true);

    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, card.sealedText, { fontFamily: FONT, fontSize: '24px', color: ACCENT_COLOR })
      .setOrigin(0.5);

    this.time.delayedCall(1200, () => this.scene.start(SceneKeys.Hub));
  }

  private showBlocked(message: string): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2 - 20, message, {
        fontFamily: FONT,
        fontSize: '16px',
        color: DIM_COLOR,
        align: 'center',
      })
      .setOrigin(0.5);
    this.buildBackButton(width / 2, height - 36);
  }

  private oathLabel(subclass: SubclassId): string {
    return subclass === 'vigil' ? 'Path of the Vigil' : 'Path of the Zealot';
  }

  private buildBackButton(x: number, y: number): void {
    const rect = this.add
      .rectangle(x, y, 160, 44, BUTTON_COLOR)
      .setStrokeStyle(2, BORDER_COLOR)
      .setInteractive({ useHandCursor: true });
    this.add.text(x, y, 'Back', { fontFamily: FONT, fontSize: '16px', color: TEXT_COLOR }).setOrigin(0.5);
    rect.on('pointerdown', () => {
      if (this.sealed) return;
      this.scene.start(SceneKeys.Hub);
    });
  }
}
