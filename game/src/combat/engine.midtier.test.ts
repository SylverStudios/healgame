/**
 * Mid-tier boss mechanics: partyDoT (Emberfall) and manaSiphon (Soul Toll).
 */
import { describe, expect, it } from 'vitest';
import { CombatEngine } from './engine';
import { makeTestEncounter, TEST_MINOR_SPELL } from './testFixtures';
import type { BossDef, CombatEvent, ManaSiphonCastDef, PartyDoTCastDef } from './types';

function ofType<T extends CombatEvent['type']>(
  events: CombatEvent[],
  type: T,
): Extract<CombatEvent, { type: T }>[] {
  return events.filter((e): e is Extract<CombatEvent, { type: T }> => e.type === type);
}

const ONE_TRASH_WAVE = [{ enemies: [{ name: 'Weak', hp: 1, count: 1 }] }];

function bossWithCast(
  cast: PartyDoTCastDef | ManaSiphonCastDef,
  overrides: Partial<Pick<BossDef, 'hp' | 'autoDamage' | 'swingIntervalMs' | 'id' | 'name'>> = {},
): BossDef {
  return {
    id: overrides.id ?? 'mid-boss',
    name: overrides.name ?? 'Mid Boss',
    hp: overrides.hp ?? 999_999,
    autoDamage: overrides.autoDamage ?? 0,
    swingIntervalMs: overrides.swingIntervalMs ?? 999_999,
    cast,
  };
}

describe('partyDoT (Emberfall)', () => {
  it('starts a party DoT after the telegraph and ticks every living member', () => {
    const cast: PartyDoTCastDef = {
      kind: 'partyDoT',
      name: 'Emberfall',
      castMs: 2_000,
      firstCastAtMs: 1_000,
      intervalMs: 10_000,
      durationMs: 3_000,
      tickMs: 1_000,
      damagePerTick: 1,
    };
    const engine = new CombatEngine(
      makeTestEncounter({ waves: ONE_TRASH_WAVE, boss: bossWithCast(cast) }),
      [TEST_MINOR_SPELL],
    );

    engine.advance(1000); // trash dies → boss at t=1000
    const start = engine.advance(1000); // first cast at spawn+1000
    expect(ofType(start, 'bossCastStarted')).toHaveLength(1);

    const finish = engine.advance(2000);
    expect(ofType(finish, 'bossCastFinished')).toHaveLength(1);
    expect(ofType(finish, 'partyDoTStarted')).toEqual([
      { type: 'partyDoTStarted', name: 'Emberfall', totalMs: 3_000 },
    ]);

    const tick1 = engine.advance(1000);
    const dmg1 = ofType(tick1, 'damage').filter((e) => e.sourceId === 'mid-boss');
    expect(dmg1).toHaveLength(4); // tank, dps1, dps2, healer

    engine.advance(1999);
    expect(ofType(engine.advance(0), 'partyDoTEnded')).toHaveLength(0);
    const done = engine.advance(1);
    expect(ofType(done, 'partyDoTEnded')).toEqual([{ type: 'partyDoTEnded', name: 'Emberfall' }]);
  });
});

describe('manaSiphon (Soul Toll)', () => {
  it('damages the party and burns healer mana when the cast lands', () => {
    const cast: ManaSiphonCastDef = {
      kind: 'manaSiphon',
      name: 'Soul Toll',
      castMs: 2_000,
      firstCastAtMs: 1_000,
      intervalMs: 8_000,
      partyDamage: 2,
      manaBurn: 5,
    };
    const engine = new CombatEngine(
      makeTestEncounter({ waves: ONE_TRASH_WAVE, boss: bossWithCast(cast) }),
      [TEST_MINOR_SPELL],
    );

    engine.advance(1000);
    engine.advance(1000);
    const beforeMana = engine.state.party.find((u) => u.role === 'healer')!.mana;
    const land = engine.advance(2000);
    expect(ofType(land, 'bossCastFinished')).toHaveLength(1);
    expect(ofType(land, 'manaBurned')).toEqual([{ type: 'manaBurned', amount: 5 }]);
    const dmg = ofType(land, 'damage').filter((e) => e.sourceId === 'mid-boss');
    expect(dmg).toHaveLength(4);
    expect(dmg.every((e) => e.amount === 2)).toBe(true);
    const healer = engine.state.party.find((u) => u.role === 'healer')!;
    expect(healer.mana).toBe(beforeMana - 5);
  });
});
