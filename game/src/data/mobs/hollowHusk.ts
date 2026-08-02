import type { MobDef } from '../content/types';

/**
 * The Maw signature trash caster. Visually a reuse of the Ash Gate husk
 * (visualKey 'ash-husk'), but carries the unique Lesser Extinction teach rather
 * than reusing Lesser Bonehowl — abilities attach per-mob, so The Maw needs its
 * own husk to teach the extinction verb (see extinctionLesser.ts). Stats mirror
 * ash-husk so the Maw wave's hp/auto overrides stay identical after the split.
 */
export const HOLLOW_HUSK = {
  id: 'hollow-husk',
  name: 'Hollow Husk',
  tags: ['trash'],
  hp: 15,
  autoDamage: 2,
  swingIntervalMs: 3_000,
  abilityIds: ['extinction-lesser'],
  visualKey: 'ash-husk',
} as const satisfies MobDef;
