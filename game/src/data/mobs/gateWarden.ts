import type { MobDef } from '../content/types';

export const GATE_WARDEN_MOB = {
  id: 'gate-warden',
  name: 'Gate Warden',
  tags: ['boss'],
  hp: 145,
  autoDamage: 4,
  swingIntervalMs: 3_500,
  abilityIds: ['bonehowl'],
  visualKey: 'gate-warden',
} as const satisfies MobDef;
