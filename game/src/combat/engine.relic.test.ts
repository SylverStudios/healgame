import { describe, expect, it } from 'vitest';
import { CombatEngine } from './engine';
import {
  BASTION_PLATE,
  EMBER_LEDGER,
  IRON_WARD,
  QUICKSTEEL,
  STILL_RESERVOIR,
  TRIAGE_BELL,
  TWIN_FANG,
  VANGUARD_SIGIL,
  VITAL_EMBER,
  WARBLOOD_GEM,
} from '../data/relics';
import { makeTestEncounter, TEST_SOLEMN_MEND, TEST_SPELLS } from './testFixtures';
import type { CombatEngineOptions, CombatEvent } from './types';

const ENCOUNTER = makeTestEncounter({
  waves: [{ enemies: [{ name: 'Dummy', hp: 10_000, count: 1, autoDamage: 3, swingIntervalMs: 3000 }] }],
});

function runScript(options?: CombatEngineOptions): { events: CombatEvent[]; engine: CombatEngine } {
  const engine = new CombatEngine(ENCOUNTER, TEST_SPELLS, options);
  engine.setTarget('tank');
  const events = engine.advance(3000);
  engine.castSpell(TEST_SOLEMN_MEND.id);
  events.push(...engine.advance(TEST_SOLEMN_MEND.castMs));
  return { events, engine };
}

describe('permanent relic stats', () => {
  it('cumulatively applies max mana, role max HP, armor, auto damage, and swing interval effects', () => {
    const engine = new CombatEngine(ENCOUNTER, TEST_SPELLS, {
      bonusMaxMana: 5,
      relics: [
        STILL_RESERVOIR,
        VITAL_EMBER,
        BASTION_PLATE,
        IRON_WARD,
        TWIN_FANG,
        QUICKSTEEL,
        WARBLOOD_GEM,
        VANGUARD_SIGIL,
      ],
    });

    const party = Object.fromEntries(engine.state.party.map((unit) => [unit.id, unit]));
    expect([party.healer!.mana, party.healer!.maxMana]).toEqual([35, 35]);
    expect([party.tank!.hp, party.tank!.maxHp]).toEqual([25, 25]);
    expect([party.dps1!.hp, party.dps1!.maxHp, party.dps2!.maxHp]).toEqual([13, 13, 13]);
    expect(party.healer!.maxHp).toBe(20);

    const events = engine.advance(3000);
    const damage = events.filter((event): event is Extract<CombatEvent, { type: 'damage' }> => event.type === 'damage');
    expect(damage.filter((event) => event.sourceId === 'dps1')).toHaveLength(3);
    expect(damage.filter((event) => event.sourceId === 'dps1').map((event) => event.amount)).toEqual([4, 4, 4]);
    expect(damage.find((event) => event.sourceId === 'tank')?.amount).toBe(2);
    expect(damage.find((event) => event.targetId === 'tank')?.amount).toBe(2);
  });

  it('adds healing and regenerates mana on the 30-second simulation boundary', () => {
    const engine = new CombatEngine(ENCOUNTER, TEST_SPELLS, { relics: [TRIAGE_BELL, EMBER_LEDGER] });
    engine.setTarget('healer');
    engine.castSpell(TEST_SOLEMN_MEND.id);
    const castEvents = engine.advance(TEST_SOLEMN_MEND.castMs);
    const heal = castEvents.find((event): event is Extract<CombatEvent, { type: 'heal' }> => event.type === 'heal');
    expect(heal?.overheal).toBe(TEST_SOLEMN_MEND.heal + 1);
    expect(engine.state.party.find((unit) => unit.id === 'healer')?.mana).toBe(15);

    engine.advance(27_999);
    expect(engine.state.party.find((unit) => unit.id === 'healer')?.mana).toBe(15);
    engine.advance(1);
    expect(engine.state.party.find((unit) => unit.id === 'healer')?.mana).toBe(16);
  });

  it('merges options.manaRegen with relic manaRegen (sum amounts, min interval)', () => {
    // Ember Ledger: +1 / 30s. Options: +1 / 10s → combined +2 every 10s.
    const engine = new CombatEngine(ENCOUNTER, TEST_SPELLS, {
      relics: [EMBER_LEDGER],
      manaRegen: { amount: 1, intervalMs: 10_000 },
    });
    engine.setTarget('healer');
    engine.castSpell(TEST_SOLEMN_MEND.id);
    engine.advance(TEST_SOLEMN_MEND.castMs); // 2000ms elapsed → 8000ms until first tick
    const manaAfterCast = engine.state.party.find((unit) => unit.id === 'healer')!.mana;

    engine.advance(7999);
    expect(engine.state.party.find((unit) => unit.id === 'healer')!.mana).toBe(manaAfterCast);
    engine.advance(1);
    expect(engine.state.party.find((unit) => unit.id === 'healer')!.mana).toBe(manaAfterCast + 2);
  });
});

describe('no relic regression', () => {
  it('omitted relics and an empty relic list produce identical logs, state, and rewards', () => {
    const omitted = runScript();
    const empty = runScript({ relics: [] });
    expect(omitted.events).toEqual(empty.events);
    expect(omitted.engine.state).toEqual(empty.engine.state);
    expect(omitted.engine.rewards).toEqual(empty.engine.rewards);
  });
});
