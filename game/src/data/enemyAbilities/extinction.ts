import type { EnemyAbilityDef } from '../content/types';

export const EXTINCTION = {
  id: 'extinction',
  name: 'Extinction',
  kind: 'partyAoE',
  castMs: 10_000,
  firstCastAtMs: 15_000,
  intervalMs: 25_000,
  partyDamage: 10,
  visualKey: 'extinction',
} as const satisfies EnemyAbilityDef;
