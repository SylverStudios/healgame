import type { EnemyAbilityDef } from '../content/types';

/** Verdant Rift boss mechanic — reuses tunnelVision (data-only). */
export const NEEDLE_GAZE = {
  id: 'needle-gaze',
  name: 'Needle Gaze',
  kind: 'tunnelVision',
  telegraphMs: 2_500,
  firstCastAtMs: 5_000,
  intervalMs: 24_000,
  channelMs: 8_000,
  tickMs: 1_000,
  damagePerTick: 2,
  visualKey: 'needle-gaze',
  // v0.3 chunk F: distinct from Tunnel Vision's 'glow' — a narrowing gaze rising to fixate.
  telegraph: 'raise',
} as const satisfies EnemyAbilityDef;
