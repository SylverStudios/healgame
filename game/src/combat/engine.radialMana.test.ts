import { describe, expect, it } from 'vitest';
import { CombatEngine } from './engine';
import { GCD_MS } from '../data/constants';
import type { EncounterDef, SpellDef } from './types';

function makeEncounter(): EncounterDef {
  return {
    id: 'radial-mana-test',
    name: 'Radial Mana Test',
    waves: [{ enemies: [{ name: 'Bag', hp: 200, count: 1, autoDamage: 0, swingIntervalMs: 60_000 }] }],
    boss: { id: 'quiet-boss', name: 'Quiet Boss', hp: 200, autoDamage: 0, swingIntervalMs: 60_000 },
  };
}

const MEND: SpellDef = {
  id: 'mend',
  name: 'Mend',
  heal: 4,
  mana: 3,
  castMs: 0,
};

const MANA_BONK: SpellDef = {
  id: 'mana-bonk',
  name: 'Mana Bonk',
  heal: 0,
  damage: 1,
  mana: 0,
  castMs: 0,
  manaOnHit: 1,
};

const BONK: SpellDef = {
  id: 'bonk',
  name: 'Bonk',
  heal: 0,
  damage: 1,
  mana: 0,
  castMs: 0,
};

describe('Wave 5 radial mana hooks', () => {
  it('Mana Bonk restores manaOnHit after a damage cast', () => {
    const engine = new CombatEngine(makeEncounter(), [MANA_BONK, MEND]);
    engine.setTarget('tank');
    // Spend mana first so restore is observable below max.
    engine.castSpell('mend');
    engine.advance(GCD_MS);
    const before = engine.state.party.find((u) => u.id === 'healer')!.mana;
    engine.castSpell('mana-bonk');
    engine.advance(GCD_MS);
    const after = engine.state.party.find((u) => u.id === 'healer')!.mana;
    expect(after).toBe(before + 1);
  });

  it('Battle Mend manaSynergy discounts the next Mend cast', () => {
    const engine = new CombatEngine(makeEncounter(), [BONK, MEND], {
      manaSynergies: [{ triggerSpellId: 'bonk', targetSpellId: 'mend', manaDelta: -1 }],
    });
    engine.setTarget('tank');
    const startMana = engine.state.party.find((u) => u.id === 'healer')!.mana;
    engine.castSpell('bonk');
    engine.advance(GCD_MS);
    engine.castSpell('mend');
    engine.advance(GCD_MS);
    // Mend base 3, discount 1 → spent 2
    expect(engine.state.party.find((u) => u.id === 'healer')!.mana).toBe(startMana - 2);
  });

  it('armedManaDiscountSpellIds arms on trigger, clears on Mend cast start', () => {
    const engine = new CombatEngine(makeEncounter(), [BONK, MEND], {
      manaSynergies: [{ triggerSpellId: 'bonk', targetSpellId: 'mend', manaDelta: -1 }],
    });
    engine.setTarget('tank');
    expect(engine.state.armedManaDiscountSpellIds).toEqual([]);

    engine.castSpell('bonk');
    engine.advance(GCD_MS);
    expect(engine.state.armedManaDiscountSpellIds).toEqual(['mend']);

    // Consumed at cast start (instant Mend completes in the same call).
    engine.castSpell('mend');
    expect(engine.state.armedManaDiscountSpellIds).toEqual([]);
    engine.advance(GCD_MS);
    expect(engine.state.armedManaDiscountSpellIds).toEqual([]);
  });
});
