/**
 * Talent tree scene — renders any TreeConfig via view() + layoutFromGrid().
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
import { drawBuildGlyph } from '../ui/buildGlyph';
import { costLabel, grantSpellEyebrow, spotMetaSuffix } from '../ui/treeSpotMeta';
import { allocatedTalentPoints, availableTalentPoints } from '../meta/progression';
import { levelForXp } from '../data/constants';
import { FONT, FONT_SIZE_XS, FONT_SIZE_SM, FONT_SIZE_MD, PALETTE, PALETTE_NUM } from '../ui/theme';
import {
  EDGE_LOCKED,
  EDGE_TRAVERSED,
  drawEdgeStrip,
  drawSocketRing,
  edgeAlpha,
  edgeDisplayWeight,
  edgeTint,
  edgeUsesTexturedStrip,
  socketRingTint,
  socketVisualState,
} from '../ui/treeSockets';
import {
  buildGlyphFromTree,
  layoutFromGrid,
  update,
  view,
  type EdgeState,
  type GridPosition,
  type SpotDef,
  type SpotPosition,
  type SpotView,
  type TreeState,
  type TreeView,
} from '../tree';
import { fadeInOnCreate, fadeToScene } from '../ui/transitions';

// Colors below alias `ui/theme.ts`'s PALETTE/PALETTE_NUM (handoff "Locked
// decisions": new work imports the shared palette instead of local hex
// consts). `NODE_BG_OWNED` has no PALETTE_NUM equivalent (a distinct
// dark-green node fill not reused elsewhere) and stays a local const per the
// same "only migrate where it doesn't change semantics" rule that keeps the
// four-state EDGE_* palette in `ui/treeSockets.ts` instead of PALETTE_NUM.
const BG_COLOR = PALETTE_NUM.bg;
const NODE_BG_LOCKED = PALETTE_NUM.panel;
const NODE_BG_AFFORDABLE = PALETTE_NUM.panelLight;
const NODE_BG_OWNED = 0x2a3a2a;
const BORDER_COLOR = PALETTE_NUM.borderDark;
const BUTTON_COLOR = PALETTE_NUM.panelLight;
const ACCENT_HEX = PALETTE_NUM.gold;
const ARM_HEX = PALETTE_NUM.danger;

// `: string` annotations below are load-bearing: `PALETTE` is declared
// `as const` in theme.ts, so a bare `const X = PALETTE.foo` infers X's exact
// literal type instead of widening to `string` (unlike the old raw string
// literals here, which widened automatically) — without the annotation,
// `let glyphColor = DIM_COLOR` below would infer a single-literal type and
// reject every other palette string it's later reassigned to.
const TEXT_COLOR: string = PALETTE.text;
const DIM_COLOR: string = PALETTE.dim;
const ACCENT_COLOR: string = PALETTE.gold;
const OWNED_COLOR: string = PALETTE.health;
/** Rank-pip filled color (hex, matches OWNED_COLOR string above). */
const OWNED_COLOR_HEX = PALETTE_NUM.health;
const DANGER_COLOR: string = PALETTE.danger;

const NODE_RADIUS = 20;
/** Hit/tooltip extent — matches the circular node diameter. */
const NODE_SIZE = NODE_RADIUS * 2;
/** Socket ring display size — exactly `NODE_SIZE` (the frozen node hit-area
 *  diameter), so the generated bezel sits flush against the node circle's
 *  edge like a coin rim (chunk 7, bible item 7). */
const SOCKET_RING_DISPLAY_SIZE = NODE_SIZE;

/**
 * v0.3 lattice layout (chunk D): every spot's pixel position is a linear
 * transform of its authored `SpotDef.grid` (col = progression depth,
 * row = lane; see `data/talentTree.ts`). Cols 0..6, rows -1..4 — chosen so
 * the whole lattice fits on the fixed 960×540 canvas with no scrolling
 * (the Alpha 0.2 hourglass's `WORLD_HEIGHT` scroll world is gone; journey
 * no longer wheels to reach deep nodes — see scripts/journey.mjs Stage B3).
 *
 * Spacing constants below are the only place row/col pixel gaps are tuned;
 * `layoutFromGrid` (tree/layout.ts) is the pure col/row → x/y transform.
 */
const GRID_LEFT = 90; // pixel x for grid col 0
const GRID_COL_WIDTH = 130;
const GRID_TOP = 176; // pixel y for grid row 0
const GRID_ROW_HEIGHT = 70;

const TOOLTIP_GAP = 8;
const TOOLTIP_DEPTH = 300;
const HUD_DEPTH = 200;
const TALENT_NAME_COLOR = '#e8d8c8';
const TALENT_DESC_COLOR = '#a89888';

/** Small corner "build glyph" preview (visible ahead of chunk E's run summary). */
const GLYPH_PREVIEW_X = 75;
const GLYPH_PREVIEW_Y = 96;
const GLYPH_PREVIEW_W = 100;
const GLYPH_PREVIEW_H = 60;
const GLYPH_PREVIEW_CELL = 8;

/** Bottom edge-state legend (handoff §Done-6: branch locks obvious at a glance). */
const LEGEND_Y = 508;
const LEGEND_SWATCH_LEN = 18;
const EDGE_LEGEND: { state: EdgeState; label: string }[] = [
  { state: 'traversed', label: 'Lit path' },
  { state: 'available', label: 'Open' },
  { state: 'inactive', label: 'Unreached' },
  { state: 'locked', label: 'Locked' },
];

/** Build a static spotId → grid map once from the authoritative config. */
const SPOT_GRID: Readonly<Record<string, GridPosition>> = Object.fromEntries(
  TALENT_TREE.spots
    .filter((spot): spot is SpotDef & { grid: GridPosition } => spot.grid !== undefined)
    .map((spot) => [spot.id, spot.grid]),
);

/** Fixed pixel positions for the live tree — grid-driven, no hand-tuned table. */
const TREE_POSITIONS: ReadonlyMap<string, SpotPosition> = layoutFromGrid(SPOT_GRID, {
  left: GRID_LEFT,
  top: GRID_TOP,
  colWidth: GRID_COL_WIDTH,
  rowHeight: GRID_ROW_HEIGHT,
});

function asContent(raw: unknown): TalentTreeContent | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Partial<TalentTreeContent>;
  if (typeof c.name !== 'string' || typeof c.description !== 'string' || !c.effect) return null;
  return c as TalentTreeContent;
}

function showingNode(spot: SpotView) {
  return spot.next ?? spot.owned[spot.owned.length - 1] ?? null;
}

function spotMetaInput(spot: SpotView) {
  const base = { chainLength: spot.chainLength, ownedCount: spot.owned.length };
  if (!spot.next) return base;
  return {
    ...base,
    nextCost: { currency: spot.next.cost.currency, amount: spot.next.cost.amount },
  };
}

/** Non-spell talent nodes: name/meta + description as a simple line stack. */
function spotTalentLines(spot: SpotView): TooltipLine[] {
  const node = showingNode(spot);
  if (!node) return [{ text: spot.id, color: TALENT_NAME_COLOR }];
  const content = asContent(node.content);
  const name = content?.name ?? node.id;
  const lines: TooltipLine[] = [
    { text: `${name}${spotMetaSuffix(spotMetaInput(spot))}`, color: TALENT_NAME_COLOR },
  ];
  const desc = content?.description ?? '';
  if (desc) lines.push({ text: desc, color: TALENT_DESC_COLOR });
  if (spot.next?.minLevel !== undefined) {
    lines.push({ text: `Requires level ${spot.next.minLevel}`, color: DANGER_COLOR });
  }
  return lines;
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
  private glyphPreviewContainer!: Phaser.GameObjects.Container;
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
    // Chunk 6 (bible item 6): fade in on scene entry.
    fadeInOnCreate(this);
    this.save = loadSave();
    this.treeState = treeStateFromLegacy(this.save.treeRanks, availableTalentPoints(this.save));
    this.armedSpotId = null;
    this.feedback = '';

    const { width, height } = this.scale;

    // v0.3 lattice fits the fixed 960×540 canvas — no scroll world needed
    // (Alpha 0.2's hourglass required scrolling to reach the crown row).
    this.add
      .rectangle(width / 2, height / 2, width, height, BG_COLOR)
      .setInteractive()
      .on('pointerdown', () => this.disarmAndRerenderIfNeeded());

    this.add
      .rectangle(width / 2, 40, 340, 76, 0x241a15, 0.96)
      .setStrokeStyle(1, BORDER_COLOR)
      .setDepth(HUD_DEPTH);
    this.add
      .text(width / 2, 14, 'TALENT TREE', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_MD,
        fontStyle: 'bold',
        color: '#fff2df',
        stroke: '#0a0605',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);
    this.headerText = this.add
      .text(width / 2, 36, '', { fontFamily: FONT, fontSize: FONT_SIZE_SM, color: ACCENT_COLOR })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);

    // Oath/relic strip stays pinned with the HUD so players can re-read their
    // run mods while browsing the tree.
    this.syncRunModsBar();

    this.statusText = this.add
      .text(width / 2, 52, '', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: TEXT_COLOR,
        align: 'center',
        wordWrap: { width: 700 },
      })
      .setOrigin(0.5, 0)
      .setDepth(HUD_DEPTH);

    this.feedbackText = this.add
      .text(width / 2, 66, '', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: DANGER_COLOR,
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setDepth(HUD_DEPTH);

    this.nodesContainer = this.add.container(0, 0);
    this.glyphPreviewContainer = this.add.container(0, 0).setDepth(HUD_DEPTH);

    this.tooltip = new SpellTooltip(this, { screenWidth: width, depth: TOOLTIP_DEPTH });

    this.buildBackButton(75, 26);
    this.buildGlyphPreviewChrome();
    this.buildEdgeLegend();
    this.render();
  }

  /** Static labels/frame for the build-glyph corner preview — drawn once. */
  private buildGlyphPreviewChrome(): void {
    // XS (8px), not the SM snap: this label sits 6px above the preview box's
    // top edge (60 vs GLYPH_PREVIEW_Y=96, H=60 ⇒ box top at 66) — SM would
    // grow into the box.
    this.add
      .text(GLYPH_PREVIEW_X, 60, 'BUILD', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_XS,
        color: DIM_COLOR,
      })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);
    this.add
      .rectangle(GLYPH_PREVIEW_X, GLYPH_PREVIEW_Y, GLYPH_PREVIEW_W, GLYPH_PREVIEW_H, 0x241a15, 0.9)
      .setStrokeStyle(1, BORDER_COLOR)
      .setDepth(HUD_DEPTH);
  }

  /** Static bottom legend mapping edge color/style to meaning — drawn once.
   *  Swatches stay plain `Graphics` lines (the shared color/weight/alpha
   *  come from `ui/treeSockets.ts` so the legend can never drift from the
   *  live edges): at 18px long they're too short for the textured strip to
   *  read as anything but noise — same "thin element stays unframed" call
   *  chunk 3/4 made for micro-bars/the settings slider track. */
  private buildEdgeLegend(): void {
    const graphics = this.add.graphics().setDepth(HUD_DEPTH);
    let x = 200;
    for (const entry of EDGE_LEGEND) {
      const color = edgeTint(entry.state);
      const width = edgeDisplayWeight(entry.state);
      graphics.lineStyle(width, color, 1);
      graphics.lineBetween(x, LEGEND_Y, x + LEGEND_SWATCH_LEN, LEGEND_Y);
      if (entry.state === 'locked') {
        graphics.lineBetween(x + 5, LEGEND_Y - 4, x + 13, LEGEND_Y + 4);
        graphics.lineBetween(x + 5, LEGEND_Y + 4, x + 13, LEGEND_Y - 4);
      }
      const label = this.add
        .text(x + LEGEND_SWATCH_LEN + 6, LEGEND_Y, entry.label, {
          fontFamily: FONT,
          fontSize: FONT_SIZE_SM,
          color: DIM_COLOR,
        })
        .setOrigin(0, 0.5)
        .setDepth(HUD_DEPTH);
      x += LEGEND_SWATCH_LEN + 10 + label.width + 24;
    }
  }

  private disarmAndRerenderIfNeeded(): void {
    if (this.armedSpotId === null && this.feedback === '') return;
    this.armedSpotId = null;
    this.feedback = '';
    this.render();
  }

  private armMessage(): string {
    if (this.armedSpotId === null) return '';
    const treeView = view(TALENT_TREE, this.treeState, levelForXp(this.save.xp));
    const spot = treeView.spots.find((s) => s.id === this.armedSpotId);
    const content = spot?.next ? asContent(spot.next.content) : null;
    const name = content?.name ?? this.armedSpotId;
    return `${name}: CLICK AGAIN TO SWEAR — permanent, locks the other path`;
  }

  private render(): void {
    this.hideTooltip();
    this.nodesContainer.removeAll(true);
    const treeView = view(TALENT_TREE, this.treeState, levelForXp(this.save.xp));
    const available = treeView.wallet['talent'] ?? 0;
    this.headerText.setText(
      `Level ${levelForXp(this.save.xp)}   •   ${available} unplaced   •   ${allocatedTalentPoints(this.save)} placed`,
    );
    this.statusText.setText(this.armMessage());
    this.feedbackText.setText(this.feedback);

    this.renderEdges(treeView);

    for (const spot of treeView.spots) {
      const pos = TREE_POSITIONS.get(spot.id);
      if (!pos) continue;
      this.renderSpotBox(spot, pos);
    }

    this.renderGlyphPreview(treeView);
  }

  /**
   * Edge color/weight/decoration by `EdgeState` (`ui/treeSockets.ts`'s
   * `edgeTint`/`edgeDisplayWeight`/`edgeAlpha`). Traversed/available/the
   * locked segments draw as a rotated, length-stretched edge-groove strip
   * (`drawEdgeStrip`) tinted per state; `inactive` stays a plain thin
   * `Graphics` line (bible §5 judgment call — a textured line at 1px reads
   * as noise, not detail, matching chunk 3/4's precedent for very thin
   * elements). Any state falls back to the original flat line if the strip
   * texture isn't loaded. Traversed (the lit path) draws last so it stays
   * visible over crossing dim/locked lines; the locked dead-branch X mark
   * draws in a final pass over everything so it's never obscured by a
   * later-drawn strip. */
  private renderEdges(treeView: TreeView): void {
    const graphics = this.add.graphics();
    this.nodesContainer.add(graphics);

    const drawOrder: EdgeState[] = ['inactive', 'available', 'locked', 'traversed'];
    const lockedMidpoints: SpotPosition[] = [];
    for (const state of drawOrder) {
      for (const edge of treeView.edges) {
        if (edge.state !== state) continue;
        const fromPos = TREE_POSITIONS.get(edge.fromSpotId);
        const toPos = TREE_POSITIONS.get(edge.toSpotId);
        if (!fromPos || !toPos) continue;
        this.drawEdgeLine(graphics, state, fromPos, toPos);
        if (state === 'locked') {
          lockedMidpoints.push({ x: (fromPos.x + toPos.x) / 2, y: (fromPos.y + toPos.y) / 2 });
        }
      }
    }

    if (lockedMidpoints.length > 0) this.drawLockedMarks(lockedMidpoints);
  }

  /** Draws one edge's line/strip (no dead-branch decoration — see
   *  `drawLockedMarks` for the X marks, drawn in a separate final pass). */
  private drawEdgeLine(
    graphics: Phaser.GameObjects.Graphics,
    state: EdgeState,
    fromPos: SpotPosition,
    toPos: SpotPosition,
  ): void {
    if (!edgeUsesTexturedStrip(state)) {
      graphics.lineStyle(edgeDisplayWeight(state), edgeTint(state), edgeAlpha(state));
      graphics.lineBetween(fromPos.x, fromPos.y, toPos.x, toPos.y);
      return;
    }
    if (state === 'locked') {
      this.drawLockedSegments(graphics, fromPos, toPos);
      return;
    }
    const weight = edgeDisplayWeight(state);
    const tint = edgeTint(state);
    const alpha = edgeAlpha(state);
    const strip = drawEdgeStrip(this, this.nodesContainer, fromPos.x, fromPos.y, toPos.x, toPos.y, weight, tint, alpha);
    if (!strip) {
      graphics.lineStyle(weight, tint, alpha);
      graphics.lineBetween(fromPos.x, fromPos.y, toPos.x, toPos.y);
    }
  }

  /** Locked/destroyed edge: dark red groove strip, broken at the midpoint
   *  (a visible gap) so a dead branch reads as "clearly dead" rather than
   *  merely dim — the X mark itself is drawn later by `drawLockedMarks`. */
  private drawLockedSegments(
    graphics: Phaser.GameObjects.Graphics,
    fromPos: SpotPosition,
    toPos: SpotPosition,
  ): void {
    const midX = (fromPos.x + toPos.x) / 2;
    const midY = (fromPos.y + toPos.y) / 2;
    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const gap = 10;
    const nearX = midX - ux * gap;
    const nearY = midY - uy * gap;
    const farX = midX + ux * gap;
    const farY = midY + uy * gap;

    const weight = edgeDisplayWeight('locked');
    const tint = edgeTint('locked');
    const alpha = edgeAlpha('locked');

    const near = drawEdgeStrip(this, this.nodesContainer, fromPos.x, fromPos.y, nearX, nearY, weight, tint, alpha);
    const far = drawEdgeStrip(this, this.nodesContainer, farX, farY, toPos.x, toPos.y, weight, tint, alpha);
    if (!near || !far) {
      graphics.lineStyle(weight, tint, alpha);
      if (!near) graphics.lineBetween(fromPos.x, fromPos.y, nearX, nearY);
      if (!far) graphics.lineBetween(farX, farY, toPos.x, toPos.y);
    }
  }

  /** Final pass: draws every locked edge's midpoint X in one `Graphics`
   *  object added last, so the dead-branch cue always sits on top of every
   *  strip/line drawn this frame — the critical gameplay signal (bible §5:
   *  "don't lose it") can never end up obscured by draw-order accidents. */
  private drawLockedMarks(midpoints: readonly SpotPosition[]): void {
    const marks = this.add.graphics();
    this.nodesContainer.add(marks);
    marks.lineStyle(2, EDGE_LOCKED, 1);
    for (const { x, y } of midpoints) {
      marks.lineBetween(x - 6, y - 6, x + 6, y + 6);
      marks.lineBetween(x - 6, y + 6, x + 6, y - 6);
    }
  }

  private renderSpotBox(spot: SpotView, pos: SpotPosition): void {
    const isArmed = this.armedSpotId === spot.id;
    const purchasable = spot.status === 'affordable';
    const owned = spot.owned.length > 0;
    const visualState = socketVisualState(spot.status, owned, isArmed);

    let bgColor = NODE_BG_LOCKED;
    let borderColor = BORDER_COLOR;
    let alpha = 1;
    let glyphColor = DIM_COLOR;

    if (spot.status === 'exclusive-locked') {
      bgColor = NODE_BG_LOCKED;
      borderColor = EDGE_LOCKED;
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

    // Round node fill — glyph is the icon; name / cost / description live in
    // the hover tooltip. Added to the container immediately (not batched
    // into `extras` below) so the socket ring drawn right after it stacks
    // correctly on top; the ring supplies the border art when its texture is
    // loaded, so `bg`'s own stroke only fires as a fallback (mirrors
    // `ui/panels.ts`'s `Frame` — framed pieces skip the flat-rect stroke).
    const bg = this.add
      .circle(pos.x, pos.y, NODE_RADIUS, bgColor)
      .setAlpha(alpha)
      .setInteractive({ useHandCursor: purchasable })
      .setName(`treeNode:${spot.id}`);
    this.nodesContainer.add(bg);

    const ring = drawSocketRing(
      this,
      this.nodesContainer,
      pos.x,
      pos.y,
      SOCKET_RING_DISPLAY_SIZE,
      socketRingTint(visualState),
      alpha,
    );
    if (!ring) bg.setStrokeStyle(2, borderColor);

    bg.on('pointerover', () => this.showTooltip(spot, pos));
    bg.on('pointerout', () => this.hideTooltip());
    bg.on('pointerdown', () => this.onSpotClicked(spot));

    const node = showingNode(spot);
    const content = node ? asContent(node.content) : null;
    const glyph = content ? glyphChar(content) : glyphChar({ id: node?.id ?? spot.id });
    const glyphText = this.add
      .text(pos.x, pos.y - (spot.chainLength > 1 ? 2 : 0), glyph, {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        fontStyle: 'bold',
        color: glyphColor,
        stroke: '#0a0605',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setAlpha(alpha);
    this.nodesContainer.add(glyphText);

    const extras: Phaser.GameObjects.GameObject[] = [];

    // Rank pips for multi-rank spots (replaces on-node cost/rank text).
    if (spot.chainLength > 1) {
      const pipY = pos.y + NODE_RADIUS - 8;
      const totalW = (spot.chainLength - 1) * 7;
      for (let i = 0; i < spot.chainLength; i++) {
        const filled = i < spot.owned.length;
        const pip = this.add
          .circle(pos.x - totalW / 2 + i * 7, pipY, 3, filled ? OWNED_COLOR_HEX : 0x5a4a3a)
          .setStrokeStyle(1, BORDER_COLOR)
          .setAlpha(alpha);
        extras.push(pip);
      }
    } else if (spot.status === 'exclusive-locked') {
      // XS (8px), not SM: this mark sits right at the node edge (r=20,
      // GRID_ROW_HEIGHT=70 between rows) alongside pips/the level tag below —
      // SM would start crowding neighboring on-node annotations.
      const lockMark = this.add
        .text(pos.x, pos.y + 11, '×', {
          fontFamily: FONT,
          fontSize: FONT_SIZE_XS,
          color: DANGER_COLOR,
        })
        .setOrigin(0.5)
        .setAlpha(alpha);
      extras.push(lockMark);
    } else if (purchasable && spot.next) {
      // Tiny affordability tick — rank capacity lives in the tooltip.
      const tick = this.add
        .circle(pos.x + NODE_RADIUS - 5, pos.y - NODE_RADIUS + 5, 4, ACCENT_HEX)
        .setStrokeStyle(1, BORDER_COLOR)
        .setAlpha(alpha);
      extras.push(tick);
    }

    // Level-gated crowns (§Done-8): show the requirement until it's met, in
    // addition to reading `locked`/`unaffordable` like any other gate.
    if (spot.next?.minLevel !== undefined && spot.status !== 'complete') {
      const levelLocked = levelForXp(this.save.xp) < spot.next.minLevel;
      // XS (8px), not SM: sits just below the node (pos.y + NODE_RADIUS + 9)
      // with only GRID_ROW_HEIGHT=70 between lattice rows — SM risks
      // crowding the next row's node.
      const tag = this.add
        .text(pos.x, pos.y + NODE_RADIUS + 9, `Lv ${spot.next.minLevel}`, {
          fontFamily: FONT,
          fontSize: FONT_SIZE_XS,
          color: levelLocked ? DANGER_COLOR : DIM_COLOR,
        })
        .setOrigin(0.5)
        .setAlpha(alpha);
      extras.push(tag);
    }

    this.nodesContainer.add(extras);
  }

  /** Redraws the "lit path" build-glyph preview from currently owned nodes. */
  private renderGlyphPreview(treeView: TreeView): void {
    this.glyphPreviewContainer.removeAll(true);
    const glyph = buildGlyphFromTree(TALENT_TREE, new Set(treeView.ownedNodeIds));
    const drawn = drawBuildGlyph(this, glyph, {
      x: GLYPH_PREVIEW_X,
      y: GLYPH_PREVIEW_Y,
      cell: GLYPH_PREVIEW_CELL,
      color: EDGE_TRAVERSED,
    });
    this.glyphPreviewContainer.add(drawn);
  }

  /**
   * Shows the node-anchored tooltip above the node (screen space — the
   * lattice no longer scrolls, so no camera offset math is needed).
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
              eyebrow: grantSpellEyebrow(spotMetaInput(spot), content.name, grantedSpell.name),
              description: content.description,
            }),
          )
        : this.tooltip.fillLines(spotTalentLines(spot));

    const canvasWidth = this.scale.width;
    const canvasHeight = this.scale.height;

    const x = Phaser.Math.Clamp(pos.x - size.width / 2, 0, Math.max(0, canvasWidth - size.width));

    const above = pos.y - NODE_SIZE / 2 - TOOLTIP_GAP - size.height;
    const y =
      above >= 0
        ? above
        : Phaser.Math.Clamp(pos.y + NODE_SIZE / 2 + TOOLTIP_GAP, 0, canvasHeight - size.height);

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
    } else if (spot.status === 'locked' && spot.next?.minLevel !== undefined) {
      this.feedback = `Requires level ${spot.next.minLevel}`;
    } else if (spot.status === 'locked') {
      this.feedback = 'Prerequisites not met';
    } else {
      this.feedback = '';
    }

    if (wasArmed || this.feedback) this.render();
  }

  private tryPurchase(spotId: string): void {
    const before = new Set(ownedSpellsFromSave(this.save).map((s) => s.id));
    const result = update(TALENT_TREE, this.treeState, {
      type: 'purchase',
      spotId,
      level: levelForXp(this.save.xp),
    });
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
      depth: 250,
    });
  }

  private buildBackButton(x: number, y: number): void {
    const rect = this.add
      .rectangle(x, y, 100, 34, BUTTON_COLOR)
      .setStrokeStyle(2, BORDER_COLOR)
      .setInteractive({ useHandCursor: true })
      .setDepth(HUD_DEPTH)
      .setName('treeBack');
    this.add
      .text(x, y, 'Back', { fontFamily: FONT, fontSize: FONT_SIZE_SM, color: TEXT_COLOR })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);
    rect.on('pointerdown', () => fadeToScene(this, SceneKeys.Hub));
  }
}
