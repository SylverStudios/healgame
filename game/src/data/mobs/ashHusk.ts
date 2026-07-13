import type { MobDef } from '../content/types';

export const ASH_HUSK = {
  id: 'ash-husk',
  name: 'Ash Husk',
  tags: ['trash'],
  hp: 11,
  autoDamage: 1,
  swingIntervalMs: 3_000,
  abilityIds: [],
  visualKey: 'ash-husk',
} as const satisfies MobDef;
