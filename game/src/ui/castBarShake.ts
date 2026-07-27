/**
 * Boss cast/telegraph bar shake — intensity rises as the bar fills so early
 * wind-up stays subtle and late wind-up reads aggressive (Wave 3 / PR2 2A).
 * Pure math only; CombatScene applies the offset each frame.
 */

/** Clamp fill progress to [0, 1]. */
function clamp01(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t;
}

/**
 * Shake amplitude scale from fill progress (0 = empty / cast just started,
 * 1 = full / about to land). Squared so early is subtle and late is aggressive.
 */
export function castBarShakeIntensity(fillProgress: number): number {
  const t = clamp01(fillProgress);
  return t * t;
}

/** Peak pixel wander at full fill — small enough to read as jitter, not teleport. */
export const CAST_BAR_SHAKE_MAX_PX = 3;

/**
 * Pixel offset for the boss cast/telegraph bar.
 * @param fillProgress 0..1 where 1 = bar full (hit imminent)
 * @param phaseMs time-based phase for oscillation (e.g. scene elapsed ms)
 * @param maxAmplitudePx peak wander at full intensity (default {@link CAST_BAR_SHAKE_MAX_PX})
 */
export function castBarShakeOffset(
  fillProgress: number,
  phaseMs: number,
  maxAmplitudePx: number = CAST_BAR_SHAKE_MAX_PX,
): { dx: number; dy: number } {
  const amp = castBarShakeIntensity(fillProgress) * maxAmplitudePx;
  if (amp <= 0) return { dx: 0, dy: 0 };
  // Distinct frequencies so X/Y don't lock into a diagonal line.
  const dx = Math.round(Math.sin(phaseMs * 0.053) * amp);
  const dy = Math.round(Math.cos(phaseMs * 0.071) * amp);
  return { dx, dy };
}
