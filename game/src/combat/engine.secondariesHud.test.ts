/**
 * Verifies that CombatState.secondaries correctly exposes crit/block carry
 * progress for the HUD without touching the underlying carry math.
 */

import { describe, expect, it } from 'vitest';
import { CombatEngine } from './engine';
import { GCD_MS } from '../data/constants';
import { makeTestEncounter, TEST_SOLEMN_MEND, TEST_SPELLS } from './testFixtures';
import type { SpellDef } from './types';

const INSTANT_HEAL: SpellDef = { ...TEST_SOLEMN_MEND, castMs: 0, mana: 0 };

/** Encounter that will never kill anyone (enemy swings 0 dmg). */
function quietEncounter() {
  return makeTestEncounter({
    waves: [{ enemies: [{ name: 'Bag', hp: 99_999, count: 1, autoDamage: 0, swingIntervalMs: 60_000 }] }],
  });
}

/** Encounter where enemy hits for `autoDamage` every `swingIntervalMs` ms. */
function hittingEncounter(autoDamage: number, swingIntervalMs: number) {
  return makeTestEncounter({
    waves: [{ enemies: [{ name: 'Puncher', hp: 99_999, count: 1, autoDamage, swingIntervalMs }] }],
  });
}

describe('secondaries HUD field', () => {
  // ---- absence when thresholds not set -----------------------------------

  it('without thresholds, secondaries is absent/undefined', () => {
    const engine = new CombatEngine(quietEncounter(), [INSTANT_HEAL]);
    expect(engine.state.secondaries).toBeUndefined();
  });

  it('without thresholds, secondaries stays absent after casts', () => {
    const engine = new CombatEngine(quietEncounter(), [INSTANT_HEAL], { bonusMaxMana: 99 });
    engine.setTarget('tank');
    for (let i = 0; i < 3; i++) {
      engine.castSpell('solemn-mend');
      engine.advance(GCD_MS);
    }
    expect(engine.state.secondaries).toBeUndefined();
  });

  // ---- crit carry ---------------------------------------------------------

  it('with critThresholdN=8 and 0 casts: crit carry is 0', () => {
    const engine = new CombatEngine(quietEncounter(), [INSTANT_HEAL], {
      critThresholdN: 8,
      critBonusPermille: 500,
    });
    expect(engine.state.secondaries?.crit).toEqual({ n: 8, carry: 0 });
  });

  it('after k completed casts (not cancelled), carry = k % n', () => {
    const n = 8;
    const engine = new CombatEngine(quietEncounter(), [INSTANT_HEAL], {
      critThresholdN: n,
      critBonusPermille: 500,
      bonusMaxMana: 99,
    });
    engine.setTarget('tank');
    for (let k = 1; k <= n + 2; k++) {
      engine.castSpell('solemn-mend');
      engine.advance(GCD_MS);
      expect(engine.state.secondaries?.crit).toEqual({ n, carry: k % n });
    }
  });

  it('cancelled casts do not advance the crit carry', () => {
    const slow: SpellDef = { ...TEST_SOLEMN_MEND, castMs: 2000, mana: 0 };
    const engine = new CombatEngine(quietEncounter(), [slow, INSTANT_HEAL], {
      critThresholdN: 3,
      critBonusPermille: 500,
      bonusMaxMana: 99,
    });
    engine.setTarget('tank');
    // One completed cast → carry = 1
    engine.castSpell('solemn-mend');
    engine.advance(2000);
    engine.advance(GCD_MS);
    expect(engine.state.secondaries?.crit?.carry).toBe(1);
    // Start then cancel — carry must stay at 1
    engine.castSpell('solemn-mend');
    engine.cancelCast();
    engine.advance(GCD_MS);
    expect(engine.state.secondaries?.crit?.carry).toBe(1);
  });

  // ---- block carry --------------------------------------------------------

  it('with blockThresholdN=5 and no hits: block carry is 0', () => {
    const engine = new CombatEngine(quietEncounter(), TEST_SPELLS, { blockThresholdN: 5 });
    expect(engine.state.secondaries?.block).toEqual({ n: 5, carry: 0 });
  });

  it('after hits that accumulate carry=3, block shows {n:5, carry:3}', () => {
    // N=5, hit=3: after one swing carry = 3 (3 < 5 → no block proc yet)
    const engine = new CombatEngine(hittingEncounter(3, 200), TEST_SPELLS, { blockThresholdN: 5 });
    engine.advance(200); // one enemy swing
    expect(engine.state.secondaries?.block).toEqual({ n: 5, carry: 3 });
  });

  it('carry resets to remainder after a block proc (N=3, hit=3 → carry=0 each swing)', () => {
    // carry 0→3 → blocked=1, carry=0 every swing
    const engine = new CombatEngine(hittingEncounter(3, 200), TEST_SPELLS, { blockThresholdN: 3 });
    engine.advance(200);
    expect(engine.state.secondaries?.block?.carry).toBe(0);
    engine.advance(200);
    expect(engine.state.secondaries?.block?.carry).toBe(0);
  });

  // ---- mixed (both enabled) -----------------------------------------------

  it('when both thresholds set, both sub-fields are present', () => {
    const engine = new CombatEngine(quietEncounter(), [INSTANT_HEAL], {
      critThresholdN: 4,
      critBonusPermille: 500,
      blockThresholdN: 6,
    });
    const sec = engine.state.secondaries;
    expect(sec?.crit).toEqual({ n: 4, carry: 0 });
    expect(sec?.block).toEqual({ n: 6, carry: 0 });
  });

  // ---- only crit set, block absent (and vice-versa) ----------------------

  it('with only critThresholdN set, block sub-field is absent', () => {
    const engine = new CombatEngine(quietEncounter(), [INSTANT_HEAL], {
      critThresholdN: 4,
      critBonusPermille: 500,
    });
    const sec = engine.state.secondaries;
    expect(sec?.crit).toBeDefined();
    expect(sec?.block).toBeUndefined();
  });

  it('with only blockThresholdN set, crit sub-field is absent', () => {
    const engine = new CombatEngine(quietEncounter(), TEST_SPELLS, { blockThresholdN: 4 });
    const sec = engine.state.secondaries;
    expect(sec?.block).toBeDefined();
    expect(sec?.crit).toBeUndefined();
  });
});
