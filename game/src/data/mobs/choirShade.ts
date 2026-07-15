import type { MobDef } from '../content/types';

export const CHOIR_SHADE = {
  id: 'choir-shade',
  name: 'Choir Shade',
  tags: ['trash'],
  hp: 11,
  autoDamage: 2,
  swingIntervalMs: 2_800,
  abilityIds: [],
  visualKey: 'choir-shade',
} as const satisfies MobDef;
