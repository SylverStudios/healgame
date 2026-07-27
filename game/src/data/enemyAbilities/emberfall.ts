import type { EnemyAbilityDef } from '../content/types';

/** Cinder Vault boss mechanic: telegraph, then party-wide ember DoT. */
export const EMBERFALL = {
  id: 'emberfall',
  name: 'Emberfall',
  kind: 'partyDoT',
  // Wave 3 / PR2 2A: longer cast wind-up (~1.6×) for readable bar shake; party DoT
  // needs no eye reticle (chunk 2B). PR3 tightens cadence for mid-ladder pressure.
  castMs: 6_500,
  firstCastAtMs: 5_000,
  intervalMs: 16_000,
  // Wave 3 PR3: more frequent burn pressure for the mid-ladder tune.
  durationMs: 3_000,
  tickMs: 500,
  damagePerTick: 1,
  visualKey: 'emberfall',
  // v0.3 chunk F: brightening embers reads naturally for a fire DoT wind-up.
  telegraph: 'glow',
} as const satisfies EnemyAbilityDef;
