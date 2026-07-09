/**
 * Spell tree (poc-spec §5, §10.2): gold sink, one PoC node ("Deep Reserves").
 * Renders generically from data/tree.ts so Chunk 4 can append subclass branch
 * nodes to that same array without touching this scene. Temp art only.
 */

import Phaser from 'phaser';
import { SceneKeys } from './keys';
import { loadSave, saveGame, type SaveData } from '../save/save';
import { purchaseNode, visibleTreeNodes } from '../meta/progression';

const BG_COLOR = 0x1a1210;
const NODE_BG_LOCKED = 0x241a15;
const NODE_BG_AFFORDABLE = 0x3a2a22;
const NODE_BG_OWNED = 0x2a3a2a;
const BORDER_COLOR = 0x0a0605;
const BUTTON_COLOR = 0x3a2a22;
const TEXT_COLOR = '#e8d8c8';
const DIM_COLOR = '#a89888';
const ACCENT_COLOR = '#f2c14e';
const OWNED_COLOR = '#7ad67a';
const LOCKED_COLOR = '#8a7868';
const FONT = 'monospace';

const NODE_WIDTH = 500;
const NODE_HEIGHT = 74;
const NODE_START_Y = 150;
const NODE_ROW_GAP = 92;

export class TreeScene extends Phaser.Scene {
  private save!: SaveData;
  private goldText!: Phaser.GameObjects.Text;
  private nodesContainer!: Phaser.GameObjects.Container;

  constructor() {
    super(SceneKeys.Tree);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BG_COLOR);
    this.save = loadSave();

    const { width, height } = this.scale;

    this.add.text(width / 2, 40, 'Spell Tree', { fontFamily: FONT, fontSize: '28px', color: TEXT_COLOR }).setOrigin(0.5);
    this.goldText = this.add
      .text(width / 2, 78, '', { fontFamily: FONT, fontSize: '16px', color: ACCENT_COLOR })
      .setOrigin(0.5);

    this.nodesContainer = this.add.container(0, 0);

    this.buildBackButton(width / 2, height - 36);
    this.render();
  }

  private render(): void {
    this.nodesContainer.removeAll(true);
    this.goldText.setText(`Gold: ${this.save.gold}`);

    const centerX = this.scale.width / 2;

    visibleTreeNodes(this.save).forEach((node, i) => {
      const y = NODE_START_Y + i * NODE_ROW_GAP;
      const owned = this.save.treeNodes.includes(node.id);
      const affordable = !owned && this.save.gold >= node.cost;
      const bgColor = owned ? NODE_BG_OWNED : affordable ? NODE_BG_AFFORDABLE : NODE_BG_LOCKED;

      const bg = this.add.rectangle(centerX, y, NODE_WIDTH, NODE_HEIGHT, bgColor).setStrokeStyle(2, BORDER_COLOR);

      const nameText = this.add.text(centerX - NODE_WIDTH / 2 + 16, y - 22, node.name, {
        fontFamily: FONT,
        fontSize: '18px',
        color: TEXT_COLOR,
      });
      const descText = this.add.text(
        centerX - NODE_WIDTH / 2 + 16,
        y + 4,
        `${node.description} — cost ${node.cost}g`,
        { fontFamily: FONT, fontSize: '13px', color: DIM_COLOR },
      );

      const stateLabel = owned ? 'OWNED' : affordable ? 'BUY' : 'TOO EXPENSIVE';
      const stateColor = owned ? OWNED_COLOR : affordable ? ACCENT_COLOR : LOCKED_COLOR;
      const stateText = this.add
        .text(centerX + NODE_WIDTH / 2 - 16, y, stateLabel, { fontFamily: FONT, fontSize: '14px', color: stateColor })
        .setOrigin(1, 0.5);

      this.nodesContainer.add([bg, nameText, descText, stateText]);

      if (affordable) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => {
          const bought = purchaseNode(this.save, node.id);
          if (bought) {
            saveGame(this.save);
            this.render();
          }
        });
      }
    });
  }

  private buildBackButton(x: number, y: number): void {
    const rect = this.add
      .rectangle(x, y, 160, 44, BUTTON_COLOR)
      .setStrokeStyle(2, BORDER_COLOR)
      .setInteractive({ useHandCursor: true });
    this.add.text(x, y, 'Back', { fontFamily: FONT, fontSize: '16px', color: TEXT_COLOR }).setOrigin(0.5);
    rect.on('pointerdown', () => this.scene.start(SceneKeys.Hub));
  }
}
