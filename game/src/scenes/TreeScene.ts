/**
 * Spell tree scene — renders any TreeConfig via view() + layoutSpots().
 * Purchases go through tree.update; state is bridged back into SaveData
 * (treeRanks) for persistence. Combat resolves via loadoutFromSave.
 */

import Phaser from 'phaser';
import { SceneKeys } from './keys';
import { loadSave, saveGame, type SaveData } from '../save/save';
import {
  SPELL_TREE,
  applyTreeStateToSave,
  treeStateFromLegacy,
  type SpellTreeContent,
} from '../data/spellTree';
import {
  layoutSpots,
  update,
  view,
  type SpotPosition,
  type SpotView,
  type TreeState,
  type TreeView,
} from '../tree';

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

/**
 * Presentation overrides for the live SPELL_TREE (journey click targets).
 * Any other config falls through to layoutSpots auto-placement.
 */
const SPELL_TREE_POSITIONS: Readonly<Record<string, SpotPosition>> = {
  'deep-reserves': { x: 480, y: 130 },
  'vigil-oath': { x: 260, y: 260 },
  'zealot-oath': { x: 700, y: 260 },
  'vigil-patient-vow': { x: 150, y: 400 },
  'vigil-measured-devotion': { x: 380, y: 400 },
  'zealot-fervent-chain': { x: 590, y: 400 },
  'zealot-desperate-zeal': { x: 820, y: 400 },
};

function asContent(raw: unknown): SpellTreeContent | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Partial<SpellTreeContent>;
  if (typeof c.name !== 'string' || typeof c.description !== 'string' || !c.effect) return null;
  return c as SpellTreeContent;
}

function costLabel(currency: string, amount: number): string {
  if (currency === 'gold') return `${amount}g`;
  if (currency === 'ruby') return `${amount} ruby`;
  return `${amount} ${currency}`;
}

function showingNode(spot: SpotView) {
  return spot.next ?? spot.owned[spot.owned.length - 1] ?? null;
}

function spotTitle(spot: SpotView): string {
  const node = showingNode(spot);
  const content = node ? asContent(node.content) : null;
  const name = content?.name ?? node?.id ?? spot.id;
  if (spot.chainLength > 1) return `${name} ${spot.owned.length}/${spot.chainLength}`;
  return name;
}

function spotDescription(spot: SpotView): string {
  const node = showingNode(spot);
  if (!node) return spot.id;
  const content = asContent(node.content);
  const name = content?.name ?? node.id;
  const rank =
    spot.chainLength > 1
      ? `  (rank ${spot.owned.length}/${spot.chainLength})`
      : spot.owned.length > 0
        ? '  (owned)'
        : '';
  const cost = spot.next ? `  —  ${costLabel(spot.next.cost.currency, spot.next.cost.amount)}` : '';
  const desc = content?.description ?? '';
  return `${name}${rank}${cost}\n${desc}`;
}

export class TreeScene extends Phaser.Scene {
  private save!: SaveData;
  private treeState!: TreeState;
  private headerText!: Phaser.GameObjects.Text;
  private descriptionText!: Phaser.GameObjects.Text;
  private feedbackText!: Phaser.GameObjects.Text;
  private nodesContainer!: Phaser.GameObjects.Container;
  /** In-memory only: exclusive-group spot armed for confirm click. */
  private armedSpotId: string | null = null;
  private feedback = '';

  constructor() {
    super(SceneKeys.Tree);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BG_COLOR);
    this.save = loadSave();
    this.treeState = treeStateFromLegacy(this.save.treeRanks, {
      gold: this.save.gold,
      ruby: this.save.rubies,
    });
    this.armedSpotId = null;
    this.feedback = '';

    const { width, height } = this.scale;

    this.add
      .rectangle(width / 2, height / 2, width, height, BG_COLOR)
      .setInteractive()
      .on('pointerdown', () => this.disarmAndRerenderIfNeeded());

    this.add
      .text(width / 2, 34, 'Spell Tree', { fontFamily: FONT, fontSize: '26px', color: TEXT_COLOR })
      .setOrigin(0.5);
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

    this.feedbackText = this.add
      .text(width / 2, 488, '', {
        fontFamily: FONT,
        fontSize: '12px',
        color: DANGER_COLOR,
        align: 'center',
      })
      .setOrigin(0.5, 0);

    this.nodesContainer = this.add.container(0, 0);

    this.buildBackButton(120, 504);
    this.render();
  }

  private disarmAndRerenderIfNeeded(): void {
    if (this.armedSpotId === null && this.feedback === '') return;
    this.armedSpotId = null;
    this.feedback = '';
    this.render();
  }

  private armMessage(): string {
    if (this.armedSpotId === null) return '';
    const treeView = view(SPELL_TREE, this.treeState);
    const spot = treeView.spots.find((s) => s.id === this.armedSpotId);
    const content = spot?.next ? asContent(spot.next.content) : null;
    const name = content?.name ?? this.armedSpotId;
    return `${name}: CLICK AGAIN TO SWEAR — permanent, locks the other path`;
  }

  private render(): void {
    this.nodesContainer.removeAll(true);
    const treeView = view(SPELL_TREE, this.treeState);
    const gold = treeView.wallet['gold'] ?? 0;
    const ruby = treeView.wallet['ruby'] ?? 0;
    this.headerText.setText(`Gold: ${gold}    Rubies: ${ruby}`);
    this.descriptionText.setText(this.armMessage());
    this.feedbackText.setText(this.feedback);

    const positions = layoutSpots(treeView, {
      width: this.scale.width,
      overrides: SPELL_TREE_POSITIONS,
    });

    this.renderEdges(treeView, positions);

    for (const spot of treeView.spots) {
      const pos = positions.get(spot.id);
      if (!pos) continue;
      this.renderSpotBox(spot, pos);
    }
  }

  private renderEdges(treeView: TreeView, positions: Map<string, SpotPosition>): void {
    const graphics = this.add.graphics();
    this.nodesContainer.add(graphics);
    const byId = new Map(treeView.spots.map((s) => [s.id, s]));

    for (const edge of treeView.edges) {
      const fromPos = positions.get(edge.fromSpotId);
      const toPos = positions.get(edge.toSpotId);
      if (!fromPos || !toPos) continue;
      const from = byId.get(edge.fromSpotId);
      const to = byId.get(edge.toSpotId);
      const fromOwned = (from?.owned.length ?? 0) > 0;
      const toOwned = (to?.owned.length ?? 0) > 0;
      const color = toOwned && fromOwned ? EDGE_OWNED : fromOwned ? EDGE_AVAILABLE : EDGE_LOCKED;
      graphics.lineStyle(2, color, 1);
      graphics.lineBetween(fromPos.x, fromPos.y, toPos.x, toPos.y);
    }
  }

  private renderSpotBox(spot: SpotView, pos: SpotPosition): void {
    const isArmed = this.armedSpotId === spot.id;
    const purchasable = spot.status === 'affordable';
    const owned = spot.owned.length > 0;

    let bgColor = NODE_BG_LOCKED;
    let borderColor = BORDER_COLOR;
    let alpha = 1;
    let nameColor = DIM_COLOR;
    let costColor = DIM_COLOR;

    if (spot.status === 'exclusive-locked') {
      bgColor = NODE_BG_LOCKED;
      alpha = 0.5;
    } else if (isArmed) {
      bgColor = NODE_BG_AFFORDABLE;
      borderColor = ARM_HEX;
      nameColor = TEXT_COLOR;
      costColor = ACCENT_COLOR;
    } else if (purchasable) {
      bgColor = NODE_BG_AFFORDABLE;
      borderColor = ACCENT_HEX;
      nameColor = TEXT_COLOR;
      costColor = ACCENT_COLOR;
    } else if (spot.status === 'complete' || (owned && spot.status !== 'locked')) {
      bgColor = NODE_BG_OWNED;
      nameColor = OWNED_COLOR;
    }

    const bg = this.add
      .rectangle(pos.x, pos.y, NODE_WIDTH, NODE_HEIGHT, bgColor)
      .setStrokeStyle(2, borderColor)
      .setAlpha(alpha)
      .setInteractive({ useHandCursor: purchasable });

    bg.on('pointerover', () => this.descriptionText.setText(spotDescription(spot)));
    bg.on('pointerout', () => this.descriptionText.setText(this.armMessage()));
    bg.on('pointerdown', () => this.onSpotClicked(spot));

    const nameText = this.add
      .text(pos.x, pos.y - 20, spotTitle(spot), {
        fontFamily: FONT,
        fontSize: '13px',
        color: nameColor,
        align: 'center',
        wordWrap: { width: NODE_WIDTH - 16 },
      })
      .setOrigin(0.5)
      .setAlpha(alpha);

    const costStr = spot.next
      ? costLabel(spot.next.cost.currency, spot.next.cost.amount)
      : spot.status === 'complete'
        ? 'owned'
        : '';
    const costText = this.add
      .text(pos.x, pos.y + 10, costStr, { fontFamily: FONT, fontSize: '13px', color: costColor })
      .setOrigin(0.5)
      .setAlpha(alpha);

    this.nodesContainer.add([bg, nameText, costText]);

    if (spot.status === 'exclusive-locked') {
      const lockedText = this.add
        .text(pos.x, pos.y + 27, 'LOCKED', { fontFamily: FONT, fontSize: '12px', color: DANGER_COLOR })
        .setOrigin(0.5)
        .setAlpha(alpha);
      this.nodesContainer.add(lockedText);
    }
  }

  private onSpotClicked(spot: SpotView): void {
    const needsArm = spot.next?.exclusiveGroup !== undefined && spot.status === 'affordable';

    if (needsArm) {
      if (this.armedSpotId === spot.id) {
        this.tryPurchase(spot.id);
        this.armedSpotId = null;
        this.render();
        return;
      }
      this.armedSpotId = spot.id;
      this.feedback = '';
      this.render();
      return;
    }

    const wasArmed = this.armedSpotId !== null;
    this.armedSpotId = null;

    if (spot.status === 'affordable') {
      this.tryPurchase(spot.id);
      this.render();
      return;
    }

    if (spot.status === 'exclusive-locked') {
      this.feedback = 'Path locked by your oath';
    } else if (spot.status === 'unaffordable' && spot.next) {
      this.feedback = `Need ${costLabel(spot.next.cost.currency, spot.next.cost.amount)}`;
    } else if (spot.status === 'locked') {
      this.feedback = 'Prerequisites not met';
    } else {
      this.feedback = '';
    }

    if (wasArmed || this.feedback) this.render();
  }

  private tryPurchase(spotId: string): void {
    const result = update(SPELL_TREE, this.treeState, { type: 'purchase', spotId });
    if (result.ok) {
      this.treeState = result.state;
      applyTreeStateToSave(this.save, this.treeState);
      saveGame(this.save);
      this.feedback = '';
      return;
    }
    this.feedback = result.message;
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
