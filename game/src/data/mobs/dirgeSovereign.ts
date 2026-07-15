import type { MobDef } from '../content/types';

export const DIRGE_SOVEREIGN_MOB = {
  id: 'dirge-sovereign',
  name: 'Dirge Sovereign',
  tags: ['boss'],
  hp: 260,
  autoDamage: 4,
  swingIntervalMs: 2_800,
  abilityIds: ['soul-toll'],
  visualKey: 'dirge-sovereign',
} as const satisfies MobDef;
