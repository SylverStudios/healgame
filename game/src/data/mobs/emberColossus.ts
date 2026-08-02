import type { MobDef } from '../content/types';

export const EMBER_COLOSSUS_MOB = {
  id: 'ember-colossus',
  name: 'Ember Colossus',
  tags: ['boss'],
  hp: 170,
  // J26: floor scaling (+2 at order 2) stacks on this (compiled auto = 6).
  // Raised auto + lower HP: shorter fight with harder per-swing pressure.
  // Crown kits sustain through the spike; efficiency kit clears with mana
  // to spare (measured-devotion path design). Lv4 god bot clears at Cinder
  // order 2 with this trim; playtest: god Lv4, basic Lv5.
  autoDamage: 4,
  swingIntervalMs: 3_200,
  abilityIds: ['emberfall'],
  visualKey: 'ember-colossus',
} as const satisfies MobDef;
