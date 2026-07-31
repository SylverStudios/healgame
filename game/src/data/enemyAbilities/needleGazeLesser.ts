import type { EnemyAbilityDef } from '../content/types';

/**
 * Verdant Rift trash teach — lesser Needle Gaze. Same tunnelVision focus verb
 * as the Thorn Matriarch's greater (needleGaze.ts): a longer, readable
 * telegraph into a shorter channel ticking for half the boss damage, drilling
 * the "cover the fixated target" reaction before the matriarch's full gaze.
 *
 * v1 enemy mechanics chunk E5: retuned from the E4 stub. Grouped thorn husks
 * (which carry the full order-4 auto floor) stacked their gaze channels hard
 * enough to keep the efficiency crown a member short, so the channel is halved
 * (3 ticks) and the telegraph lengthened for readability while the focus-start
 * cadence is kept so the fixate reaction still reads. ~30% of the boss channel.
 */
export const NEEDLE_GAZE_LESSER = {
  id: 'needle-gaze-lesser',
  name: 'Lesser Needle Gaze',
  kind: 'tunnelVision',
  telegraphMs: 7_000,
  firstCastAtMs: 4_000,
  intervalMs: 13_000,
  channelMs: 3_000,
  tickMs: 1_000,
  damagePerTick: 1,
  visualKey: 'needle-gaze',
  telegraph: 'raise',
} as const satisfies EnemyAbilityDef;
