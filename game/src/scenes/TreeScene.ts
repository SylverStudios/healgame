/**
 * Spell tree (phase-2-handoff §"Tree rendering", "Done means" item 3): a real
 * node graph with prerequisite edges, rank pips, and in-tree subclass
 * purchase (SubclassScene is gone — buying an oath node here spends the ruby
 * and permanently locks the rival branch). Renders generically from
 * data/tree.ts + meta/progression.ts so new nodes never require scene
 * changes; only NODE_POSITIONS (presentation layout, not gameplay data) is
 * scene-local. Temp art only: rects, 2px lines, monospace, dark palette.
 */

import Phaser from 'phaser';
import { SceneKeys } from './keys';
import { loadSave, saveGame, type SaveData } from '../save/save';
import { nodeStatus, purchaseNode, type TreeNodeStatus } from '../meta/progression';
import { TREE_NODES, treeNodeById, type TreeNode } from '../data/tree';

const BG_COLOR = 0x1a1210;
const NODE_BG_LOCKED = 0x241a15;
const NODE_BG_AFFORDABLE = 0x3a2a22;
const NODE_BG_OWNED = 0x2a3a2a;
const BORDER_COLOR = 0x0a0605;
const BUTTON_COLOR = 0x3a2a22;
const ACCENT_HEX = 0xf2c14e;
const ARM_HEX = 0xe05a4e;
const EDGE_OWNED = 0x7ad67a;
const EDGE_AVAILABLE = 0xf2c14e;
const EDGE_LOCKED = 0x3a2a22;

const TEXT_COLOR = '#e8d8c8';
const DIM_COLOR = '#a89888';
const ACCENT_COLOR = '#f2c14e';
const OWNED_COLOR = '#7ad67a';
const DANGER_COLOR = '#e05a4e';
const FONT = 'monospace';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 70;

/** Presentation-only layout (locked decision, phase-2-handoff). Any node id
 * missing here is skipped with a console.warn rather than crashing. */
const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  'deep-reserves': { x: 480, y: 130 },
  'vigil-oath': { x: 260, y: 260 },
  'zealot-oath': { x: 700, y: 260 },
  'vigil-patient-vow': { x: 150, y: 400 },
  'vigil-measured-devotion': { x: 380, y: 400 },
  'zealot-fervent-chain': { x: 590, y: 400 },
  'zealot-desperate-zeal': { x: 820, y: 400 },
};

function costLabel(node: TreeNode): string {
  return `${node.cost.amount}${node.cost.currency === 'gold' ? 'g' : ' ruby'}`;
}

export class TreeScene extends Phaser.Scene {
  private save!: SaveData;
  private headerText!: Phaser.GameObjects.Text;
  private descriptionText!: Phaser.GameObjects.Text;
  private nodesContainer!: Phaser.GameObjects.Container;
  /** In-memory only (not persisted): the oath node armed for its second confirming click. */
  private armedNodeId: string | null = null;

  constructor() {
    super(SceneKeys.Tree);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BG_COLOR);
    this.save = loadSave();
    this.armedNodeId = null;

    const { width, height } = this.scale;

    // Full-scene backdrop, added first (bottom of display list) so nodes and
    // buttons drawn later still receive their own clicks first; catches
    // "clicking anywhere else" to disarm an armed oath node.
    this.add
      .rectangle(width / 2, height / 2, width, height, BG_COLOR)
      .setInteractive()
      .on('pointerdown', () => this.disarmAndRerenderIfNeeded());

    this.add.text(width / 2, 34, 'Spell Tree', { fontFamily: FONT, fontSize: '26px', color: TEXT_COLOR }).setOrigin(0.5);
    this.headerText = this.add
      .text(width / 2, 64, '', { fontFamily: FONT, fontSize: '15px', color: ACCENT_COLOR })
      .setOrigin(0.5);

    this.descriptionText = this.add
      .text(width / 2, 470, '', {
        fontFamily: FONT,
        fontSize: '12px',
        color: TEXT_COLOR,
        align: 'center',
        wordWrap: { width: 860 },
      })
      .setOrigin(0.5, 1);

    this.nodesContainer = this.add.container(0, 0);

    this.buildBackButton(120, 504);
    this.render();
  }

  private disarmAndRerenderIfNeeded(): void {
    if (this.armedNodeId === null) return;
    this.armedNodeId = null;
    this.render();
  }

  private armMessage(): string {
    if (this.armedNodeId === null) return '';
    const node = treeNodeById(this.armedNodeId);
    return node ? `${node.name}: CLICK AGAIN TO SWEAR — permanent, locks the other path` : '';
  }

  private fullDescription(node: TreeNode, status: TreeNodeStatus): string {
    const rankLabel =
      node.maxRanks > 1 ? `  (rank ${status.ranks}/${node.maxRanks})` : status.ranks > 0 ? '  (owned)' : '';
    return `${node.name}${rankLabel}  —  ${costLabel(node)}/rank\n${node.description}`;
  }

  private render(): void {
    this.nodesContainer.removeAll(true);
    this.headerText.setText(`Gold: ${this.save.gold}    Rubies: ${this.save.rubies}`);
    this.descriptionText.setText(this.armMessage());

    const statuses = new Map<string, TreeNodeStatus>();
    for (const node of TREE_NODES) {
      const status = nodeStatus(this.save, node.id);
      if (status) statuses.set(node.id, status);
    }

    this.renderEdges(statuses);

    for (const node of TREE_NODES) {
      const pos = NODE_POSITIONS[node.id];
      const status = statuses.get(node.id);
      if (!pos || !status) {
        console.warn(`TreeScene: no layout position for node "${node.id}" — skipped.`);
        continue;
      }
      this.renderNodeBox(node, status, pos);
    }
  }

  private renderEdges(statuses: Map<string, TreeNodeStatus>): void {
    const graphics = this.add.graphics();
    this.nodesContainer.add(graphics);

    for (const node of TREE_NODES) {
      const childPos = NODE_POSITIONS[node.id];
      if (!childPos) continue;
      const childOwned = (statuses.get(node.id)?.ranks ?? 0) > 0;

      for (const reqId of node.requires) {
        const reqPos = NODE_POSITIONS[reqId];
        if (!reqPos) continue;
        const reqOwned = (statuses.get(reqId)?.ranks ?? 0) > 0;

        const color = childOwned && reqOwned ? EDGE_OWNED : reqOwned ? EDGE_AVAILABLE : EDGE_LOCKED;
        graphics.lineStyle(2, color, 1);
        graphics.lineBetween(reqPos.x, reqPos.y, childPos.x, childPos.y);
      }
    }
  }

  private renderNodeBox(node: TreeNode, status: TreeNodeStatus, pos: { x: number; y: number }): void {
    const isArmed = this.armedNodeId === node.id;
    const owned = status.ranks > 0;

    let bgColor = NODE_BG_LOCKED;
    let borderColor = BORDER_COLOR;
    let alpha = 1;
    let nameColor = DIM_COLOR;
    let costColor = DIM_COLOR;

    if (status.lockedByExclusive) {
      bgColor = NODE_BG_LOCKED;
      alpha = 0.5;
    } else if (isArmed) {
      bgColor = NODE_BG_AFFORDABLE;
      borderColor = ARM_HEX;
      nameColor = TEXT_COLOR;
      costColor = ACCENT_COLOR;
    } else if (status.purchasable) {
      bgColor = NODE_BG_AFFORDABLE;
      borderColor = ACCENT_HEX;
      nameColor = TEXT_COLOR;
      costColor = ACCENT_COLOR;
    } else if (owned) {
      bgColor = NODE_BG_OWNED;
      nameColor = OWNED_COLOR;
    }

    const bg = this.add
      .rectangle(pos.x, pos.y, NODE_WIDTH, NODE_HEIGHT, bgColor)
      .setStrokeStyle(2, borderColor)
      .setAlpha(alpha)
      .setInteractive({ useHandCursor: status.purchasable });

    bg.on('pointerover', () => this.descriptionText.setText(this.fullDescription(node, status)));
    bg.on('pointerout', () => this.descriptionText.setText(this.armMessage()));
    bg.on('pointerdown', () => this.onNodeClicked(node, status));

    const rankSuffix = node.maxRanks > 1 ? ` ${status.ranks}/${node.maxRanks}` : '';
    const nameText = this.add
      .text(pos.x, pos.y - 20, `${node.name}${rankSuffix}`, {
        fontFamily: FONT,
        fontSize: '13px',
        color: nameColor,
        align: 'center',
        wordWrap: { width: NODE_WIDTH - 16 },
      })
      .setOrigin(0.5)
      .setAlpha(alpha);
    const costText = this.add
      .text(pos.x, pos.y + 10, costLabel(node), { fontFamily: FONT, fontSize: '13px', color: costColor })
      .setOrigin(0.5)
      .setAlpha(alpha);

    this.nodesContainer.add([bg, nameText, costText]);

    if (status.lockedByExclusive) {
      const lockedText = this.add
        .text(pos.x, pos.y + 27, 'LOCKED', { fontFamily: FONT, fontSize: '12px', color: DANGER_COLOR })
        .setOrigin(0.5)
        .setAlpha(alpha);
      this.nodesContainer.add(lockedText);
    }
  }

  private onNodeClicked(node: TreeNode, status: TreeNodeStatus): void {
    const isOath = node.exclusiveGroup === 'subclass';

    if (isOath && status.purchasable) {
      if (this.armedNodeId === node.id) {
        const bought = purchaseNode(this.save, node.id);
        if (bought) saveGame(this.save);
        this.armedNodeId = null;
        this.render();
        return;
      }
      this.armedNodeId = node.id;
      this.render();
      return;
    }

    const wasArmed = this.armedNodeId !== null;
    this.armedNodeId = null;

    if (status.purchasable) {
      const bought = purchaseNode(this.save, node.id);
      if (bought) {
        saveGame(this.save);
        this.render();
        return;
      }
    }

    if (wasArmed) this.render();
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
