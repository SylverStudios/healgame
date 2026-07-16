import type { MobDef } from '../content/types';

export const IRON_HUSK = {
  id: 'iron-husk',
  name: 'Iron Husk',
  tags: ['trash'],
  hp: 13,
  autoDamage: 2,
  swingIntervalMs: 3_000,
  abilityIds: [],
  visualKey: 'iron-husk',
} as const satisfies MobDef;
