import type { MobDef } from '../content/types';

export const CINDER_WRAITH = {
  id: 'cinder-wraith',
  name: 'Cinder Wraith',
  tags: ['trash'],
  hp: 14,
  autoDamage: 2,
  swingIntervalMs: 3_000,
  abilityIds: [],
  visualKey: 'cinder-wraith',
} as const satisfies MobDef;
