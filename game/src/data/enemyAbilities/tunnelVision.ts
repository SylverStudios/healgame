import type { EnemyAbilityDef } from '../content/types';

export const TUNNEL_VISION = {
  id: 'tunnel-vision',
  name: 'Tunnel Vision',
  kind: 'tunnelVision',
  telegraphMs: 3_000,
  firstCastAtMs: 8_000,
  intervalMs: 30_000,
  channelMs: 10_000,
  tickMs: 1_000,
  damagePerTick: 2,
  visualKey: 'tunnel-vision',
} as const satisfies EnemyAbilityDef;
