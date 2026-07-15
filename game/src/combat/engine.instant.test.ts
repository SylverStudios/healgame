import { describe, expect, it } from 'vitest';
import { CombatEngine } from './engine';
import { GCD_MS, PARTY } from '../data/constants';
import { makeTestEncounter, TEST_SPELLS } from './testFixtures';
import type { CombatEvent, SpellDef } from './types';

/** Alpha 0.2 §D4 — castMs === 0 must resolve without freezing advance(). */
const INSTANT_HEAL: SpellDef = {
  id: 'test-instant',
  name: 'Instant Heal',
  heal: 3,
  mana: 2,
  castMs: 0,
};

describe('instant cast (castMs === 0)', () => {
  it('completes on castSpell flush: heal lands, mana reserved, GCD applies, no stuck cast', () => {
    const engine = new CombatEngine(makeTestEncounter(), [...TEST_SPELLS, INSTANT_HEAL]);
    engine.setTarget('healer'); // full HP → pure overheal; still proves heal pipeline

    engine.castSpell(INSTANT_HEAL.id);
    const events = engine.advance(0);
    expect(events.some((e) => e.type === 'castStarted')).toBe(true);
    expect(events.some((e) => e.type === 'castFinished' && e.spellId === INSTANT_HEAL.id)).toBe(true);
    const heal = events.find((e): e is Extract<CombatEvent, { type: 'heal' }> => e.type === 'heal');
    expect(heal?.spellId).toBe(INSTANT_HEAL.id);
    expect(heal!.amount + heal!.overheal).toBe(INSTANT_HEAL.heal);
    expect(heal!.overheal).toBe(INSTANT_HEAL.heal);

    expect(engine.state.playerCast).toBeNull();
    expect(engine.state.gcdRemainingMs).toBe(GCD_MS);
    expect(engine.state.party.find((u) => u.id === 'healer')!.mana).toBe(
      PARTY.startingMana - INSTANT_HEAL.mana,
    );
  });

  it('does not freeze advance after an instant cast', () => {
    const engine = new CombatEngine(makeTestEncounter(), [...TEST_SPELLS, INSTANT_HEAL]);
    engine.setTarget('healer');
    engine.castSpell(INSTANT_HEAL.id);
    engine.advance(0);
    // If cast remainingMs were stuck at 0, this advance would no-op forever.
    const before = engine.state.gcdRemainingMs;
    engine.advance(100);
    expect(engine.state.gcdRemainingMs).toBe(before - 100);
  });

  it('still queues behind GCD: second instant waits for GCD then fires', () => {
    const engine = new CombatEngine(makeTestEncounter(), [...TEST_SPELLS, INSTANT_HEAL]);
    engine.setTarget('healer');
    engine.castSpell(INSTANT_HEAL.id);
    engine.advance(0);
    engine.castSpell(INSTANT_HEAL.id); // queued while GCD busy
    engine.advance(0);
    expect(engine.state.party.find((u) => u.id === 'healer')!.mana).toBe(
      PARTY.startingMana - INSTANT_HEAL.mana,
    );

    const events = engine.advance(GCD_MS);
    const finished = events.filter((e) => e.type === 'castFinished');
    expect(finished).toHaveLength(1);
    expect(engine.state.party.find((u) => u.id === 'healer')!.mana).toBe(
      PARTY.startingMana - INSTANT_HEAL.mana * 2,
    );
  });
});
