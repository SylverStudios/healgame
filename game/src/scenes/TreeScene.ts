/**
 * Talent tree scene — renders any TreeConfig via view() + layoutSpots().
 * Purchases go through tree.update; state is bridged back into SaveData
 * (treeRanks) for persistence. Combat resolves via loadoutFromSave.
 */

import Phaser from 'phaser';
import { SceneKeys } from './keys';
import { loadSave, placeOnActionBar, saveGame, type SaveData } from '../save/save';
import {
  TALENT_TREE,
  applyTreeStateToSave,
  ownedSpellsFromSave,
  treeStateFromLegacy,
  type TalentTreeContent,
} from '../data/talentTree';
import { runModsFromSave } from '../data/runMods';
import { spellById } from '../data/spells';
import { RunModsBar } from '../ui/runModsBar';
import { buildSpellCard } from '../ui/spellCard';
import { SpellTooltip, type TooltipLine } from '../ui/spellTooltip';
import { glyphChar } from '../ui/glyph';
import { allocatedTalentPoints, availableTalentPoints } from '../meta/progression';
import { levelForXp } from '../data/constants';
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

const NODE_RADIUS = 28;
/** Hit/tooltip extent — matches the circular node diameter. */
const NODE_SIZE = NODE_RADIUS * 2;

/**
 * Alpha 0.2 §D8 hourglass tree: rows extend to y≈960 (crown), past the
 * 960×540 base canvas. World height is 1080; max scroll = 1080 − 540 = 540.
 * World content (nodes/edges) pans under a screen-fixed HUD (title/wallet/
 * status/back button via `setScrollFactor(0)`), driven by mouse wheel.
 * Journey reaches deep nodes by wheeling the canvas then clicking by name
 * (`treeNode:<spotId>`) — no coordinate tables needed.
 *
 * Row layout (y centers):
 *   125  deep-reserves
 *   235  vigil-oath / zealot-oath
 *   355  patient-vow/measured / fervent-chain/steady-hands
 *   480  graven-scale (vigil path only)
 *   600  thrift, still-waters / quick-breath, frenzied-liturgy  (layer 2)
 *   720  shared-mend-potency / shared-zealous-potency            (shared mid)
 *   840  vowstrike-virtue / vowstrike-vengeance                  (Vowstrike fork)
 *   960  wrath-ascendant / vowbound-crown                        (crown)
 */
const WORLD_HEIGHT = 1080;
const WHEEL_SCROLL_SCALE = 0.5;

const TOOLTIP_GAP = 8;
const TOOLTIP_DEPTH = 300;
const HUD_DEPTH = 200;
const TALENT_NAME_COLOR = '#e8d8c8';
const TALENT_DESC_COLOR = '#a89888';

/**
 * Presentation overrides for the live TALENT_TREE (node placement).
 * Any other config falls through to layoutSpots auto-placement.
 * Journey clicks nodes by `treeNode:<spotId>` name, not by these coords.
 *
 * Pure-mana nodes vigil-deep-well and zealot-spendthrift-grace were removed
 * in Alpha 0.2; their entries are omitted here.
 */
const TALENT_TREE_POSITIONS: Readonly<Record<string, SpotPosition>> = {
  // Shared early
  'deep-reserves': { x: 480, y: 125 },
  // Oath wedge
  'vigil-oath': { x: 260, y: 235 },
  'zealot-oath': { x: 700, y: 235 },
  'vigil-patient-vow': { x: 150, y: 355 },
  'vigil-measured-devotion': { x: 380, y: 355 },
  'vigil-graven-scale': { x: 150, y: 480 },
  'zealot-fervent-chain': { x: 590, y: 355 },
  'zealot-steady-hands': { x: 820, y: 355 },
  // Layer 2 — output nodes compacted to y 600 (deep-well/spendthrift-grace cut in Alpha 0.2).
  // Four nodes spread across the 960px canvas with ~20px gaps between node edges.
  'vigil-thrift': { x: 160, y: 600 },
  'vigil-still-waters': { x: 375, y: 600 },
  'zealot-quick-breath': { x: 585, y: 600 },
  'zealot-frenzied-liturgy': { x: 800, y: 600 },
  // Shared mid (Alpha 0.2 §D1)
  'shared-mend-potency': { x: 320, y: 720 },
  'shared-zealous-potency': { x: 640, y: 720 },
  // Vowstrike fork (Alpha 0.2 §D4) — exclusiveGroup: vowstrike-aspect
  'vowstrike-virtue': { x: 260, y: 840 },
  'vowstrike-vengeance': { x: 700, y: 840 },
  // Shared crown (Alpha 0.2 §D6)
  'wrath-ascendant': { x: 360, y: 960 },
  'vowbound-crown': { x: 600, y: 960 },
};

function asContent(raw: unknown): TalentTreeContent | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Partial<TalentTreeContent>;
  if (typeof c.name !== 'string' || typeof c.description !== 'string' || !c.effect) return null;
  return c as TalentTreeContent;
}

function costLabel(currency: string, amount: number): string {
  if (currency === 'talent') return `${amount} point`;
  return `${amount} ${currency}`;
}

function showingNode(spot: SpotView) {
  return spot.next ?? spot.owned[spot.owned.length - 1] ?? null;
}

function spotMetaSuffix(spot: SpotView): string {
  const rank =
    spot.chainLength > 1
      ? ` (rank ${spot.owned.length}/${spot.chainLength})`
      : spot.owned.length > 0
        ? ' (owned)'
        : '';
  const cost = spot.next ? ` — ${costLabel(spot.next.cost.currency, spot.next.cost.amount)}` : '';
  return `${rank}${cost}`;
}

/** Non-spell talent nodes: name/meta + description as a simple line stack. */
function spotTalentLines(spot: SpotView): TooltipLine[] {
  const node = showingNode(spot);
  if (!node) return [{ text: spot.id, color: TALENT_NAME_COLOR }];
  const content = asContent(node.content);
  const name = content?.name ?? node.id;
  const lines: TooltipLine[] = [{ text: `${name}${spotMetaSuffix(spot)}`, color: TALENT_NAME_COLOR }];
  const desc = content?.description ?? '';
  if (desc) lines.push({ text: desc, color: TALENT_DESC_COLOR });
  return lines;
}

/** Eyebrow above a grantSpell slot card (talent name when it differs, plus cost/owned). */
function grantSpellEyebrow(spot: SpotView, talentName: string, spellName: string): string {
  const meta = spotMetaSuffix(spot).trim();
  if (talentName !== spellName) {
    return meta ? `${talentName}${spotMetaSuffix(spot)}` : talentName;
  }
  return meta.length > 0 ? meta.replace(/^ — /, '') : 'Spell unlock';
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
  private tooltip!: SpellTooltip;
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
    this.treeState = treeStateFromLegacy(this.save.treeRanks, availableTalentPoints(this.save));
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
      .text(width / 2, 28, 'TALENT TREE', {
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

    this.tooltip = new SpellTooltip(this, {
      screenWidth: width,
      depth: TOOLTIP_DEPTH,
      scrollFactor: 1,
    });

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
    const treeView = view(TALENT_TREE, this.treeState);
    const spot = treeView.spots.find((s) => s.id === this.armedSpotId);
    const content = spot?.next ? asContent(spot.next.content) : null;
    const name = content?.name ?? this.armedSpotId;
    return `${name}: CLICK AGAIN TO SWEAR — permanent, locks the other path`;
  }

  private render(): void {
    this.hideTooltip();
    this.nodesContainer.removeAll(true);
    const treeView = view(TALENT_TREE, this.treeState);
    const available = treeView.wallet['talent'] ?? 0;
    this.headerText.setText(
      `Level ${levelForXp(this.save.xp)}   •   ${available} unplaced   •   ${allocatedTalentPoints(this.save)} placed`,
    );
    this.statusText.setText(this.armMessage());
    this.feedbackText.setText(this.feedback);

    const positions = layoutSpots(treeView, {
      width: this.scale.width,
      overrides: TALENT_TREE_POSITIONS,
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
    let glyphColor = DIM_COLOR;

    if (spot.status === 'exclusive-locked') {
      bgColor = NODE_BG_LOCKED;
      alpha = 0.5;
    } else if (isArmed) {
      bgColor = NODE_BG_AFFORDABLE;
      borderColor = ARM_HEX;
      glyphColor = TEXT_COLOR;
    } else if (purchasable) {
      bgColor = NODE_BG_AFFORDABLE;
      borderColor = ACCENT_HEX;
      glyphColor = TEXT_COLOR;
    } else if (spot.status === 'complete' || (owned && spot.status !== 'locked')) {
      bgColor = NODE_BG_OWNED;
      glyphColor = OWNED_COLOR;
    }

    // Round node — glyph is the icon; name / cost / description live in the hover tooltip.
    const bg = this.add
      .circle(pos.x, pos.y, NODE_RADIUS, bgColor)
      .setStrokeStyle(2, borderColor)
      .setAlpha(alpha)
      .setInteractive({ useHandCursor: purchasable })
      .setName(`treeNode:${spot.id}`);

    bg.on('pointerover', () => this.showTooltip(spot, pos));
    bg.on('pointerout', () => this.hideTooltip());
    bg.on('pointerdown', () => this.onSpotClicked(spot));

    const node = showingNode(spot);
    const content = node ? asContent(node.content) : null;
    const glyph = content ? glyphChar(content) : glyphChar({ id: node?.id ?? spot.id });
    const glyphText = this.add
      .text(pos.x, pos.y - (spot.chainLength > 1 ? 3 : 0), glyph, {
        fontFamily: FONT,
        fontSize: '22px',
        fontStyle: 'bold',
        color: glyphColor,
        stroke: '#0a0605',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setAlpha(alpha);

    const extras: Phaser.GameObjects.GameObject[] = [bg, glyphText];

    // Rank pips for multi-rank spots (replaces on-node cost/rank text).
    if (spot.chainLength > 1) {
      const pipY = pos.y + NODE_RADIUS - 10;
      const totalW = (spot.chainLength - 1) * 8;
      for (let i = 0; i < spot.chainLength; i++) {
        const filled = i < spot.owned.length;
        const pip = this.add
          .circle(pos.x - totalW / 2 + i * 8, pipY, 3, filled ? EDGE_OWNED : 0x5a4a3a)
          .setStrokeStyle(1, BORDER_COLOR)
          .setAlpha(alpha);
        extras.push(pip);
      }
    } else if (spot.status === 'exclusive-locked') {
      const lockMark = this.add
        .text(pos.x, pos.y + 14, '×', {
          fontFamily: FONT,
          fontSize: '12px',
          color: DANGER_COLOR,
        })
        .setOrigin(0.5)
        .setAlpha(alpha);
      extras.push(lockMark);
    } else if (purchasable && spot.next) {
      // Tiny affordability tick — full cost string stays in the tooltip.
      const tick = this.add
        .circle(pos.x + NODE_RADIUS - 6, pos.y - NODE_RADIUS + 6, 4, ACCENT_HEX)
        .setStrokeStyle(1, BORDER_COLOR)
        .setAlpha(alpha);
      extras.push(tick);
    }

    this.nodesContainer.add(extras);
  }

  /**
   * Shows the node-anchored tooltip above the node; flips below if that would
   * clip the canvas top. `pos` is world-space (tooltip scrolls with the tree)
   * but the above/below flip decision needs screen-space, so it's computed
   * relative to the camera's current scrollY.
   * grantSpell nodes use the same slot-card layout as combat spell tooltips.
   */
  private showTooltip(spot: SpotView, pos: SpotPosition): void {
    const node = showingNode(spot);
    const content = node ? asContent(node.content) : null;
    const grantedSpell =
      content?.effect.kind === 'grantSpell' ? spellById(content.effect.spellId) : undefined;

    const size =
      grantedSpell && content
        ? this.tooltip.fillCard(
            buildSpellCard(grantedSpell, {
              eyebrow: grantSpellEyebrow(spot, content.name, grantedSpell.name),
              description: content.description,
            }),
          )
        : this.tooltip.fillLines(spotTalentLines(spot));

    const canvasWidth = this.scale.width;
    const canvasHeight = this.scale.height;
    const scrollY = this.cameras.main.scrollY;
    const screenY = pos.y - scrollY;

    const x = Phaser.Math.Clamp(pos.x - size.width / 2, 0, Math.max(0, canvasWidth - size.width));

    const aboveScreen = screenY - NODE_SIZE / 2 - TOOLTIP_GAP - size.height;
    const screenY2 =
      aboveScreen >= 0
        ? aboveScreen
        : Phaser.Math.Clamp(screenY + NODE_SIZE / 2 + TOOLTIP_GAP, 0, canvasHeight - size.height);
    const y = screenY2 + scrollY;

    this.tooltip.place(x, y);
  }

  private hideTooltip(): void {
    this.tooltip.hide();
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
    const before = new Set(ownedSpellsFromSave(this.save).map((s) => s.id));
    const result = update(TALENT_TREE, this.treeState, { type: 'purchase', spotId });
    if (result.ok) {
      this.treeState = result.state;
      applyTreeStateToSave(this.save, this.treeState);
      for (const spell of ownedSpellsFromSave(this.save)) {
        if (!before.has(spell.id)) placeOnActionBar(this.save, spell.id);
      }
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
