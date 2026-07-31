import type { EnemyAbilityDef } from '../content/types';

/**
 * Iron Pass trash teach — lesser Tunnel Vision. Same tunnelVision focus verb as
 * the Spire Lancer's greater (tunnelVision.ts): a longer, clearly readable
 * telegraph into a shorter channel that ticks for half the boss damage, so the
 * pack teaches "top the focused target / kill the caster" without wiping.
 *
 * v1 enemy mechanics chunk E5: retuned from the E4 stub. With 2–4 iron husks
 * channeling at once the stacked focus pressure wiped the efficiency crown, so
 * the channel is halved (3 ticks) and the telegraph lengthened for readability;
 * the focus-start cadence is preserved so the shared cast bar still teaches
 * "top the fixated target". ~30% of the boss channel per cast.
 */
export const TUNNEL_VISION_LESSER = {
  id: 'tunnel-vision-lesser',
  name: 'Lesser Tunnel Vision',
  kind: 'tunnelVision',
  telegraphMs: 7_000,
  firstCastAtMs: 4_000,
  intervalMs: 13_000,
  channelMs: 3_000,
  tickMs: 1_000,
  damagePerTick: 1,
  visualKey: 'tunnel-vision',
  telegraph: 'glow',
} as const satisfies EnemyAbilityDef;
