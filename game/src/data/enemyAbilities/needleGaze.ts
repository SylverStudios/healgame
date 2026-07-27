import type { EnemyAbilityDef } from '../content/types';

/** Verdant Rift boss mechanic — reuses tunnelVision (data-only). */
export const NEEDLE_GAZE = {
  id: 'needle-gaze',
  name: 'Needle Gaze',
  kind: 'tunnelVision',
  // Wave 3 / PR2 2A: longer telegraph (~1.8×) + earlier first cast for readable
  // wind-up; PR3 lightly tightens cadence so Verdant stays above the Cinder tune.
  telegraphMs: 4_500,
  firstCastAtMs: 3_000,
  intervalMs: 18_000,
  channelMs: 9_000,
  tickMs: 1_000,
  damagePerTick: 2,
  visualKey: 'needle-gaze',
  // v0.3 chunk F: distinct from Tunnel Vision's 'glow' — a narrowing gaze rising to fixate.
  telegraph: 'raise',
} as const satisfies EnemyAbilityDef;
