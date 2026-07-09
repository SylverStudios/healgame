import { describe, expect, it } from 'vitest';
import { CombatEngine } from './engine';
import { PARTY } from '../data/constants';
import { makeTestEncounter, TEST_SPELLS } from './testFixtures';

/**
 * Focused test for the Chunk 3 constructor extension: `options.bonusMaxMana`
 * (e.g. from the "Deep Reserves" spell-tree node) adds to the healer's max
 * AND starting mana. Everything else about the engine is unchanged.
 */
describe('CombatEngine constructor options', () => {
  it('defaults to no bonus when options are omitted (backward compatible)', () => {
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS);
    const healer = engine.state.party.find((u) => u.id === 'healer')!;
    expect(healer.maxMana).toBe(PARTY.startingMana);
    expect(healer.mana).toBe(PARTY.startingMana);
  });

  it('adds bonusMaxMana to both the healer max and starting mana', () => {
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS, { bonusMaxMana: 5 });
    const healer = engine.state.party.find((u) => u.id === 'healer')!;
    expect(healer.maxMana).toBe(PARTY.startingMana + 5);
    expect(healer.mana).toBe(PARTY.startingMana + 5);
  });

  it('treats an empty options object the same as omitted', () => {
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS, {});
    const healer = engine.state.party.find((u) => u.id === 'healer')!;
    expect(healer.maxMana).toBe(PARTY.startingMana);
  });
});
