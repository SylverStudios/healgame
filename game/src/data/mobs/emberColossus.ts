import type { MobDef } from '../content/types';

export const EMBER_COLOSSUS_MOB = {
  id: 'ember-colossus',
  name: 'Ember Colossus',
  tags: ['boss'],
  hp: 240,
  // J26: floor scaling (+4 at order 3) stacks on this. The crown kit's
  // Graven-Scale heals sustain the tank; the efficiency kit's slow flat heals
  // lose it, and the lower boss HP ends the fight before the whole party falls.
  autoDamage: 3,
  swingIntervalMs: 3_200,
  abilityIds: ['emberfall'],
  visualKey: 'ember-colossus',
} as const satisfies MobDef;
