import type { EnemyAbilityDef } from '../content/types';

export const TUNNEL_VISION = {
  id: 'tunnel-vision',
  name: 'Tunnel Vision',
  kind: 'tunnelVision',
  telegraphMs: 3_000,
  firstCastAtMs: 7_000,
  intervalMs: 20_000,
  channelMs: 11_000,
  tickMs: 1_000,
  damagePerTick: 2,
  visualKey: 'tunnel-vision',
  // v0.3 chunk F: telegraph phase only — the channel already has its own crimson focus
  // brand (bossFocusStarted), so a plain warm 'glow' here avoids double-signaling.
  telegraph: 'glow',
} as const satisfies EnemyAbilityDef;
