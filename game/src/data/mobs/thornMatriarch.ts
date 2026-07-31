import type { MobDef } from '../content/types';

export const THORN_MATRIARCH_MOB = {
  id: 'thorn-matriarch',
  name: 'Thorn Matriarch',
  tags: ['boss'],
  hp: 250,
  // J26: floor scaling (+6 at order 4) supplies the boss auto; base trimmed so
  // the tank-heal demand (and healer mana) stays sustainable for crown kits.
  autoDamage: 0,
  swingIntervalMs: 3_300,
  abilityIds: ['needle-gaze'],
  visualKey: 'thorn-matriarch',
} as const satisfies MobDef;
