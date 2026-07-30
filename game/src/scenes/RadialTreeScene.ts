/**
 * Radial talent wheel — Wave 5 Chunk 3.
 *
 * Polar / wheel layout: heal at centre + inner bonk ring + Ring-1 spokes
 * (radius 115) + Ring-2 spokes (radius 190). A/B choice spots open a
 * confirmation modal before committing via applyRadialPurchase.
 *
 * Interactive targets (setName) — see docs/semantic-targets.md:
 *   treeNode:<logicalId>   wheel socket for each display spot
 *   treeChoice:a           A option button in the modal
 *   treeChoice:b           B option button in the modal
 *   treeBack               back-to-Hub button
 */

import Phaser from 'phaser';
import { SceneKeys } from './keys';
import { loadSave, saveGame, type SaveData } from '../save/save';
import {
  FONT,
  FONT_SIZE_SM,
  FONT_SIZE_XS,
  PALETTE,
  PALETTE_NUM,
} from '../ui/theme';
import { SpellTooltip, type TooltipLine } from '../ui/spellTooltip';
import { fadeInOnCreate, fadeToScene } from '../ui/transitions';
import { levelForXp } from '../data/constants';
import { applyRadialPurchase, treeStateFromRadialSave } from '../data/radial/resolve';
import {
  RADIAL_TREE,
  RADIAL_CHOICE_TABLE,
  type RadialTreeContent,
  type RadialTreeEffect,
} from '../data/radial/tree';
import { radialSpellById } from '../data/radial/spells';
import { view, type SpotView, type TreeView } from '../tree';
import { EDGE_INACTIVE } from '../ui/treeSockets';

// ─── Layout constants ─────────────────────────────────────────────────────────

/** Wheel centre — slightly below canvas centre-y to leave room for the header. */
const WHEEL_CX = 480;
const WHEEL_CY = 285;
/** Inner ring: bonk, offset from centre so it doesn't crowd Ring-1 nodes. */
const R_INNER = 55;
/** Ring-1 spoke radius (mend / heal-s1 / big-heal / mend-s1). */
const R1 = 115;
/** Ring-2 spoke radius (offense / vowstrike-s1 / bonk-s1 / CDs / big-heal-s1 / heal-s2). */
const R2 = 190;
/** Ring-3 spoke radius (heal-s3 / offense-s2 / crown-wrath / crown-waters). */
const R3 = 255;
/** Circle node visual half-size — matches lattice TreeScene. */
const NODE_RADIUS = 20;
/** Gap between node edge and tooltip panel edge. */
const TOOLTIP_GAP = 8;

// ─── Z-layers ─────────────────────────────────────────────────────────────────

const HUD_DEPTH = 200;
const TOOLTIP_DEPTH = 300;
const MODAL_DEPTH = 500;
const MODAL_CONTENT_DEPTH = 501;

// ─── Theme aliases ────────────────────────────────────────────────────────────

const BG_COLOR = PALETTE_NUM.bg;
const NODE_BG_OWNED = 0x2a3a2a;
const NODE_BG_AFFORDABLE = PALETTE_NUM.panelLight;
const NODE_BG_LOCKED = PALETTE_NUM.panel;
const BORDER_DARK = PALETTE_NUM.borderDark;

const TEXT_COLOR: string = PALETTE.text;
const DIM_COLOR: string = PALETTE.dim;
const OWNED_COLOR: string = PALETTE.health;
const ACCENT_COLOR: string = PALETTE.gold;
const DANGER_COLOR: string = PALETTE.danger;

// ─── Display spot descriptor ──────────────────────────────────────────────────

/**
 * One visual socket on the wheel.
 *
 * Single spots:  concreteIds has 1 element — purchased directly.
 * A/B spots:     concreteIds has 2 elements (a, b order matches RADIAL_CHOICE_TABLE);
 *                rendered as one socket, opens a choice modal on click.
 */
interface DisplaySpot {
  /** Fragment used in `treeNode:<logicalId>`. Matches RADIAL_CHOICE_TABLE key for A/B spots. */
  logicalId: string;
  /** True when this is an A/B exclusive-pair; false for direct-purchase nodes. */
  isChoice: boolean;
  /** [concreteId] or [aConcreteId, bConcreteId]. */
  concreteIds: string[];
  /** Pre-computed pixel x (polar → cartesian). */
  x: number;
  /** Pre-computed pixel y (polar → cartesian). */
  y: number;
}

/** Convert polar to screen-cartesian. 0° = right, 90° = down. */
function polar(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: Math.round(cx + r * Math.cos(rad)), y: Math.round(cy + r * Math.sin(rad)) };
}

// Build the static wheel layout once at module load.
//
// Ability spokes share a polar angle so SPOKE_CHAINS draw as radial segments
// (not cross-ring chords). Ring radius still encodes band (R1 / R2 / R3).
const DISPLAY_SPOTS: readonly DisplaySpot[] = (() => {
  const spots: DisplaySpot[] = [];
  const p = (r: number, a: number) => polar(WHEEL_CX, WHEEL_CY, r, a);

  const add = (logicalId: string, isChoice: boolean, concreteIds: string[], pos: { x: number; y: number }) =>
    spots.push({ logicalId, isChoice, concreteIds, ...pos });

  // Centre — heal (hub of the Heal specialize spoke @ 0°)
  add('heal', false, ['heal'], { x: WHEEL_CX, y: WHEEL_CY });

  // Heal specialize spoke @ 0° (east): heal → heal-s1 → heal-s2 → heal-s3
  add('heal-s1', true, ['heal-s1-zealous', 'heal-s1-solemn'], p(R1, 0));
  add('heal-s2', true, ['heal-s2-fast', 'heal-s2-slow'], p(R2, 0));
  add('heal-s3', true, ['heal-s3-committed', 'heal-s3-thrifty'], p(R3, 0));

  // Mend spoke @ 270° (north): heal → mend → mend-s1
  add('mend', false, ['mend'], p(R1, 270));
  add('mend-s1', true, ['mend-s1-arming', 'mend-s1-battle'], p(R2, 270));

  // Big Heal spoke @ 90° (south): heal → big-heal → big-heal-s1
  add('big-heal', false, ['big-heal'], p(R1, 90));
  add('big-heal-s1', true, ['big-heal-s1-prepared', 'big-heal-s1-thrifty'], p(R2, 90));

  // Offense spoke @ 35° (ESE): spine + fork children on R3 (no same-ring chords)
  add('bonk', false, ['bonk'], p(R_INNER, 35));
  add('offense', true, ['vowstrike-entry', 'bonk-upgrade'], p(R2, 35));
  add('vowstrike-s1', true, ['vowstrike-s1-absolution', 'vowstrike-s1-reckoning'], p(R3, 15));
  add('bonk-s1', true, ['bonk-s1-mana', 'bonk-s1-blessed'], p(R3, 55));
  add('offense-s2', true, ['offense-s2-a', 'offense-s2-b'], p(R3, 35));

  // CD spokes — keep clear of the left ring-label column
  add('still-waters', false, ['still-waters'], p(R2, 145));
  add('crown-waters', false, ['crown-waters'], p(R3, 145));
  add('wrath', false, ['wrath'], p(R2, 200));
  add('crown-wrath', false, ['crown-wrath'], p(R3, 200));
  add('liturgy', false, ['liturgy'], p(R2, 235));

  return spots;
})();

/**
 * Along-spoke connector segments (display logicalIds).
 *
 * Chains related upgrades on the same ability path — not a cross-spoke
 * synergy web. Pair list is pinned here next to DISPLAY_SPOTS; layout
 * angles above keep each chain radial (forks only for offense A/B).
 *
 * Offense: bonk → offense → offense-s2 spine; vowstrike-s1 / bonk-s1 fork
 * outward on R3 from offense (no same-ring chords).
 */
export const SPOKE_CHAINS: readonly (readonly [string, string])[] = [
  // Hub roots — unlock spokes radiate from centre Heal
  ['heal', 'mend'],
  ['heal', 'big-heal'],
  ['heal', 'bonk'],
  // Mend spoke @ 270°
  ['mend', 'mend-s1'],
  // Heal specialization spoke @ 0°
  ['heal', 'heal-s1'],
  ['heal-s1', 'heal-s2'],
  ['heal-s2', 'heal-s3'],
  // Big Heal spoke @ 90°
  ['big-heal', 'big-heal-s1'],
  // Offense spoke @ 35°: main spine + outward A/B fork on R3
  ['bonk', 'offense'],
  ['offense', 'offense-s2'],
  ['offense', 'vowstrike-s1'],
  ['offense', 'bonk-s1'],
  // CD crowns
  ['wrath', 'crown-wrath'],
  ['still-waters', 'crown-waters'],
];

// ─── Display-state derivation ─────────────────────────────────────────────────

type DisplayStatus =
  | 'owned'         // at least one concrete id is in treeRanks
  | 'affordable'    // purchasable (single) or modal-eligible (A/B)
  | 'unaffordable'  // prereqs met, level met, but not enough points
  | 'level-locked'  // gated by minLevel; level not yet reached
  | 'locked'        // prerequisites not met
  | 'exclusive';    // rival node in the same exclusiveGroup already owned

interface DisplayState {
  status: DisplayStatus;
  /** Which concrete id is owned (if any). */
  ownedConcreteId: string | null;
  ownedContent: RadialTreeContent | null;
  /** Minimum level gate (if any) from the underlying next-node data. */
  minLevel: number | undefined;
  /** Glyph char rendered inside the socket circle. */
  glyphStr: string;
  /** Display name for feedback / tooltip title. */
  displayName: string;
  /** Lines shown in the hover tooltip. */
  tooltipLines: TooltipLine[];
}

function radialContent(nodeId: string): RadialTreeContent | null {
  const node = RADIAL_TREE.nodes.find((n) => n.id === nodeId);
  return node ? (node.content as RadialTreeContent) : null;
}

/** One-line stat summary for effects that grant / specialize spells. */
function effectStatLine(eff: RadialTreeEffect): string {
  if (eff.kind === 'grantSpell' || eff.kind === 'specializeSpell') {
    const sid = eff.kind === 'grantSpell' ? eff.spellId : eff.toId;
    const sp = radialSpellById(sid);
    if (!sp) return '';
    const p: string[] = [];
    if (sp.heal > 0) p.push(`Heal ${sp.heal}`);
    if ((sp.damage ?? 0) > 0) p.push(`Dmg ${sp.damage}`);
    if (sp.mana > 0) p.push(`Mana ${sp.mana}`);
    if (sp.castMs > 0) p.push(`${(sp.castMs / 1000).toFixed(1)}s`);
    return p.join('  ·  ');
  }
  if (eff.kind === 'grantCooldown') return 'Grants cooldown';
  return '';
}

function deriveDisplayState(ds: DisplaySpot, tv: TreeView, level: number): DisplayState {
  const spotById = new Map<string, SpotView>(tv.spots.map((s) => [s.id, s]));
  const ownedSet = new Set(tv.ownedNodeIds);

  // ── Owned check ──────────────────────────────────────────────────────────
  const ownedConcreteId = ds.concreteIds.find((id) => ownedSet.has(id)) ?? null;
  if (ownedConcreteId !== null) {
    const c = radialContent(ownedConcreteId);
    return {
      status: 'owned',
      ownedConcreteId,
      ownedContent: c,
      minLevel: undefined,
      glyphStr: c?.glyph ?? '✓',
      displayName: c?.name ?? ownedConcreteId,
      tooltipLines: [
        { text: `${c?.name ?? ownedConcreteId}  [owned]`, color: OWNED_COLOR },
        ...(c?.description ? [{ text: c.description, color: DIM_COLOR }] : []),
      ],
    };
  }

  // ── Aggregate underlying spot-view statuses ───────────────────────────────
  const svs = ds.concreteIds
    .map((id) => spotById.get(id))
    .filter((s): s is SpotView => s !== undefined);

  const statuses = svs.map((sv) => sv.status);

  // Level gate: take the minimum from all concrete next-nodes.
  const minLevel = svs.reduce<number | undefined>((acc, sv) => {
    const ml = sv.next?.minLevel;
    if (ml === undefined) return acc;
    return acc === undefined ? ml : Math.min(acc, ml);
  }, undefined);
  const isLevelLocked = minLevel !== undefined && level < minLevel;

  // ── Aggregate status ──────────────────────────────────────────────────────
  let status: DisplayStatus;
  if (statuses.length === 0) {
    status = 'locked';
  } else if (statuses.every((s) => s === 'exclusive-locked')) {
    status = 'exclusive';
  } else if (statuses.some((s) => s === 'affordable')) {
    status = 'affordable';
  } else if (statuses.some((s) => s === 'unaffordable')) {
    // Tree service returns 'locked' for level-locked nodes, not 'unaffordable'.
    // If we see 'unaffordable', level gate is already cleared.
    status = 'unaffordable';
  } else {
    // All statuses are 'locked' — could be prereq or level.
    status = isLevelLocked ? 'level-locked' : 'locked';
  }

  // ── Text / glyph ──────────────────────────────────────────────────────────
  const firstContent = ds.concreteIds[0] ? radialContent(ds.concreteIds[0]) : null;
  const choiceEntry = ds.isChoice ? (RADIAL_CHOICE_TABLE[ds.logicalId] ?? null) : null;

  let displayName: string;
  if (ds.isChoice && choiceEntry) {
    const nameA = radialContent(choiceEntry.a)?.name ?? choiceEntry.a;
    const nameB = radialContent(choiceEntry.b)?.name ?? choiceEntry.b;
    displayName = `${nameA} / ${nameB}`;
  } else {
    displayName = firstContent?.name ?? ds.logicalId;
  }

  // A/B unchosen sockets render "?" — single nodes render their own glyph.
  const glyphStr = ds.isChoice ? '?' : (firstContent?.glyph ?? '?');

  // ── Tooltip lines ──────────────────────────────────────────────────────────
  const lines: TooltipLine[] = [];
  if (ds.isChoice) {
    lines.push({ text: 'A/B Choice', color: ACCENT_COLOR });
    lines.push({ text: displayName, color: TEXT_COLOR });
    if (status === 'affordable') lines.push({ text: 'Click to choose', color: ACCENT_COLOR });
  } else {
    lines.push({ text: firstContent?.name ?? ds.logicalId, color: TEXT_COLOR });
    if (firstContent?.description) lines.push({ text: firstContent.description, color: DIM_COLOR });
    const stat = firstContent?.effects.map(effectStatLine).find((l) => l.length > 0);
    if (stat) lines.push({ text: stat, color: ACCENT_COLOR });
  }
  if (isLevelLocked && minLevel !== undefined) {
    lines.push({ text: `Requires level ${minLevel}`, color: DANGER_COLOR });
  } else if (minLevel !== undefined) {
    lines.push({ text: `Level ${minLevel}+`, color: DIM_COLOR });
  }
  if (status === 'unaffordable') lines.push({ text: 'Not enough talent points', color: DIM_COLOR });
  if (status === 'locked') lines.push({ text: 'Prerequisites not met', color: DIM_COLOR });
  if (status === 'exclusive') lines.push({ text: 'Exclusive — rival path taken', color: DANGER_COLOR });

  return {
    status,
    ownedConcreteId: null,
    ownedContent: null,
    minLevel,
    glyphStr,
    displayName,
    tooltipLines: lines,
  };
}

// ─── Scene ────────────────────────────────────────────────────────────────────

export class RadialTreeScene extends Phaser.Scene {
  private save!: SaveData;
  /** Container rebuilt on every renderWheel(). */
  private nodesContainer!: Phaser.GameObjects.Container;
  /** Modal overlay — children rebuilt on openChoiceModal(), cleared on dismiss. */
  private overlayContainer!: Phaser.GameObjects.Container;
  private headerText!: Phaser.GameObjects.Text;
  private feedbackText!: Phaser.GameObjects.Text;
  private tooltip!: SpellTooltip;
  private feedback = '';
  /** The logical spot id of the A/B node currently awaiting a modal choice. */
  private pendingChoiceId: string | null = null;

  constructor() {
    super(SceneKeys.RadialTree);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BG_COLOR);
    fadeInOnCreate(this);
    this.save = loadSave();

    const { width, height } = this.scale;
    const cx = width / 2;

    // ── Full-screen bg (absorbs clicks outside the modal to dismiss it) ───
    this.add
      .rectangle(cx, height / 2, width, height, BG_COLOR)
      .setInteractive()
      .on('pointerdown', () => this.dismissModal());

    // ── HUD header bar ────────────────────────────────────────────────────
    this.add
      .rectangle(cx, 35, 500, 54, 0x241a15, 0.96)
      .setStrokeStyle(1, BORDER_DARK)
      .setDepth(HUD_DEPTH);

    this.add
      .text(cx, 12, 'RADIAL TREE', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        fontStyle: 'bold',
        color: '#fff2df',
        stroke: '#0a0605',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);

    this.headerText = this.add
      .text(cx, 32, '', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_XS,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);

    this.feedbackText = this.add
      .text(cx, 50, '', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_XS,
        color: DANGER_COLOR,
      })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);

    // ── Back button (top-right, matching lattice TreeScene position) ──────
    const back = this.add
      .rectangle(width - 75, 26, 100, 34, PALETTE_NUM.panelLight)
      .setStrokeStyle(2, BORDER_DARK)
      .setInteractive({ useHandCursor: true })
      .setDepth(HUD_DEPTH)
      .setName('treeBack');
    this.add
      .text(width - 75, 26, 'Back', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: TEXT_COLOR,
      })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH + 1);
    back.on('pointerdown', () => fadeToScene(this, SceneKeys.Hub, {}));

    // ── Ring guide circles only (no centre→every-node rays — those fought
    // the along-spoke chains). Spoke segments below are the readable paths. ─
    const rings = this.add.graphics().setDepth(1);
    rings.lineStyle(1, BORDER_DARK, 0.22);
    rings.strokeCircle(WHEEL_CX, WHEEL_CY, R_INNER + NODE_RADIUS + 7);
    rings.strokeCircle(WHEEL_CX, WHEEL_CY, R1 + NODE_RADIUS + 9);
    rings.strokeCircle(WHEEL_CX, WHEEL_CY, R2 + NODE_RADIUS + 9);
    rings.strokeCircle(WHEEL_CX, WHEEL_CY, R3 + NODE_RADIUS + 9);

    // ── Along-spoke connector segments (required; explicit SPOKE_CHAINS) ──
    const spotByLogicalId = new Map(DISPLAY_SPOTS.map((s) => [s.logicalId, s]));
    const spokeGfx = this.add.graphics().setDepth(2);
    // Reuse lattice inactive edge tint; plain lineBetween for v1 (no strip).
    spokeGfx.lineStyle(2, EDGE_INACTIVE, 0.75);
    for (const [fromId, toId] of SPOKE_CHAINS) {
      const from = spotByLogicalId.get(fromId);
      const to = spotByLogicalId.get(toId);
      if (!from || !to) continue;
      spokeGfx.lineBetween(from.x, from.y, to.x, to.y);
    }

    // ── Ring labels (far left — clear of west CD crowns) ─────────────────
    const ringLabelX = 16;
    this.add
      .text(ringLabelX, WHEEL_CY - R1, 'Ring 1\nLv 1+', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_XS,
        color: DIM_COLOR,
        align: 'left',
      })
      .setOrigin(0, 0.5)
      .setDepth(HUD_DEPTH);
    this.add
      .text(ringLabelX, WHEEL_CY - R2, 'Ring 2\nLv 5+', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_XS,
        color: DIM_COLOR,
        align: 'left',
      })
      .setOrigin(0, 0.5)
      .setDepth(HUD_DEPTH);
    this.add
      .text(ringLabelX, WHEEL_CY - R3, 'Ring 3\nLv 10+', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_XS,
        color: DIM_COLOR,
        align: 'left',
      })
      .setOrigin(0, 0.5)
      .setDepth(HUD_DEPTH);

    // ── Node + overlay containers ─────────────────────────────────────────
    this.nodesContainer = this.add.container(0, 0).setDepth(10);
    this.overlayContainer = this.add
      .container(0, 0)
      .setDepth(MODAL_DEPTH)
      .setVisible(false);

    // ── Tooltip (single shared instance) ─────────────────────────────────
    this.tooltip = new SpellTooltip(this, {
      screenWidth: width,
      depth: TOOLTIP_DEPTH,
    });

    this.renderWheel();
  }

  // ─── Wheel rendering ────────────────────────────────────────────────────────

  private renderWheel(): void {
    this.nodesContainer.removeAll(true);
    this.hideTooltip();

    const level = levelForXp(this.save.xp);
    const treeState = treeStateFromRadialSave(this.save.treeRanks, this.save.xp);
    const tv = view(RADIAL_TREE, treeState, level);

    const available = tv.wallet['talent'] ?? 0;
    const placed = tv.ownedNodeIds.filter(
      (id) => id !== 'heal' && id !== 'bonk',
    ).length;
    this.headerText.setText(
      `Level ${level}  ·  ${available} pt${available !== 1 ? 's' : ''} available  ·  ${placed} placed`,
    );
    this.feedbackText.setText(this.feedback);

    for (const ds of DISPLAY_SPOTS) {
      const state = deriveDisplayState(ds, tv, level);
      this.renderNode(ds, state);
    }
  }

  private renderNode(ds: DisplaySpot, state: DisplayState): void {
    const { x, y } = ds;

    // ── Visual parameters ─────────────────────────────────────────────────
    let bgColor: number;
    let borderColor: number;
    let alpha = 1;
    let glyphColor: string;

    switch (state.status) {
      case 'owned':
        bgColor = NODE_BG_OWNED;
        borderColor = PALETTE_NUM.health;
        glyphColor = OWNED_COLOR;
        break;
      case 'affordable':
        bgColor = NODE_BG_AFFORDABLE;
        borderColor = PALETTE_NUM.gold;
        glyphColor = TEXT_COLOR;
        break;
      case 'exclusive':
        bgColor = NODE_BG_LOCKED;
        borderColor = PALETTE_NUM.danger;
        alpha = 0.4;
        glyphColor = DANGER_COLOR;
        break;
      case 'level-locked':
        bgColor = NODE_BG_LOCKED;
        borderColor = BORDER_DARK;
        alpha = 0.65;
        glyphColor = DANGER_COLOR;
        break;
      case 'unaffordable':
        bgColor = NODE_BG_LOCKED;
        borderColor = BORDER_DARK;
        alpha = 0.85;
        glyphColor = DIM_COLOR;
        break;
      default: // locked
        bgColor = NODE_BG_LOCKED;
        borderColor = BORDER_DARK;
        alpha = 0.55;
        glyphColor = DIM_COLOR;
    }

    // ── Circle node (the hit target) ──────────────────────────────────────
    const bg = this.add
      .circle(x, y, NODE_RADIUS, bgColor)
      .setAlpha(alpha)
      .setStrokeStyle(2, borderColor)
      .setInteractive({ useHandCursor: state.status === 'affordable' })
      .setName(`treeNode:${ds.logicalId}`);
    this.nodesContainer.add(bg);

    // ── Glyph text ────────────────────────────────────────────────────────
    const glyph = this.add
      .text(x, y, state.glyphStr, {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        fontStyle: 'bold',
        color: glyphColor,
        stroke: '#0a0605',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setAlpha(alpha);
    this.nodesContainer.add(glyph);

    // ── Level tag (below the node, when gated) ────────────────────────────
    if (state.minLevel !== undefined && state.status !== 'owned') {
      const tagColor =
        state.status === 'level-locked' ? DANGER_COLOR : DIM_COLOR;
      const tag = this.add
        .text(x, y + NODE_RADIUS + 2, `Lv${state.minLevel}`, {
          fontFamily: FONT,
          fontSize: FONT_SIZE_XS,
          color: tagColor,
        })
        .setOrigin(0.5, 0)
        .setAlpha(alpha);
      this.nodesContainer.add(tag);
    }

    // ── Gold affordability tick ───────────────────────────────────────────
    if (state.status === 'affordable') {
      const tick = this.add
        .circle(x + NODE_RADIUS - 5, y - NODE_RADIUS + 5, 4, PALETTE_NUM.gold)
        .setStrokeStyle(1, BORDER_DARK);
      this.nodesContainer.add(tick);
    }

    // ── Exclusive × mark ──────────────────────────────────────────────────
    if (state.status === 'exclusive') {
      const mark = this.add
        .text(x, y + 8, '×', {
          fontFamily: FONT,
          fontSize: FONT_SIZE_XS,
          color: DANGER_COLOR,
        })
        .setOrigin(0.5)
        .setAlpha(alpha);
      this.nodesContainer.add(mark);
    }

    // ── Pointer events ────────────────────────────────────────────────────
    bg.on('pointerover', () => this.showTooltip(state.tooltipLines, x, y));
    bg.on('pointerout', () => this.hideTooltip());
    bg.on('pointerdown', () => this.onNodeClicked(ds, state));
  }

  // ─── Node click handling ────────────────────────────────────────────────────

  private onNodeClicked(ds: DisplaySpot, state: DisplayState): void {
    if (state.status === 'owned') return;

    if (state.status !== 'affordable') {
      switch (state.status) {
        case 'unaffordable':
          this.setFeedback('Not enough talent points.');
          break;
        case 'level-locked':
          this.setFeedback(`Requires level ${state.minLevel ?? '?'}.`);
          break;
        case 'exclusive':
          this.setFeedback('Rival path already chosen.');
          break;
        default:
          this.setFeedback('Prerequisites not met.');
      }
      this.renderWheel();
      return;
    }

    if (ds.isChoice) {
      this.openChoiceModal(ds);
    } else {
      const spotId = ds.concreteIds[0];
      if (!spotId) return;
      const ok = applyRadialPurchase(this.save, spotId);
      if (ok) {
        saveGame(this.save);
        this.feedback = '';
      } else {
        this.setFeedback('Purchase failed.');
      }
      this.renderWheel();
    }
  }

  private setFeedback(msg: string): void {
    this.feedback = msg;
  }

  // ─── Tooltip helpers ─────────────────────────────────────────────────────────

  private showTooltip(lines: TooltipLine[], nodeX: number, nodeY: number): void {
    const size = this.tooltip.fillLines(lines);
    const { width: cw, height: ch } = this.scale;
    const tx = Phaser.Math.Clamp(
      nodeX - size.width / 2,
      0,
      Math.max(0, cw - size.width),
    );
    const above = nodeY - NODE_RADIUS - TOOLTIP_GAP - size.height;
    const ty =
      above >= 0
        ? above
        : Phaser.Math.Clamp(
            nodeY + NODE_RADIUS + TOOLTIP_GAP,
            0,
            ch - size.height,
          );
    this.tooltip.place(tx, ty);
  }

  private hideTooltip(): void {
    this.tooltip.hide();
  }

  // ─── A/B Choice modal ────────────────────────────────────────────────────────

  private openChoiceModal(ds: DisplaySpot): void {
    const choiceEntry = RADIAL_CHOICE_TABLE[ds.logicalId];
    if (!choiceEntry) {
      this.setFeedback('No choice data available.');
      this.renderWheel();
      return;
    }
    this.pendingChoiceId = ds.logicalId;
    this.hideTooltip();
    this.buildChoiceModal(ds.logicalId, choiceEntry.a, choiceEntry.b);
  }

  private buildChoiceModal(logicalId: string, aId: string, bId: string): void {
    this.overlayContainer.removeAll(true);
    this.overlayContainer.setVisible(true);

    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    // ── Dark full-screen backdrop ─────────────────────────────────────────
    this.overlayContainer.add(
      this.add
        .rectangle(cx, cy, width, height, 0x000000, 0.72)
        .setInteractive()
        .on('pointerdown', () => this.dismissModal()),
    );

    // ── Modal panel ───────────────────────────────────────────────────────
    const MW = 680;
    const MH = 310;
    this.overlayContainer.add(
      this.add
        .rectangle(cx, cy, MW, MH, PALETTE_NUM.panel)
        .setStrokeStyle(2, BORDER_DARK),
    );

    // ── Modal title ───────────────────────────────────────────────────────
    const titleLabel = logicalId
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    this.overlayContainer.add(
      this.add
        .text(cx, cy - MH / 2 + 18, `Choose: ${titleLabel}`, {
          fontFamily: FONT,
          fontSize: FONT_SIZE_SM,
          fontStyle: 'bold',
          color: ACCENT_COLOR,
        })
        .setOrigin(0.5)
        .setDepth(MODAL_CONTENT_DEPTH),
    );

    // ── Option A (left) ───────────────────────────────────────────────────
    this.buildOptionCard('a', cx - 170, cy + 10, radialContent(aId));

    // ── Option B (right) ──────────────────────────────────────────────────
    this.buildOptionCard('b', cx + 170, cy + 10, radialContent(bId));

    // ── Cancel hint ───────────────────────────────────────────────────────
    this.overlayContainer.add(
      this.add
        .text(cx, cy + MH / 2 - 14, 'Click outside to cancel', {
          fontFamily: FONT,
          fontSize: FONT_SIZE_XS,
          color: DIM_COLOR,
        })
        .setOrigin(0.5)
        .setDepth(MODAL_CONTENT_DEPTH),
    );
  }

  /**
   * Builds one A/B option card inside the modal.
   * The card rectangle itself is the clickable hit area (`treeChoice:a` / `treeChoice:b`).
   */
  private buildOptionCard(
    choice: 'a' | 'b',
    cx: number,
    cy: number,
    content: RadialTreeContent | null,
  ): void {
    const CW = 280;
    const CH = 200;
    const borderCol =
      choice === 'a' ? PALETTE_NUM.gold : PALETTE_NUM.health;
    const labelColor = choice === 'a' ? ACCENT_COLOR : OWNED_COLOR;

    // Hit rect — this is the named interactive target.
    const hitRect = this.add
      .rectangle(cx, cy, CW, CH, PALETTE_NUM.panelLight)
      .setStrokeStyle(2, borderCol)
      .setInteractive({ useHandCursor: true })
      .setDepth(MODAL_CONTENT_DEPTH)
      .setName(`treeChoice:${choice}`);
    this.overlayContainer.add(hitRect);

    hitRect.on('pointerdown', () => this.confirmChoice(choice));
    hitRect.on('pointerover', () =>
      hitRect.setStrokeStyle(3, borderCol),
    );
    hitRect.on('pointerout', () =>
      hitRect.setStrokeStyle(2, borderCol),
    );

    const top = cy - CH / 2 + 10;

    // ── "A" / "B" badge ───────────────────────────────────────────────────
    this.overlayContainer.add(
      this.add
        .text(cx, top, choice.toUpperCase(), {
          fontFamily: FONT,
          fontSize: FONT_SIZE_XS,
          fontStyle: 'bold',
          color: labelColor,
        })
        .setOrigin(0.5, 0)
        .setDepth(MODAL_CONTENT_DEPTH),
    );

    // ── Option name ───────────────────────────────────────────────────────
    this.overlayContainer.add(
      this.add
        .text(cx, top + 20, content?.name ?? (choice === 'a' ? 'Option A' : 'Option B'), {
          fontFamily: FONT,
          fontSize: FONT_SIZE_SM,
          fontStyle: 'bold',
          color: TEXT_COLOR,
          wordWrap: { width: CW - 20 },
          align: 'center',
        })
        .setOrigin(0.5, 0)
        .setDepth(MODAL_CONTENT_DEPTH),
    );

    // ── Description ───────────────────────────────────────────────────────
    if (content?.description) {
      this.overlayContainer.add(
        this.add
          .text(cx, top + 48, content.description, {
            fontFamily: FONT,
            fontSize: FONT_SIZE_XS,
            color: DIM_COLOR,
            wordWrap: { width: CW - 20 },
            align: 'center',
          })
          .setOrigin(0.5, 0)
          .setDepth(MODAL_CONTENT_DEPTH),
      );
    }

    // ── Stat line (first grant/specialize effect) ─────────────────────────
    const statLine =
      content?.effects.map(effectStatLine).find((l) => l.length > 0) ?? '';
    if (statLine) {
      this.overlayContainer.add(
        this.add
          .text(cx, cy + CH / 2 - 28, statLine, {
            fontFamily: FONT,
            fontSize: FONT_SIZE_XS,
            color: ACCENT_COLOR,
          })
          .setOrigin(0.5)
          .setDepth(MODAL_CONTENT_DEPTH),
      );
    }
  }

  private confirmChoice(choice: 'a' | 'b'): void {
    const spotId = this.pendingChoiceId;
    if (!spotId) return;

    const ok = applyRadialPurchase(this.save, spotId, choice);
    if (ok) {
      saveGame(this.save);
      this.feedback = '';
    } else {
      this.setFeedback(`Choice ${choice.toUpperCase()} not available.`);
    }
    this.dismissModal();
    this.renderWheel();
  }

  private dismissModal(): void {
    if (!this.overlayContainer.visible) return;
    this.pendingChoiceId = null;
    this.overlayContainer.setVisible(false);
    this.overlayContainer.removeAll(true);
  }
}
