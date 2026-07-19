import type { MobDef } from '../content/types';

export const THORN_MATRIARCH_MOB = {
  id: 'thorn-matriarch',
  name: 'Thorn Matriarch',
  tags: ['boss'],
  hp: 290,
  autoDamage: 4,
  swingIntervalMs: 3_300,
  abilityIds: ['needle-gaze'],
  visualKey: 'thorn-matriarch',
} as const satisfies MobDef;
