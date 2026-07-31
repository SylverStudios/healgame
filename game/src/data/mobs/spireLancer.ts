import type { MobDef } from '../content/types';

export const SPIRE_LANCER_MOB = {
  id: 'spire-lancer',
  name: 'Spire Lancer',
  tags: ['boss'],
  hp: 340,
  // J26: raised tank auto (+floor +2 at order 2) is the Iron Pass kill lever —
  // the crown kit's Graven-Scale heals sustain the tank, the slow flat
  // efficiency heals lose it, so efficiency scrapes while crown clears clean.
  autoDamage: 6,
  swingIntervalMs: 3_500,
  abilityIds: ['tunnel-vision'],
  visualKey: 'spire-lancer',
} as const satisfies MobDef;
