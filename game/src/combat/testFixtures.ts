/**
 * Test-only fixtures: a small, hand-tuned encounter so unit tests can reason
 * about exact hp/mana/timing numbers without depending on the real Ash Gate
 * draft balance in data/encounters.ts (which is expected to get retuned).
 */

import type { EncounterDef, SpellDef } from './types';

/** 1 enemy in wave 1 (10 hp, so it survives several hits), 1 in wave 2, then a boss with Bonehowl. */
export function makeTestEncounter(overrides: Partial<EncounterDef> = {}): EncounterDef {
  return {
    id: 'test-encounter',
    name: 'Test Encounter',
    waves: [
      { enemies: [{ name: 'Dummy', hp: 10, count: 1 }] },
      { enemies: [{ name: 'Dummy', hp: 10, count: 1 }] },
    ],
    boss: {
      id: 'test-boss',
      name: 'Test Boss',
      hp: 20,
      autoDamage: 2,
      swingIntervalMs: 3000,
      cast: {
        name: 'Bonehowl',
        castMs: 10_000,
        firstCastAtMs: 5000,
        intervalMs: 15_000,
        partyDamage: 4,
      },
    },
    ...overrides,
  };
}

export const TEST_SOLEMN_MEND: SpellDef = { id: 'solemn-mend', name: 'Solemn Mend', heal: 5, mana: 5, castMs: 2000 };
export const TEST_ZEALOUS_MENDING: SpellDef = { id: 'zealous-mending', name: 'Zealous Mending', heal: 5, mana: 8, castMs: 1000 };
/** Extra test-only spell (Chunk 1 effects tests) so a synergy-consumption test can arm two
 * independent entries with two distinct trigger spells feeding the same buffed spell. */
export const TEST_MINOR_SPELL: SpellDef = { id: 'test-minor', name: 'Minor Spell', heal: 2, mana: 2, castMs: 500 };

export const TEST_SPELLS: SpellDef[] = [TEST_SOLEMN_MEND, TEST_ZEALOUS_MENDING];
