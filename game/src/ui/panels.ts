/**
 * Shared meta-scene panel/button/banner kit (bible item 4, chunk 4 of
 * docs/ui-theme-handoff.md) — de-flattens Hub/Tutorial/Loadout/Relic/Settings
 * and the combat result overlay + wave banner. Extends chunk 3's
 * iron-and-ember frame vocabulary (`ui/spellSprites.ts`): a manual nine-slice
 * (4 corner Images + 4 stretched edge Images + a flat-color center fill),
 * never Phaser's `NineSlice` GameObject (WebGL-only — see the chunk-3 ledger
 * "Why the tooltip panel is NOT a true Phaser NineSlice", same reasoning
 * applies here). Two sizes ('sm' for compact rows/bars, 'lg' for tall
 * content panels) cover every surface this chunk touches — see
 * artifacts/pixellab-4/README.md for why corner art is code-drawn rather
 * than a PixelLab crop (illegible mush below ~12px, same finding as chunk
 * 3's tooltip corner) and why panel/button/banner share one frame kit
 * (a from-scratch "panel" generation drifted off-palette; the accepted
 * button-frame generation's edge band covers all three surfaces).
 *
 * Integration pattern (mirrors chunk 3's SpellButton architecture): scenes
 * keep creating their own interactive hit-rect (`this.add.rectangle(...)
 * .setInteractive().setName(...)`) unchanged — journey names and hit areas
 * never move. Pass that rect as `hitRect` and this module hides its flat
 * fill/stroke once the frame textures are loaded, leaving the original
 * flat-rect look as a graceful fallback when textures are missing (mirrors
 * `runModsBar.ts`'s `scene.textures.exists()` convention).
 */

import Phaser from 'phaser';
import { PALETTE_NUM } from './theme';

export type FrameSize = 'sm' | 'lg';
export type FrameState = 'normal' | 'hover' | 'disabled' | 'current';

/** Corner/edge native art-px size per {@link FrameSize} (2× at display size —
 *  density rule). 'sm' fits compact rows (hub notices 28px tall, meta
 *  buttons, loadout slots/picker rows); 'lg' fits tall content panels
 *  (result overlay, relic cards, tutorial copy panel, settings panel). */
const CORNER_NATIVE: Record<FrameSize, number> = { sm: 6, lg: 12 };
const EDGE_THICKNESS_NATIVE: Record<FrameSize, number> = { sm: 6, lg: 12 };

const CORNER_TEXTURE_KEY: Record<FrameSize, string> = {
  sm: 'ui-panel-corner-sm',
  lg: 'ui-panel-corner-lg',
};
const CORNER_TEXTURE_URL: Record<FrameSize, string> = {
  sm: 'assets/ui/panels/frame-corner-sm.png',
  lg: 'assets/ui/panels/frame-corner-lg.png',
};
const EDGE_TEXTURE_KEY: Record<FrameSize, string> = {
  sm: 'ui-panel-edge-sm',
  lg: 'ui-panel-edge-lg',
};
const EDGE_TEXTURE_URL: Record<FrameSize, string> = {
  sm: 'assets/ui/panels/frame-edge-sm.png',
  lg: 'assets/ui/panels/frame-edge-lg.png',
};

/** Dim factor applied to the whole frame in the 'disabled' state (kit-local —
 *  distinct from combat's BUTTON_DISABLED_ALPHA in spellBar.ts, which is
 *  tuned for the always-visible spell bar; meta-scene chrome reads fine a
 *  little brighter). */
const DISABLED_ALPHA = 0.4;

/** Extra outline width (screen px) drawn around a 'current'/'hover' frame's bounds —
 *  an overlay instead of a `setStrokeStyle` call so it survives regardless of frame tint. */
const ACCENT_OUTLINE_WIDTH = 3;

// ---- pure helpers (colocated panels.test.ts covers these) -----------------

/** Center-fill color for a given state; only 'hover' overrides the caller's base color. */
export function fillColorForState(state: FrameState, baseColor: number): number {
  return state === 'hover' ? PALETTE_NUM.panelLight : baseColor;
}

/** Whole-frame alpha for a given state; only 'disabled' dims. */
export function alphaForState(state: FrameState): number {
  return state === 'disabled' ? DISABLED_ALPHA : 1;
}

/** Whether a state shows the extra accent outline (current's gold Hub convention,
 *  or hover's caller-supplied accent — e.g. RelicScene's per-relic role color). */
export function showsAccentOutline(state: FrameState): boolean {
  return state === 'current' || state === 'hover';
}

/** Outline color for a given state — 'current' is always gold (the Hub CURRENT convention
 *  must survive regardless of what a caller passes); 'hover' uses the caller's accent color,
 *  falling back to the same gold. */
export function outlineColorForState(state: FrameState, accentColor: number): number {
  return state === 'current' ? PALETTE_NUM.gold : accentColor;
}

/** Stretched edge length given the panel's full length and the corner's display size on each end. */
export function edgeDisplayLength(totalLength: number, cornerDisplay: number): number {
  return Math.max(0, totalLength - 2 * cornerDisplay);
}

export interface FrameOptions {
  /** Corner/edge art size — 'lg' (default) for tall content panels, 'sm' for compact rows. */
  size?: FrameSize;
  /** Center fill color (PALETTE_NUM hex). Default PALETTE_NUM.panel. */
  fillColor?: number;
  /** Center fill alpha — e.g. the wave banner's semi-transparent backing. Default 1. */
  fillAlpha?: number;
  /** Initial state. Default 'normal'. */
  state?: FrameState;
  /** Depth of the whole frame (fill sits at `depth`, border pieces on top). Default 0. */
  depth?: number;
  /** Fallback stroke color/width drawn directly on the fill rectangle when the frame
   *  textures aren't loaded (no chrome pieces to draw instead). Defaults match the flat-rect
   *  look every meta scene already used: PALETTE_NUM.borderDark, width 2. */
  borderColor?: number;
  borderWidth?: number;
  /** Accent color for the 'hover' state's outline (e.g. RelicScene's per-relic role color).
   *  Default PALETTE_NUM.gold. Has no effect on 'current', which is always gold. */
  accentColor?: number;
  /** The scene's own interactive hit-rect for this surface (unchanged name/position/size —
   *  journey keeps resolving it). This module fully owns the drawn look once wrapped: the
   *  hit-rect's own fill/stroke are always hidden (Frame's fill rectangle carries the fallback
   *  border stroke instead), so there's no risk of stray `pointerover`-style fill/stroke
   *  mutations on the hit-rect showing through on top of the frame. Use {@link Frame.setState}
   *  for hover/current feedback instead of touching the hit-rect directly. */
  hitRect?: Phaser.GameObjects.Rectangle;
}

/** A drawn nine-slice frame: flat-color fill + code-drawn corner brackets + stretched
 *  metal edge strips, laid out fresh on every `setSize`/`setPosition` call. */
export class Frame {
  readonly container: Phaser.GameObjects.Container;

  private readonly scene: Phaser.Scene;
  private readonly size: FrameSize;
  private readonly framed: boolean;
  private readonly hitRect: Phaser.GameObjects.Rectangle | undefined;

  private w: number;
  private h: number;
  private baseFillColor: number;
  private fillAlpha: number;
  private state: FrameState;
  private readonly borderColor: number;
  private readonly borderWidth: number;
  private readonly accentColor: number;

  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly corners: Phaser.GameObjects.Image[] = [];
  private readonly edges: Phaser.GameObjects.Image[] = [];
  private accentOutline: Phaser.GameObjects.Rectangle | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, opts: FrameOptions = {}) {
    this.scene = scene;
    this.w = w;
    this.h = h;
    this.size = opts.size ?? 'lg';
    this.baseFillColor = opts.fillColor ?? PALETTE_NUM.panel;
    this.fillAlpha = opts.fillAlpha ?? 1;
    this.state = opts.state ?? 'normal';
    this.borderColor = opts.borderColor ?? PALETTE_NUM.borderDark;
    this.borderWidth = opts.borderWidth ?? 2;
    this.accentColor = opts.accentColor ?? PALETTE_NUM.gold;
    this.hitRect = opts.hitRect;
    this.framed =
      scene.textures.exists(CORNER_TEXTURE_KEY[this.size]) && scene.textures.exists(EDGE_TEXTURE_KEY[this.size]);

    this.fill = scene.add.rectangle(0, 0, w, h, fillColorForState(this.state, this.baseFillColor), this.fillAlpha);
    this.container = scene.add.container(x, y, [this.fill]);
    this.container.setDepth(opts.depth ?? 0);

    if (this.framed) {
      // 4 stretched edge Images (top/bottom/left/right) + 4 corner Images
      // (one texture, flipX/flipY reused for all four — same trick as
      // chunk 3's tooltip-corner.png).
      for (let i = 0; i < 4; i++) {
        const edge = scene.add.image(0, 0, EDGE_TEXTURE_KEY[this.size]);
        this.edges.push(edge);
        this.container.add(edge);
      }
      for (let i = 0; i < 4; i++) {
        const corner = scene.add.image(0, 0, CORNER_TEXTURE_KEY[this.size]);
        this.corners.push(corner);
        this.container.add(corner);
      }
    }
    // The fill rectangle always carries the fallback stroke when unframed
    // (see `layout()`), so a wrapped hit-rect is redundant either way —
    // hide it unconditionally rather than branching on `framed` (avoids a
    // stray `pointerover`-style fill/stroke mutation on the hit-rect ever
    // rendering on top of this frame; see `hitRect` doc above).
    if (this.hitRect) {
      this.hitRect.setFillStyle(0x000000, 0).setStrokeStyle(0);
    }

    this.layout();
    this.applyState();
  }

  /** Repositions/rescales every piece for the current `w`/`h` — called on construction and `setSize`. */
  private layout(): void {
    this.fill.setSize(this.w, this.h);
    // Fallback border: only when there's no chrome to draw instead.
    this.fill.setStrokeStyle(this.framed ? 0 : this.borderWidth, this.borderColor);

    if (!this.framed) return;

    const cornerNative = CORNER_NATIVE[this.size];
    const edgeNative = EDGE_THICKNESS_NATIVE[this.size];
    const cornerDisplay = cornerNative * 2;
    const edgeDisplay = edgeNative * 2;

    const tl = this.corners[0]!;
    const tr = this.corners[1]!;
    const bl = this.corners[2]!;
    const br = this.corners[3]!;
    tl.setDisplaySize(cornerDisplay, cornerDisplay).setFlipX(false).setFlipY(false);
    tl.setPosition(-this.w / 2 + cornerDisplay / 2, -this.h / 2 + cornerDisplay / 2);
    tr.setDisplaySize(cornerDisplay, cornerDisplay).setFlipX(true).setFlipY(false);
    tr.setPosition(this.w / 2 - cornerDisplay / 2, -this.h / 2 + cornerDisplay / 2);
    bl.setDisplaySize(cornerDisplay, cornerDisplay).setFlipX(false).setFlipY(true);
    bl.setPosition(-this.w / 2 + cornerDisplay / 2, this.h / 2 - cornerDisplay / 2);
    br.setDisplaySize(cornerDisplay, cornerDisplay).setFlipX(true).setFlipY(true);
    br.setPosition(this.w / 2 - cornerDisplay / 2, this.h / 2 - cornerDisplay / 2);

    const horizontalLen = edgeDisplayLength(this.w, cornerDisplay);
    const verticalLen = edgeDisplayLength(this.h, cornerDisplay);

    const top = this.edges[0]!;
    const bottom = this.edges[1]!;
    const left = this.edges[2]!;
    const right = this.edges[3]!;
    top.setRotation(0).setFlipX(false).setFlipY(false).setDisplaySize(horizontalLen, edgeDisplay);
    top.setPosition(0, -this.h / 2 + edgeDisplay / 2);
    bottom.setRotation(0).setFlipX(false).setFlipY(true).setDisplaySize(horizontalLen, edgeDisplay);
    bottom.setPosition(0, this.h / 2 - edgeDisplay / 2);
    left.setRotation(Math.PI / 2).setFlipX(false).setFlipY(false).setDisplaySize(verticalLen, edgeDisplay);
    left.setPosition(-this.w / 2 + edgeDisplay / 2, 0);
    right.setRotation(Math.PI / 2).setFlipX(true).setFlipY(false).setDisplaySize(verticalLen, edgeDisplay);
    right.setPosition(this.w / 2 - edgeDisplay / 2, 0);

    if (this.accentOutline) this.layoutAccentOutline();
  }

  private layoutAccentOutline(): void {
    this.accentOutline?.setSize(this.w + ACCENT_OUTLINE_WIDTH * 2, this.h + ACCENT_OUTLINE_WIDTH * 2);
  }

  private applyState(): void {
    this.fill.setFillStyle(fillColorForState(this.state, this.baseFillColor), this.fillAlpha);
    this.container.setAlpha(alphaForState(this.state));

    if (showsAccentOutline(this.state)) {
      if (!this.accentOutline) {
        this.accentOutline = this.scene.add
          .rectangle(0, 0, this.w + ACCENT_OUTLINE_WIDTH * 2, this.h + ACCENT_OUTLINE_WIDTH * 2)
          .setFillStyle(0x000000, 0);
        this.container.add(this.accentOutline);
      }
      this.accentOutline.setStrokeStyle(ACCENT_OUTLINE_WIDTH, outlineColorForState(this.state, this.accentColor));
      this.accentOutline.setVisible(true);
    } else {
      this.accentOutline?.setVisible(false);
    }
  }

  /** normal / hover / disabled / current — see module doc. Safe to call every frame; only
   *  touches display properties (no re-layout unless the state's outline is being created). */
  setState(state: FrameState): void {
    this.state = state;
    this.applyState();
  }

  setFillColor(color: number): void {
    this.baseFillColor = color;
    this.applyState();
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  setSize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.layout();
  }

  setDepth(depth: number): void {
    this.container.setDepth(depth);
  }

  setAlpha(alpha: number): void {
    this.container.setAlpha(alpha * alphaForState(this.state));
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  destroy(): void {
    this.container.destroy();
  }
}

/** Large framed panel — result overlay, relic cards, tutorial copy panel, settings panel,
 *  hub stats block. Defaults to the 'lg' frame size (tall content panels); pass `size: 'sm'`
 *  for a shorter panel (e.g. a hub notice bar). */
export function addPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, opts: FrameOptions = {}): Frame {
  return new Frame(scene, x, y, w, h, { size: 'lg', ...opts });
}

/** Framed button/row — hub meta + dungeon buttons, loadout slots/picker rows/back,
 *  settings back, combat Return. Defaults to the 'sm' frame size. */
export function addButton(scene: Phaser.Scene, x: number, y: number, w: number, h: number, opts: FrameOptions = {}): Frame {
  return new Frame(scene, x, y, w, h, { size: 'sm', ...opts });
}

/** Framed header strip — wave banner, "Choose a Relic" header, hub title strip.
 *  Defaults to the 'sm' frame size (banners are short). */
export function addBanner(scene: Phaser.Scene, x: number, y: number, w: number, h: number, opts: FrameOptions = {}): Frame {
  return new Frame(scene, x, y, w, h, { size: 'sm', ...opts });
}

/** One entry per frame-kit texture BootScene must preload. */
export interface PanelKitTexture {
  readonly key: string;
  readonly url: string;
}

/** Every corner/edge texture (both sizes) this chunk ships — BootScene loops this once. */
export function panelKitTextures(): readonly PanelKitTexture[] {
  const sizes: FrameSize[] = ['sm', 'lg'];
  const textures: PanelKitTexture[] = [];
  for (const size of sizes) {
    textures.push({ key: CORNER_TEXTURE_KEY[size], url: CORNER_TEXTURE_URL[size] });
    textures.push({ key: EDGE_TEXTURE_KEY[size], url: EDGE_TEXTURE_URL[size] });
  }
  return textures;
}
