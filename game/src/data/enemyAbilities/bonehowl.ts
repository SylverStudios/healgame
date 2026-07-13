import type { EnemyAbilityDef } from '../content/types';

export const BONEHOWL = {
  id: 'bonehowl',
  name: 'Bonehowl',
  kind: 'partyAoE',
  castMs: 10_000,
  firstCastAtMs: 3_000,
  intervalMs: 12_000,
  partyDamage: 4,
  visualKey: 'bonehowl',
} as const satisfies EnemyAbilityDef;
