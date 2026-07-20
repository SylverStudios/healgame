import type { MobDef } from '../content/types';

export const VEIL_CANTOR_MOB = {
  id: 'veil-cantor',
  name: 'Veil Cantor',
  tags: ['boss'],
  hp: 300,
  autoDamage: 4,
  swingIntervalMs: 3_100,
  abilityIds: ['null-psalm'],
  visualKey: 'veil-cantor',
} as const satisfies MobDef;
