import type { EnemyAbilityDef } from '../content/types';

/** Cinder Vault boss mechanic: telegraph, then party-wide ember DoT. */
export const EMBERFALL = {
  id: 'emberfall',
  name: 'Emberfall',
  kind: 'partyDoT',
  castMs: 4_000,
  firstCastAtMs: 5_000,
  intervalMs: 15_000,
  durationMs: 3_000,
  tickMs: 1_000,
  damagePerTick: 2,
  visualKey: 'emberfall',
  // v0.3 chunk F: brightening embers reads naturally for a fire DoT wind-up.
  telegraph: 'glow',
} as const satisfies EnemyAbilityDef;
