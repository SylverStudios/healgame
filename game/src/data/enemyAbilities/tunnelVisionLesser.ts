import type { EnemyAbilityDef } from '../content/types';

/**
 * Iron Pass trash teach — lesser Tunnel Vision. Same tunnelVision focus verb as
 * the Spire Lancer's greater (tunnelVision.ts): a longer, clearly readable
 * telegraph into a shorter channel that ticks for half the boss damage, so the
 * pack teaches "top the focused target / kill the caster" without wiping.
 *
 * v1 enemy mechanics chunk E4: stub magnitude (~50% intensity); E5 retunes.
 */
export const TUNNEL_VISION_LESSER = {
  id: 'tunnel-vision-lesser',
  name: 'Lesser Tunnel Vision',
  kind: 'tunnelVision',
  telegraphMs: 6_000,
  firstCastAtMs: 3_000,
  intervalMs: 12_000,
  channelMs: 5_000,
  tickMs: 1_000,
  damagePerTick: 1,
  visualKey: 'tunnel-vision',
  telegraph: 'glow',
} as const satisfies EnemyAbilityDef;
