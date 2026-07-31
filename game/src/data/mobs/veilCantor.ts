import type { MobDef } from '../content/types';

export const VEIL_CANTOR_MOB = {
  id: 'veil-cantor',
  name: 'Veil Cantor',
  tags: ['boss'],
  hp: 300,
  // J26: floor scaling (+10 at order 6) supplies the boss auto.
  autoDamage: 0,
  swingIntervalMs: 3_100,
  abilityIds: ['null-psalm'],
  visualKey: 'veil-cantor',
} as const satisfies MobDef;
