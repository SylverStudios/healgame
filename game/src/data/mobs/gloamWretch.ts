import type { MobDef } from '../content/types';

export const GLOAM_WRETCH = {
  id: 'gloam-wretch',
  name: 'Gloam Wretch',
  tags: ['trash'],
  hp: 15,
  // J26: floor scaling (+10 at order 6) supplies this mob's auto pressure.
  autoDamage: 0,
  swingIntervalMs: 2_700,
  abilityIds: ['null-psalm-lesser'],
  visualKey: 'gloam-wretch',
} as const satisfies MobDef;
