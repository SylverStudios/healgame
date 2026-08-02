/**
 * Deterministic every-N-casts crit (mirrors tank block carry).
 *
 *   carry += 1 per completed player cast
 *   procs = floor(carry / N); carry %= N
 *   if procs > 0 → this cast crits (heal and/or player spell damage)
 *
 * Multiply: Math.floor(raw * (1000 + critBonusPermille) / 1000)
 * Flag: crit?: boolean on heal / player damage events.
 * Undefined critThresholdN = disabled (default).
 */

import { describe, expect, it } from 'vitest';
import { CombatEngine } from './engine';
import { GCD_MS } from '../data/constants';
import { makeTestEncounter, TEST_SOLEMN_MEND } from './testFixtures';
import type { CombatEngineOptions, SpellDef } from './types';

const INSTANT_HEAL: SpellDef = { ...TEST_SOLEMN_MEND, castMs: 0, mana: 0 };
const INSTANT_BONK: SpellDef = {
  id: 'bonk',
  name: 'Bonk',
  description: 'test damage',
  mana: 0,
  castMs: 0,
  heal: 0,
  damage: 2,
  glyph: 'B',
};

function encounter() {
  return makeTestEncounter({
    waves: [{ enemies: [{ name: 'Bag', hp: 99_999, count: 1, autoDamage: 0, swingIntervalMs: 60_000 }] }],
  });
}

function castHealAndGetEvent(opts: CombatEngineOptions = {}) {
  const engine = new CombatEngine(encounter(), [INSTANT_HEAL], opts);
  engine.setTarget('tank');
  engine.castSpell('solemn-mend');
  const events = engine.advance(0);
  const heal = events.find((e) => e.type === 'heal');
  if (!heal || heal.type !== 'heal') throw new Error('expected heal event');
  return heal;
}

describe('crit (deterministic every-N casts)', () => {
  it('without critThresholdN, never crits', () => {
    const healEvt = castHealAndGetEvent({ critBonusPermille: 500 });
    expect(healEvt.crit).toBeUndefined();
    expect(healEvt.amount + healEvt.overheal).toBe(INSTANT_HEAL.heal);
  });

  it('every Nth completed cast crits (N=3)', () => {
    const engine = new CombatEngine(encounter(), [INSTANT_HEAL], {
      critThresholdN: 3,
      critBonusPermille: 500,
      bonusMaxMana: 99,
    });
    engine.setTarget('tank');
    const critFlags: boolean[] = [];
    for (let i = 0; i < 6; i++) {
      engine.castSpell('solemn-mend');
      // Instant cast completes in beginCast; advance past GCD so the next cast starts.
      const events = engine.advance(GCD_MS);
      const heal = events.find((e) => e.type === 'heal');
      critFlags.push(heal?.type === 'heal' && heal.crit === true);
    }
    expect(critFlags).toEqual([false, false, true, false, false, true]);
  });

  it('crit multiplies heal with floor (bonus 500 → +50%)', () => {
    const healEvt = castHealAndGetEvent({ critThresholdN: 1, critBonusPermille: 500 });
    expect(healEvt.crit).toBe(true);
    expect(healEvt.amount + healEvt.overheal).toBe(7); // floor(5 * 1500 / 1000)
  });

  it('floor truncates the crit multiply (not round)', () => {
    const tiny: SpellDef = { ...INSTANT_HEAL, heal: 2 };
    const engine = new CombatEngine(encounter(), [tiny], {
      critThresholdN: 1,
      critBonusPermille: 999,
    });
    engine.setTarget('tank');
    engine.castSpell('solemn-mend');
    const heal = engine.advance(0).find((e) => e.type === 'heal');
    expect(heal?.type).toBe('heal');
    if (heal?.type !== 'heal') return;
    expect(heal.amount + heal.overheal).toBe(3); // floor(2 * 1999 / 1000)
  });

  it('player damage crits on the same every-N cadence', () => {
    const engine = new CombatEngine(encounter(), [INSTANT_BONK], {
      critThresholdN: 2,
      critBonusPermille: 500,
    });
    const flags: Array<boolean | undefined> = [];
    for (let i = 0; i < 4; i++) {
      engine.castSpell('bonk');
      const events = engine.advance(GCD_MS);
      const dmg = events.find((e) => e.type === 'damage' && e.sourceId === 'healer');
      flags.push(dmg?.type === 'damage' ? dmg.crit : undefined);
    }
    expect(flags).toEqual([undefined, true, undefined, true]);
  });

  it('heal and damage casts share one cast counter', () => {
    const engine = new CombatEngine(encounter(), [INSTANT_HEAL, INSTANT_BONK], {
      critThresholdN: 2,
      critBonusPermille: 500,
      bonusMaxMana: 99,
    });
    engine.setTarget('tank');
    // Cast 1 heal — no crit
    engine.castSpell('solemn-mend');
    let events = engine.advance(GCD_MS);
    expect(events.find((e) => e.type === 'heal' && e.crit === true)).toBeUndefined();
    // Cast 2 bonk — crits (shared counter)
    engine.castSpell('bonk');
    events = engine.advance(0);
    const dmg = events.find((e) => e.type === 'damage' && e.sourceId === 'healer');
    expect(dmg?.type === 'damage' && dmg.crit === true).toBe(true);
    expect(dmg?.type === 'damage' && dmg.amount === 3).toBe(true); // floor(2*1500/1000)
  });

  it('cancelled casts do not advance the crit counter', () => {
    const slow: SpellDef = { ...TEST_SOLEMN_MEND, castMs: 2000, mana: 0 };
    const engine = new CombatEngine(encounter(), [slow, INSTANT_HEAL], {
      critThresholdN: 2,
      critBonusPermille: 500,
      bonusMaxMana: 99,
    });
    engine.setTarget('tank');
    // Completed cast #1
    engine.castSpell('solemn-mend');
    engine.advance(2000);
    engine.advance(GCD_MS);
    // Start and cancel — must not count
    engine.castSpell('solemn-mend');
    engine.cancelCast();
    engine.advance(0);
    engine.advance(GCD_MS);
    // Completed cast #2 → crit
    engine.castSpell('solemn-mend');
    const events = engine.advance(2000);
    const heal = events.find((e) => e.type === 'heal');
    expect(heal?.type === 'heal' && heal.crit === true).toBe(true);
  });

  it('merc and enemy autos never get crit flags', () => {
    const engine = new CombatEngine(
      makeTestEncounter({
        waves: [
          {
            enemies: [
              { name: 'Punisher', hp: 99_999, count: 1, autoDamage: 2, swingIntervalMs: 1000 },
            ],
          },
        ],
      }),
      [INSTANT_HEAL],
      { critThresholdN: 1, critBonusPermille: 1000 },
    );
    const events = engine.advance(10_000);
    const nonPlayer = events.filter((e) => e.type === 'damage' && e.sourceId !== 'healer');
    expect(nonPlayer.length).toBeGreaterThan(0);
    expect(nonPlayer.every((e) => e.type === 'damage' && e.crit === undefined)).toBe(true);
  });

  it('crit that overheals: amount+overheal equals the critted raw', () => {
    const healEvt = castHealAndGetEvent({ critThresholdN: 1, critBonusPermille: 500 });
    expect(healEvt.crit).toBe(true);
    expect(healEvt.amount + healEvt.overheal).toBe(7);
  });
});
