import type { EnemyAbilityDef } from '../content/types';

/** Cinder Vault boss mechanic: telegraph, then party-wide ember DoT. */
export const EMBERFALL = {
  id: 'emberfall',
  name: 'Emberfall',
  kind: 'partyDoT',
  // Wave 3 / PR2 2A: longer cast wind-up (~1.6×) for readable bar shake; party DoT
  // needs no eye reticle (chunk 2B). intervalMs bumped so post-cast gap stays near
  // pre-2A and the efficiency-kit clear gate still holds.
  castMs: 6_500,
  firstCastAtMs: 5_000,
  intervalMs: 18_000,
  // Same total party damage as the old 3×2 chunk (6), but half-second ticks of 1
  // so the burn reads as a steady fire instead of three heavy hits.
  durationMs: 3_000,
  tickMs: 500,
  damagePerTick: 1,
  visualKey: 'emberfall',
  // v0.3 chunk F: brightening embers reads naturally for a fire DoT wind-up.
  telegraph: 'glow',
} as const satisfies EnemyAbilityDef;
