import type { MobDef } from '../content/types';

export const THORN_HUSK = {
  id: 'thorn-husk',
  name: 'Thorn Husk',
  tags: ['trash'],
  hp: 15,
  // J26: floor scaling (+6 at order 4) supplies this mob's auto pressure; the
  // authored base drops so grouped trash swings don't burst the tank.
  autoDamage: 0,
  swingIntervalMs: 2_900,
  abilityIds: [],
  visualKey: 'thorn-husk',
} as const satisfies MobDef;
