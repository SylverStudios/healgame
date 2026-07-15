import type { MobDef } from '../content/types';

export const THORN_HUSK = {
  id: 'thorn-husk',
  name: 'Thorn Husk',
  tags: ['trash'],
  hp: 11,
  autoDamage: 2,
  swingIntervalMs: 2_900,
  abilityIds: [],
  visualKey: 'thorn-husk',
} as const satisfies MobDef;
