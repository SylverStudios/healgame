import type { MobDef } from '../content/types';

export const SPIRE_LANCER_MOB = {
  id: 'spire-lancer',
  name: 'Spire Lancer',
  tags: ['boss'],
  hp: 190,
  autoDamage: 3,
  swingIntervalMs: 3_500,
  abilityIds: ['tunnel-vision'],
  visualKey: 'spire-lancer',
} as const satisfies MobDef;
