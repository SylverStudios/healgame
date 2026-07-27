import type { EnemyAbilityDef } from '../content/types';

export const TUNNEL_VISION = {
  id: 'tunnel-vision',
  name: 'Tunnel Vision',
  kind: 'tunnelVision',
  // Wave 3 / PR2 2A: longer readable telegraph (~1.7×) + earlier first cast so the
  // shared cast bar has room to grow before the focus channel starts.
  telegraphMs: 5_000,
  firstCastAtMs: 5_000,
  intervalMs: 20_000,
  channelMs: 11_000,
  tickMs: 1_000,
  damagePerTick: 2,
  visualKey: 'tunnel-vision',
  // v0.3 chunk F: telegraph phase only — the channel already has its own crimson focus
  // brand (bossFocusStarted), so a plain warm 'glow' here avoids double-signaling.
  telegraph: 'glow',
} as const satisfies EnemyAbilityDef;
