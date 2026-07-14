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
import { runModsFromSave } from '../data/runMods';
import { RunModsBar } from '../ui/runModsBar';
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

const NODE_WIDTH = 192;
const NODE_HEIGHT = 62;

/**
 * Alpha 0.1 §D5 tree layer 2 sits below the branch rows (world y 600/735),
 * past the 960×540 base canvas (see main.ts) which has no room left after
 * the existing rows (deep-reserves 130 → oaths 260 → branch follow-ups 400 →
 * graven-scale 550). TreeScene now scrolls: world content (nodes/edges) pans
 * under a screen-fixed HUD (title/wallet/status/back button via
 * `setScrollFactor(0)`), driven by mouse wheel. `journey.mjs` reaches layer 2
 * via `page.mouse.wheel(0, dy)` while hovering the canvas, then clicks the
 * resulting on-screen position (world y − scrollY). The compact 820px world
 * still leaves the final row fully reachable at maximum scroll.
 */
const WORLD_HEIGHT = 820;
const WHEEL_SCROLL_SCALE = 0.5;

const TOOLTIP_BG = 0x241a15;
const TOOLTIP_BORDER = 0x0a0605;
const TOOLTIP_PADDING = 8;
const TOOLTIP_GAP = 8;
const TOOLTIP_MAX_WIDTH = 280;
const TOOLTIP_DEPTH = 300;
const HUD_DEPTH = 200;

/**
 * Presentation overrides for the live SPELL_TREE (node placement).
 * Any other config falls through to layoutSpots auto-placement.
 * Journey clicks nodes by `treeNode:<spotId>` name, not by these coords.
 */
const SPELL_TREE_POSITIONS: Readonly<Record<string, SpotPosition>> = {
  'deep-reserves': { x: 480, y: 125 },
  'vigil-oath': { x: 260, y: 235 },
  'zealot-oath': { x: 700, y: 235 },
  'vigil-patient-vow': { x: 150, y: 355 },
  'vigil-measured-devotion': { x: 380, y: 355 },
  'vigil-graven-scale': { x: 150, y: 480 },
  'zealot-fervent-chain': { x: 590, y: 355 },
  'zealot-steady-hands': { x: 820, y: 355 },
  // Layer 2 (Alpha 0.1 §D5) — below the branch row, reached via scroll.
  'vigil-deep-well': { x: 150, y: 600 },
  'vigil-thrift': { x: 380, y: 600 },
  'zealot-quick-breath': { x: 590, y: 600 },
  'zealot-spendthrift-grace': { x: 820, y: 600 },
  'vigil-still-waters': { x: 265, y: 735 },
  'zealot-frenzied-liturgy': { x: 705, y: 735 },
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
  /** Arm-confirmation status line only (e.g. "CLICK AGAIN TO SWEAR"); node
   *  descriptions moved to the node-anchored tooltip below. */
  private statusText!: Phaser.GameObjects.Text;
  private feedbackText!: Phaser.GameObjects.Text;
  private nodesContainer!: Phaser.GameObjects.Container;
  private tooltipContainer!: Phaser.GameObjects.Container;
  private tooltipBg!: Phaser.GameObjects.Rectangle;
  private tooltipText!: Phaser.GameObjects.Text;
  /** In-memory only: exclusive-group spot armed for confirm click. */
  private armedSpotId: string | null = null;
  private feedback = '';
  private runModsBar: RunModsBar | null = null;

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

    // Tree content (nodes/edges) lives in a world taller than the viewport
    // (layer 2 sits below the fold); the camera scrolls over it via wheel.
    // The bg catch-rect below scrolls with the world (default scrollFactor 1)
    // so pointerdown-to-disarm still fires anywhere in the scrolled view.
    this.cameras.main.setBounds(0, 0, width, WORLD_HEIGHT);
    this.input.on(
      'wheel',
      (
        _pointer: Phaser.Input.Pointer,
        _objects: unknown,
        _dx: number,
        dy: number,
      ) => {
        const maxScroll = Math.max(0, WORLD_HEIGHT - height);
        this.cameras.main.scrollY = Phaser.Math.Clamp(
          this.cameras.main.scrollY + dy * WHEEL_SCROLL_SCALE,
          0,
          maxScroll,
        );
      },
    );

    this.add
      .rectangle(width / 2, WORLD_HEIGHT / 2, width, WORLD_HEIGHT, BG_COLOR)
      .setInteractive()
      .on('pointerdown', () => this.disarmAndRerenderIfNeeded());

    this.add
      .rectangle(width / 2, 39, 290, 58, 0x241a15, 0.96)
      .setStrokeStyle(1, BORDER_COLOR)
      .setDepth(HUD_DEPTH)
      .setScrollFactor(0);
    this.add
      .text(width / 2, 28, 'SPELL TREE', {
        fontFamily: FONT,
        fontSize: '27px',
        fontStyle: 'bold',
        color: '#fff2df',
        stroke: '#0a0605',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH)
      .setScrollFactor(0);
    this.headerText = this.add
      .text(width / 2, 58, '', { fontFamily: FONT, fontSize: '13px', color: ACCENT_COLOR })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH)
      .setScrollFactor(0);

    // Oath/relic strip stays pinned with the HUD (scrollFactor 0) so players can
    // re-read their run mods while browsing the tree.
    this.syncRunModsBar();

    this.statusText = this.add
      .text(width / 2, 470, '', {
        fontFamily: FONT,
        fontSize: '12px',
        color: TEXT_COLOR,
        align: 'center',
        wordWrap: { width: 860 },
      })
      .setOrigin(0.5, 1)
      .setDepth(HUD_DEPTH)
      .setScrollFactor(0);

    this.feedbackText = this.add
      .text(width / 2, 488, '', {
        fontFamily: FONT,
        fontSize: '12px',
        color: DANGER_COLOR,
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setDepth(HUD_DEPTH)
      .setScrollFactor(0);

    this.nodesContainer = this.add.container(0, 0);

    this.tooltipBg = this.add
      .rectangle(0, 0, 10, 10, TOOLTIP_BG)
      .setOrigin(0, 0)
      .setStrokeStyle(1, TOOLTIP_BORDER);
    this.tooltipText = this.add.text(TOOLTIP_PADDING, TOOLTIP_PADDING, '', {
      fontFamily: FONT,
      fontSize: '12px',
      color: TEXT_COLOR,
      align: 'left',
      wordWrap: { width: TOOLTIP_MAX_WIDTH - TOOLTIP_PADDING * 2 },
    });
    this.tooltipContainer = this.add
      .container(0, 0, [this.tooltipBg, this.tooltipText])
      .setDepth(TOOLTIP_DEPTH)
      .setVisible(false);

    this.buildBackButton(120, 504);
    this.buildOathLockIcon();
    this.render();
  }

  /** Simple lock glyph between the Vigil and Zealot oath nodes (handoff §Q). */
  private buildOathLockIcon(): void {
    const x = 480;
    const y = 235;
    const shackle = this.add
      .rectangle(x, y - 7, 12, 9, BG_COLOR)
      .setStrokeStyle(2, 0x8a7868)
      .setDepth(1);
    const body = this.add
      .rectangle(x, y + 3, 14, 12, 0x8a7868)
      .setStrokeStyle(1, BORDER_COLOR)
      .setDepth(1);
    shackle.disableInteractive();
    body.disableInteractive();
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
    this.hideTooltip();
    this.nodesContainer.removeAll(true);
    const treeView = view(SPELL_TREE, this.treeState);
    const gold = treeView.wallet['gold'] ?? 0;
    const ruby = treeView.wallet['ruby'] ?? 0;
    this.headerText.setText(`Gold ${gold} (tree)    Rubies ${ruby} (oaths)`);
    this.statusText.setText(this.armMessage());
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
      .setInteractive({ useHandCursor: purchasable })
      .setName(`treeNode:${spot.id}`);

    bg.on('pointerover', () => this.showTooltip(spot, pos));
    bg.on('pointerout', () => this.hideTooltip());
    bg.on('pointerdown', () => this.onSpotClicked(spot));

    const nameText = this.add
      .text(pos.x, pos.y - 15, spotTitle(spot), {
        fontFamily: FONT,
        fontSize: '13px',
        fontStyle: 'bold',
        color: nameColor,
        align: 'center',
        stroke: '#0a0605',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setAlpha(alpha);
    this.clampTitleWidth(nameText, NODE_WIDTH - 10);

    const costStr = spot.next
      ? costLabel(spot.next.cost.currency, spot.next.cost.amount)
      : spot.status === 'complete'
        ? 'owned'
        : '';
    const costText = this.add
      .text(pos.x, pos.y + 9, costStr, { fontFamily: FONT, fontSize: '12px', color: costColor })
      .setOrigin(0.5)
      .setAlpha(alpha);

    this.nodesContainer.add([bg, nameText, costText]);

    if (spot.status === 'exclusive-locked') {
      const lockedText = this.add
        .text(pos.x, pos.y + 23, 'LOCKED', { fontFamily: FONT, fontSize: '10px', color: DANGER_COLOR })
        .setOrigin(0.5)
        .setAlpha(alpha);
      this.nodesContainer.add(lockedText);
    }
  }

  /**
   * Shows the node-anchored tooltip above the node; flips below if that would
   * clip the canvas top. `pos` is world-space (tooltipContainer scrolls with
   * the tree, scrollFactor 1 default) but the above/below flip decision needs
   * screen-space, so it's computed relative to the camera's current scrollY.
   */
  private showTooltip(spot: SpotView, pos: SpotPosition): void {
    this.tooltipText.setText(spotDescription(spot));
    const panelWidth = this.tooltipText.width + TOOLTIP_PADDING * 2;
    const panelHeight = this.tooltipText.height + TOOLTIP_PADDING * 2;
    this.tooltipBg.setSize(panelWidth, panelHeight);

    const canvasWidth = this.scale.width;
    const canvasHeight = this.scale.height;
    const scrollY = this.cameras.main.scrollY;
    const screenY = pos.y - scrollY;

    const x = Phaser.Math.Clamp(pos.x - panelWidth / 2, 0, Math.max(0, canvasWidth - panelWidth));

    const aboveScreen = screenY - NODE_HEIGHT / 2 - TOOLTIP_GAP - panelHeight;
    const screenY2 =
      aboveScreen >= 0
        ? aboveScreen
        : Phaser.Math.Clamp(screenY + NODE_HEIGHT / 2 + TOOLTIP_GAP, 0, canvasHeight - panelHeight);
    const y = screenY2 + scrollY;

    this.tooltipContainer.setPosition(x, y);
    this.tooltipContainer.setVisible(true);
  }

  private hideTooltip(): void {
    this.tooltipContainer.setVisible(false);
  }

  /** Truncates an already-rendered text object with an ellipsis until it fits maxWidth. */
  private clampTitleWidth(text: Phaser.GameObjects.Text, maxWidth: number): void {
    if (text.width <= maxWidth) return;
    const full = text.text;
    let end = full.length - 1;
    while (end > 1 && text.width > maxWidth) {
      text.setText(`${full.slice(0, end)}…`);
      end -= 1;
    }
  }

  private onSpotClicked(spot: SpotView): void {
    const needsArm = spot.next?.exclusiveGroup === 'subclass' && spot.status === 'affordable';

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
      this.syncRunModsBar();
      return;
    }
    this.feedback = result.message;
  }

  /** Rebuild the HUD strip after an oath purchase so the diamond appears immediately. */
  private syncRunModsBar(): void {
    this.runModsBar?.destroy();
    this.runModsBar = new RunModsBar(this, runModsFromSave(this.save), {
      viewWidth: this.scale.width,
      scrollFactor: 0,
      depth: 250,
    });
  }

  private buildBackButton(x: number, y: number): void {
    const rect = this.add
      .rectangle(x, y, 160, 44, BUTTON_COLOR)
      .setStrokeStyle(2, BORDER_COLOR)
      .setInteractive({ useHandCursor: true })
      .setDepth(HUD_DEPTH)
      .setScrollFactor(0)
      .setName('treeBack');
    this.add
      .text(x, y, 'Back', { fontFamily: FONT, fontSize: '16px', color: TEXT_COLOR })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH)
      .setScrollFactor(0);
    rect.on('pointerdown', () => this.scene.start(SceneKeys.Hub));
  }
}
