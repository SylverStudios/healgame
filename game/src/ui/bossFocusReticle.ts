/**
 * Giant boss-focus reticle + two red beady eyes drawn on the focused ally
 * during Tunnel Vision–class channels (Wave 3 / PR2 chunk 2B).
 *
 * Temp geometry only — Phaser Graphics, no image assets. Layout constants are
 * pure so tests can pin sizing without a scene.
 */

/** Outer ring radius — larger than a 64px party body so the brand occludes clearly. */
export const FOCUS_RETICLE_RADIUS = 46;
/** Crosshair arm half-length past the ring. */
export const FOCUS_RETICLE_ARM = 58;
/** Inner guide ring, fraction of outer radius. */
export const FOCUS_RETICLE_INNER_RATIO = 0.42;
export const FOCUS_RETICLE_COLOR = 0xc23b22;
export const FOCUS_RETICLE_LINE_WIDTH = 3;

/** Prominent red iris radius for each beady eye. */
export const FOCUS_EYE_RADIUS = 11;
/** Dark pupil radius. */
export const FOCUS_EYE_PUPIL_RADIUS = 4;
/** Horizontal distance between eye centers. */
export const FOCUS_EYE_SPACING = 28;
/** Eyes sit slightly above reticle center so they read as a stare. */
export const FOCUS_EYE_OFFSET_Y = -6;
export const FOCUS_EYE_COLOR = 0xff1a12;
export const FOCUS_EYE_PUPIL_COLOR = 0x1a0505;
/** Soft sclera ring so eyes pop on dark/ember backgrounds. */
export const FOCUS_EYE_SCLERA_COLOR = 0xffe8e0;
export const FOCUS_EYE_SCLERA_RADIUS = 14;

export const FOCUS_RETICLE_MIN_ALPHA = 0.4;
export const FOCUS_RETICLE_PULSE_MS = 420;

export interface FocusEyeCenters {
  leftX: number;
  rightX: number;
  y: number;
}

/** Pure layout: eye centers relative to reticle origin. */
export function focusEyeCenters(
  spacing: number = FOCUS_EYE_SPACING,
  offsetY: number = FOCUS_EYE_OFFSET_Y,
): FocusEyeCenters {
  const half = spacing / 2;
  return { leftX: -half, rightX: half, y: offsetY };
}

/** Minimal draw surface — Phaser Graphics satisfies this. */
export interface FocusReticleGraphics {
  clear(): this;
  lineStyle(lineWidth: number, color: number, alpha?: number): this;
  strokeCircle(x: number, y: number, radius: number): this;
  lineBetween(x1: number, y1: number, x2: number, y2: number): this;
  fillStyle(color: number, alpha?: number): this;
  fillCircle(x: number, y: number, radius: number): this;
}

/**
 * Paint the giant crimson reticle and two beady red eyes into `g`
 * (local origin = reticle center, typically the ally body center).
 */
export function drawBossFocusReticle(g: FocusReticleGraphics): void {
  g.clear();

  const r = FOCUS_RETICLE_RADIUS;
  const arm = FOCUS_RETICLE_ARM;
  const notch = 8;

  g.lineStyle(FOCUS_RETICLE_LINE_WIDTH, FOCUS_RETICLE_COLOR, 0.95);
  g.strokeCircle(0, 0, r);
  g.lineStyle(2, FOCUS_RETICLE_COLOR, 0.55);
  g.strokeCircle(0, 0, Math.round(r * FOCUS_RETICLE_INNER_RATIO));

  g.lineStyle(2, FOCUS_RETICLE_COLOR, 0.9);
  g.lineBetween(-arm, 0, -r + notch, 0);
  g.lineBetween(r - notch, 0, arm, 0);
  g.lineBetween(0, -arm, 0, -r + notch);
  g.lineBetween(0, r - notch, 0, arm);

  // Corner ticks so it reads as a targeting brand, not a plain circle.
  const tick = 10;
  const q = Math.round(r * 0.72);
  g.lineStyle(2, FOCUS_RETICLE_COLOR, 0.75);
  g.lineBetween(-q, -q, -q + tick, -q);
  g.lineBetween(-q, -q, -q, -q + tick);
  g.lineBetween(q, -q, q - tick, -q);
  g.lineBetween(q, -q, q, -q + tick);
  g.lineBetween(-q, q, -q + tick, q);
  g.lineBetween(-q, q, -q, q - tick);
  g.lineBetween(q, q, q - tick, q);
  g.lineBetween(q, q, q, q - tick);

  const eyes = focusEyeCenters();
  drawBeadyEye(g, eyes.leftX, eyes.y);
  drawBeadyEye(g, eyes.rightX, eyes.y);
}

function drawBeadyEye(g: FocusReticleGraphics, x: number, y: number): void {
  g.fillStyle(FOCUS_EYE_SCLERA_COLOR, 0.95);
  g.fillCircle(x, y, FOCUS_EYE_SCLERA_RADIUS);
  g.fillStyle(FOCUS_EYE_COLOR, 1);
  g.fillCircle(x, y, FOCUS_EYE_RADIUS);
  g.fillStyle(FOCUS_EYE_PUPIL_COLOR, 1);
  g.fillCircle(x, y, FOCUS_EYE_PUPIL_RADIUS);
  // Tiny highlight so the beads read glossy / alive.
  g.fillStyle(0xffffff, 0.85);
  g.fillCircle(x - 3, y - 3, 2);
}
