import type { EnemyAbilityDef } from '../content/types';

export const TUNNEL_VISION = {
  id: 'tunnel-vision',
  name: 'Tunnel Vision',
  kind: 'tunnelVision',
  // Wave 3 / PR2 2A: longer readable telegraph (~1.7×) + earlier first cast so the
  // shared cast bar has room to grow; PR3 tightens cadence for mid-ladder pressure.
  // J26: shorter channel + tighter interval so the efficiency kit sees ≥6 focus
  // channels across the dragged-out Iron Pass boss phase (spire-lancer tank auto
  // is the kill lever; this pumps the focus count for the balance gate).
  telegraphMs: 5_000,
  firstCastAtMs: 5_000,
  intervalMs: 14_000,
  channelMs: 9_000,
  tickMs: 1_000,
  damagePerTick: 2,
  visualKey: 'tunnel-vision',
  // v0.3 chunk F: telegraph phase only — the channel already has its own crimson focus
  // brand (bossFocusStarted), so a plain warm 'glow' here avoids double-signaling.
  telegraph: 'glow',
} as const satisfies EnemyAbilityDef;
