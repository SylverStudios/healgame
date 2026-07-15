import type { MobDef } from '../content/types';

export const EMBER_COLOSSUS_MOB = {
  id: 'ember-colossus',
  name: 'Ember Colossus',
  tags: ['boss'],
  hp: 210,
  autoDamage: 3,
  swingIntervalMs: 3_200,
  abilityIds: ['emberfall'],
  visualKey: 'ember-colossus',
} as const satisfies MobDef;
