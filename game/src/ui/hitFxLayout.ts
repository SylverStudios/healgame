/**
 * Pure layout math for enemy hit VFX (Wave 6 / R2). No Phaser — presentation
 * callers (`arrowHitFx`, `combatFx.showZapImpact`, `unitSprite.spawnDamageFloat`)
 * pass in `Math.random()` samples so the numbers stay unit-testable while the
 * on-screen jitter stays lively.
 *
 * Stack order on an enemy (bottom→top): sprite → hurt/arrow burst (jittered) →
 * tiny arrow sink slide → damage number (near the body top, off-center, below
 * the HP bar) → HP bar above that.
 */

/** Max symmetric ± impact jitter (px) for hurt VFX so repeated hits don't stack perfectly. */
export const HIT_JITTER_MAX_PX = 6;

/**
 * Map two [0, 1) randoms to a symmetric ±`maxPx` jitter offset. Callers pass
 * `Math.random()`; kept pure so the mapping (range, symmetry) is testable.
 */
export function hitJitterOffset(
  r0: number,
  r1: number,
  maxPx: number = HIT_JITTER_MAX_PX,
): { dx: number; dy: number } {
  return {
    dx: (r0 * 2 - 1) * maxPx,
    dy: (r1 * 2 - 1) * maxPx,
  };
}

/** Rightward (into-the-body) distance the embedded arrow slides as it sinks. */
export const ARROW_SINK_SLIDE_PX = 5;
/** Duration of the arrow sink slide. */
export const ARROW_SINK_SLIDE_MS = 220;

/** How far below the body's top edge a damage number spawns (keeps it under the HP bar). */
export const DAMAGE_FLOAT_TOP_INSET_PX = 6;
/** Max horizontal off-center (px) for a damage number so it clears the centered hit burst. */
export const DAMAGE_FLOAT_X_JITTER_PX = 10;

/**
 * Container-local Y where a damage number spawns: just inside the top of the
 * body (below the HP bar, which sits at `-height/2 - HP_BAR_OFFSET_Y`).
 * Returned relative to the unit's home center (add `homeY`).
 */
export function damageFloatSpawnOffsetY(
  height: number,
  inset: number = DAMAGE_FLOAT_TOP_INSET_PX,
): number {
  return -height / 2 + inset;
}

/** Map one [0, 1) random to a symmetric ±`maxPx` horizontal off-center for a damage number. */
export function damageFloatXOffset(r: number, maxPx: number = DAMAGE_FLOAT_X_JITTER_PX): number {
  return (r * 2 - 1) * maxPx;
}
