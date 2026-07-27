import type { EnemyAbilityDef } from '../content/types';

export const BONEHOWL = {
  id: 'bonehowl',
  name: 'Bonehowl',
  kind: 'partyAoE',
  // Cast window already long (10s); Wave 3 / PR2 2A only pulls first cast earlier
  // so the shared bar is on screen sooner after boss spawn.
  castMs: 10_000,
  firstCastAtMs: 2_000,
  intervalMs: 12_000,
  partyDamage: 4,
  visualKey: 'bonehowl',
  // v0.3 chunk F: the Gate Warden rears back to howl — 'raise' reads as the wind-up.
  telegraph: 'raise',
} as const satisfies EnemyAbilityDef;
