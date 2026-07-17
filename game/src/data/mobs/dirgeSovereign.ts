import type { MobDef } from '../content/types';

export const DIRGE_SOVEREIGN_MOB = {
  id: 'dirge-sovereign',
  name: 'Dirge Sovereign',
  tags: ['boss'],
  hp: 320,
  autoDamage: 4,
  swingIntervalMs: 3_200,
  abilityIds: ['soul-toll'],
  visualKey: 'dirge-sovereign',
} as const satisfies MobDef;
