import { describe, expect, it } from 'vitest';
import { CombatEngine } from './engine';
import { PARTY } from '../data/constants';
import { makeTestEncounter, TEST_SPELLS } from './testFixtures';

/**
 * Focused test for the Chunk 3 constructor extension: `options.bonusMaxMana`
 * (e.g. from the "Deep Reserves" talent-tree node) adds to the healer's max
 * AND starting mana. Everything else about the engine is unchanged.
 */
describe('CombatEngine constructor options', () => {
  it('spawns party with role display names (ids stay stable)', () => {
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS);
    const byId = Object.fromEntries(engine.state.party.map((u) => [u.id, u]));
    expect(byId.tank).toMatchObject({ id: 'tank', name: 'Guardian', role: 'tank' });
    expect(byId.dps1).toMatchObject({ id: 'dps1', name: 'Butcher', role: 'dps' });
    expect(byId.dps2).toMatchObject({ id: 'dps2', name: 'Eagle Eye', role: 'dps' });
    expect(byId.healer).toMatchObject({ id: 'healer', name: 'Healer', role: 'healer' });
  });

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

  it('applies options.manaRegen on the simulation interval (Alpha 0.2)', () => {
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS, {
      manaRegen: { amount: 2, intervalMs: 10_000 },
    });
    engine.setTarget('healer');
    engine.castSpell('solemn-mend');
    engine.advance(2000);
    const manaAfterCast = engine.state.party.find((u) => u.id === 'healer')!.mana;
    engine.advance(7999);
    expect(engine.state.party.find((u) => u.id === 'healer')!.mana).toBe(manaAfterCast);
    engine.advance(1);
    expect(engine.state.party.find((u) => u.id === 'healer')!.mana).toBe(manaAfterCast + 2);
  });
});
