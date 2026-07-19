import type { EnemyAbilityDef } from '../content/types';

/** Cinder Vault boss mechanic: telegraph, then party-wide ember DoT. */
export const EMBERFALL = {
  id: 'emberfall',
  name: 'Emberfall',
  kind: 'partyDoT',
  castMs: 4_000,
  firstCastAtMs: 5_000,
  intervalMs: 15_000,
  // Same total party damage as the old 3×2 chunk (6), but half-second ticks of 1
  // so the burn reads as a steady fire instead of three heavy hits.
  durationMs: 3_000,
  tickMs: 500,
  damagePerTick: 1,
  visualKey: 'emberfall',
  // v0.3 chunk F: brightening embers reads naturally for a fire DoT wind-up.
  telegraph: 'glow',
} as const satisfies EnemyAbilityDef;
