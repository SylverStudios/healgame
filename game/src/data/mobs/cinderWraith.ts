import type { MobDef } from '../content/types';

export const CINDER_WRAITH = {
  id: 'cinder-wraith',
  name: 'Cinder Wraith',
  tags: ['trash'],
  hp: 14,
  // J26: floor scaling (+4 at order 3) adds to this; base trimmed so DoT stays
  // the Cinder Vault threat, not trash burst.
  autoDamage: 1,
  swingIntervalMs: 3_000,
  abilityIds: ['emberfall-lesser'],
  visualKey: 'cinder-wraith',
} as const satisfies MobDef;
