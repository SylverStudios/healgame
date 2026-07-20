import type { MobDef } from '../content/types';

export const GLOAM_WRETCH = {
  id: 'gloam-wretch',
  name: 'Gloam Wretch',
  tags: ['trash'],
  hp: 15,
  autoDamage: 2,
  swingIntervalMs: 2_700,
  abilityIds: [],
  visualKey: 'gloam-wretch',
} as const satisfies MobDef;
