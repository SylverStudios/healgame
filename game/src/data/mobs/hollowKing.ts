import type { MobDef } from '../content/types';

export const HOLLOW_KING_MOB = {
  id: 'hollow-king',
  name: 'Hollow King',
  tags: ['boss'],
  hp: 999,
  autoDamage: 3,
  swingIntervalMs: 3_500,
  abilityIds: ['extinction'],
  visualKey: 'hollow-king',
} as const satisfies MobDef;
