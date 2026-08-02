import type { MobDef } from '../content/types';

export const CHOIR_SHADE = {
  id: 'choir-shade',
  name: 'Choir Shade',
  tags: ['trash'],
  hp: 15,
  // J26: floor scaling (+8 at order 5) supplies this mob's auto pressure.
  autoDamage: 0,
  swingIntervalMs: 2_800,
  abilityIds: ['soul-toll-lesser'],
  visualKey: 'choir-shade',
} as const satisfies MobDef;
