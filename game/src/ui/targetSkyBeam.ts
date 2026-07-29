/**
 * Heal-target sky-beam cue (Playtest Wave 4b / J13): a gold ring high above
 * the party unit with a light shaft fading out before the sprite crown.
 *
 * Pure layout + draw helpers — no Phaser imports (unit tests pin Y ordering
 * without a scene). Distinct from the crimson boss-focus reticle.
 */

/** Gold fill for the ring / shaft (matches former halo holy tone). */
export const SKY_BEAM_COLOR = 0xf2c14e;
/** Brighter rim stroke so the ring reads against ember battlefield haze. */
export const SKY_BEAM_RING_STROKE = 0xffe08a;
export const SKY_BEAM_RING_STROKE_WIDTH = 2;
export const SKY_BEAM_RING_STROKE_ALPHA = 0.95;
export const SKY_BEAM_RING_FILL_ALPHA = 0.28;
/** Soft shaft alpha at the ring; fades to 0 at shaft bottom. */
export const SKY_BEAM_SHAFT_TOP_ALPHA = 0.42;

/** Base ring oval; width also scales with body (~0.5×). */
export const SKY_BEAM_RING_WIDTH = 36;
export const SKY_BEAM_RING_HEIGHT = 14;
/** Gap between shaft fade-out and sprite crown (px, container space). */
export const SKY_BEAM_CROWN_CLEARANCE = 6;
/** Shaft half-width at the ring; tapers slightly toward the body. */
export const SKY_BEAM_SHAFT_HALF_WIDTH_TOP = 10;
export const SKY_BEAM_SHAFT_HALF_WIDTH_BOTTOM = 6;

export interface SkyBeamLayoutInput {
  /** Container-local Y of the HP bar center (negative = above body center). */
  hpBarY: number;
  /** Container-local Y of the sprite crown (top of body display). */
  crownY: number;
  /** Body display width — sizes the ring. */
  bodyWidth: number;
}

export interface SkyBeamLayout {
  /** Ring center Y — ≈ 2 × hpBarY (twice the HP-bar elevation). */
  ringY: number;
  /** Y where shaft alpha reaches ~0 — strictly above the crown. */
  shaftBottomY: number;
  ringWidth: number;
  ringHeight: number;
  shaftHalfWidthTop: number;
  shaftHalfWidthBottom: number;
}

/**
 * Container-local geometry for the sky beam.
 * Up is negative: ringY < hpBarY < shaftBottomY < crownY.
 */
export function skyBeamLayout(input: SkyBeamLayoutInput): SkyBeamLayout {
  const ringY = 2 * input.hpBarY;
  const shaftBottomY = input.crownY - SKY_BEAM_CROWN_CLEARANCE;
  const ringWidth = Math.max(SKY_BEAM_RING_WIDTH, Math.round(input.bodyWidth * 0.5));
  return {
    ringY,
    shaftBottomY,
    ringWidth,
    ringHeight: SKY_BEAM_RING_HEIGHT,
    shaftHalfWidthTop: SKY_BEAM_SHAFT_HALF_WIDTH_TOP,
    shaftHalfWidthBottom: SKY_BEAM_SHAFT_HALF_WIDTH_BOTTOM,
  };
}

/** True when ring sits above the HP bar and the shaft ends before the crown. */
export function skyBeamYOrderOk(
  layout: SkyBeamLayout,
  hpBarY: number,
  crownY: number,
): boolean {
  return (
    layout.ringY < hpBarY &&
    layout.shaftBottomY < crownY &&
    layout.ringY < layout.shaftBottomY
  );
}

/** Minimal draw surface — Phaser Graphics satisfies this. */
export interface SkyBeamGraphics {
  clear(): this;
  lineStyle(lineWidth: number, color: number, alpha?: number): this;
  strokeEllipse(x: number, y: number, width: number, height: number): this;
  fillStyle(color: number, alpha?: number): this;
  fillEllipse(x: number, y: number, width: number, height: number): this;
  fillTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): this;
}

/**
 * Paint the gold sky ring + fading shaft into `g` (local origin = container
 * origin; layout Ys are absolute in that space).
 *
 * Shaft is two overlapping triangles (a tapering quad) with stepped alpha
 * strips so it reads as light falling from the ring and dies before the crown.
 */
export function drawTargetSkyBeam(g: SkyBeamGraphics, layout: SkyBeamLayout): void {
  g.clear();

  const { ringY, shaftBottomY, ringWidth, ringHeight } = layout;
  const shaftHeight = shaftBottomY - ringY;
  if (shaftHeight <= 0) return;

  // Stacked translucent strips — Graphics has no per-vertex alpha on triangles
  // without fillGradientStyle (scene-coupled); strips keep this helper Phaser-free
  // while still fading to ~0 before the crown.
  const strips = 8;
  const topHalf = layout.shaftHalfWidthTop;
  const botHalf = layout.shaftHalfWidthBottom;
  for (let i = 0; i < strips; i++) {
    const t0 = i / strips;
    const t1 = (i + 1) / strips;
    const y0 = ringY + shaftHeight * t0;
    const y1 = ringY + shaftHeight * t1;
    const w0 = topHalf + (botHalf - topHalf) * t0;
    const w1 = topHalf + (botHalf - topHalf) * t1;
    // Mid-strip alpha: linear fade from top alpha → 0.
    const alpha = SKY_BEAM_SHAFT_TOP_ALPHA * (1 - (t0 + t1) / 2);
    g.fillStyle(SKY_BEAM_COLOR, alpha);
    // Trapezoid as two triangles.
    g.fillTriangle(-w0, y0, w0, y0, w1, y1);
    g.fillTriangle(-w0, y0, w1, y1, -w1, y1);
  }

  g.fillStyle(SKY_BEAM_COLOR, SKY_BEAM_RING_FILL_ALPHA);
  g.fillEllipse(0, ringY, ringWidth, ringHeight);
  g.lineStyle(SKY_BEAM_RING_STROKE_WIDTH, SKY_BEAM_RING_STROKE, SKY_BEAM_RING_STROKE_ALPHA);
  g.strokeEllipse(0, ringY, ringWidth, ringHeight);
}
