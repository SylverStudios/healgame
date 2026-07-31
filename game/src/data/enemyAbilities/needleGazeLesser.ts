import type { EnemyAbilityDef } from '../content/types';

/**
 * Verdant Rift trash teach — lesser Needle Gaze. Same tunnelVision focus verb
 * as the Thorn Matriarch's greater (needleGaze.ts): a longer, readable
 * telegraph into a shorter channel ticking for half the boss damage, drilling
 * the "cover the fixated target" reaction before the matriarch's full gaze.
 *
 * v1 enemy mechanics chunk E4: stub magnitude (~50% intensity); E5 retunes.
 */
export const NEEDLE_GAZE_LESSER = {
  id: 'needle-gaze-lesser',
  name: 'Lesser Needle Gaze',
  kind: 'tunnelVision',
  telegraphMs: 6_000,
  firstCastAtMs: 3_000,
  intervalMs: 12_000,
  channelMs: 5_000,
  tickMs: 1_000,
  damagePerTick: 1,
  visualKey: 'needle-gaze',
  telegraph: 'raise',
} as const satisfies EnemyAbilityDef;
