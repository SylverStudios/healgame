/**
 * v1 enemy mechanics (chunk E2): multi-caster enemy casts. Any living enemy
 * (boss OR trash spawned from a group with `cast`) schedules casts on its own
 * per-unit timer. Covers:
 *  - two trash partyAoE casters completing in deterministic (ascending unit id)
 *    order, every cast/focus event carrying the caster's `sourceId`;
 *  - a lesser (trash) partyDoT completing in a scripted encounter, ticks
 *    attributed to the trash caster;
 *  - Tunnel Vision from trash, plus the locked global focus-exclusivity rule
 *    when two trash telegraphs would open a channel the same tick;
 *  - a trash caster dying mid-channel ending its focus channel;
 *  - boss Bonehowl (partyAoE) behaving exactly as before through the derived
 *    `state.bossCast` surface.
 */
import { describe, expect, it } from 'vitest';
import { CombatEngine } from './engine';
import { makeTestEncounter, TEST_MINOR_SPELL } from './testFixtures';
import type {
  BossDef,
  CombatEvent,
  EnemyCastDef,
  EnemyGroupDef,
  PartyAoECastDef,
  PartyDoTCastDef,
  TunnelVisionCastDef,
} from './types';

// ---- event filters -----------------------------------------------------------------

function ofType<T extends CombatEvent['type']>(
  events: CombatEvent[],
  type: T,
): Extract<CombatEvent, { type: T }>[] {
  return events.filter((e): e is Extract<CombatEvent, { type: T }> => e.type === type);
}
const damages = (e: CombatEvent[]) => ofType(e, 'damage');
const castStarts = (e: CombatEvent[]) => ofType(e, 'bossCastStarted');
const castFinishes = (e: CombatEvent[]) => ofType(e, 'bossCastFinished');
const focusStarts = (e: CombatEvent[]) => ofType(e, 'bossFocusStarted');
const focusTicks = (e: CombatEvent[]) => ofType(e, 'bossFocusTick');
const focusEnds = (e: CombatEvent[]) => ofType(e, 'bossFocusEnded');

const PARTY_IDS = new Set(['tank', 'dps1', 'dps2', 'healer']);
/** party-directed damage only (filters out merc autos that hit trash). */
const partyDamages = (e: CombatEvent[]) => damages(e).filter((d) => PARTY_IDS.has(d.targetId));

// ---- fixtures ------------------------------------------------------------------------

/** A boss that never spawns / never interferes: kept off-screen behind unkillable trash. */
const INERT_BOSS: BossDef = {
  id: 'inert-boss',
  name: 'Inert',
  hp: 999_999,
  autoDamage: 0,
  swingIntervalMs: 999_999,
};

/** Trash group that only casts — no autos, effectively unkillable unless `hp` is lowered. */
function caster(
  cast: EnemyCastDef,
  overrides: Partial<Pick<EnemyGroupDef, 'name' | 'hp' | 'count' | 'autoDamage' | 'swingIntervalMs'>> = {},
): EnemyGroupDef {
  return {
    name: overrides.name ?? 'Husk',
    hp: overrides.hp ?? 999_999,
    count: overrides.count ?? 1,
    autoDamage: overrides.autoDamage ?? 0,
    swingIntervalMs: overrides.swingIntervalMs ?? 999_999,
    cast,
  };
}

/** Filler trash (no cast) so a wave doesn't clear when the signature caster dies. */
const FILLER: EnemyGroupDef = { name: 'Filler', hp: 999_999, count: 1, autoDamage: 0, swingIntervalMs: 999_999 };

const LESSER_AOE: PartyAoECastDef = {
  // No `kind` on purpose — exercises the default partyAoE arm from trash.
  name: 'Bonehowl (lesser)',
  castMs: 2000,
  firstCastAtMs: 1000,
  intervalMs: 10_000,
  partyDamage: 1,
};

describe('multi-caster: two trash partyAoE casters', () => {
  it('start + complete in ascending-unit-id order, every event carrying the caster sourceId', () => {
    const engine = new CombatEngine(
      makeTestEncounter({ waves: [{ enemies: [caster(LESSER_AOE, { count: 2 })] }], boss: INERT_BOSS }),
      [TEST_MINOR_SPELL],
    );

    // t=1000: both per-unit timers (firstCastAtMs) elapse -> both telegraphs start,
    // in ascending unit id order.
    const started = engine.advance(1000);
    expect(castStarts(started).map((e) => e.sourceId)).toEqual(['w0-0-0', 'w0-0-1']);
    expect(engine.state.enemyCasts.map((c) => c.sourceId)).toEqual(['w0-0-0', 'w0-0-1']);
    expect(engine.state.enemyCasts.every((c) => c.totalMs === 2000)).toBe(true);
    // Neither is the boss (boss never spawned), so the derived boss cast bar is empty.
    expect(engine.state.bossCast).toBeNull();

    // t=3000: both telegraphs (castMs 2000) complete the same tick -> boss-first-then-
    // ascending completion order; no boss present, so ascending unit id.
    const finished = engine.advance(2000);
    expect(castFinishes(finished).map((e) => e.sourceId)).toEqual(['w0-0-0', 'w0-0-1']);

    // Party-directed AoE damage is grouped by caster in the same order: all of
    // w0-0-0's four hits, then all of w0-0-1's four.
    expect(partyDamages(finished).map((d) => d.sourceId)).toEqual([
      'w0-0-0',
      'w0-0-0',
      'w0-0-0',
      'w0-0-0',
      'w0-0-1',
      'w0-0-1',
      'w0-0-1',
      'w0-0-1',
    ]);
    // Cast bars cleared after completion.
    expect(engine.state.enemyCasts).toHaveLength(0);
  });
});

describe('lesser (trash) partyDoT in a scripted encounter', () => {
  it('telegraphs, starts a party DoT, and ticks are attributed to the trash caster', () => {
    const dot: PartyDoTCastDef = {
      kind: 'partyDoT',
      name: 'Emberfall (lesser)',
      castMs: 1000,
      firstCastAtMs: 1000,
      intervalMs: 10_000,
      durationMs: 2000,
      tickMs: 1000,
      damagePerTick: 1,
    };
    const engine = new CombatEngine(
      makeTestEncounter({ waves: [{ enemies: [caster(dot)] }], boss: INERT_BOSS }),
      [TEST_MINOR_SPELL],
    );

    engine.advance(1000); // t=1000: telegraph starts
    const finish = engine.advance(1000); // t=2000: telegraph completes -> DoT begins
    expect(castFinishes(finish).map((e) => e.sourceId)).toEqual(['w0-0-0']);
    expect(ofType(finish, 'partyDoTStarted')).toEqual([
      { type: 'partyDoTStarted', name: 'Emberfall (lesser)', totalMs: 2000 },
    ]);

    const tick1 = engine.advance(1000); // t=3000: first DoT tick
    const dotHits = partyDamages(tick1);
    expect(dotHits).toHaveLength(4); // tank, dps1, dps2, healer
    expect(dotHits.every((d) => d.sourceId === 'w0-0-0' && d.amount === 1)).toBe(true);
  });
});

describe('Tunnel Vision from trash', () => {
  const trashTV: TunnelVisionCastDef = {
    kind: 'tunnelVision',
    name: 'Tunnel Vision (lesser)',
    telegraphMs: 1000,
    firstCastAtMs: 1000,
    intervalMs: 30_000,
    channelMs: 3000,
    tickMs: 1000,
    damagePerTick: 1,
  };

  it('telegraphs then channels the first non-tank target, attributing focus events to the trash caster', () => {
    const engine = new CombatEngine(
      makeTestEncounter({ waves: [{ enemies: [caster(trashTV)] }], boss: INERT_BOSS }),
      [TEST_MINOR_SPELL],
    );

    const start = engine.advance(1000); // t=1000: telegraph starts
    expect(castStarts(start).map((e) => e.sourceId)).toEqual(['w0-0-0']);

    const channel = engine.advance(1000); // t=2000: telegraph completes -> channel begins
    const fs = focusStarts(channel);
    expect(fs).toHaveLength(1);
    expect(fs[0]!.sourceId).toBe('w0-0-0');
    expect(fs[0]!.targetId).toBe('dps1'); // first eligible non-tank by sorted id

    const ticks = engine.advance(3000); // three 1000ms ticks
    const ft = focusTicks(ticks);
    expect(ft).toHaveLength(3);
    expect(ft.every((t) => t.sourceId === 'w0-0-0' && t.targetId === 'dps1')).toBe(true);
    const dpsHits = damages(ticks).filter((d) => d.targetId === 'dps1' && d.sourceId === 'w0-0-0');
    expect(dpsHits).toHaveLength(3);
  });

  it('opens at most ONE focus channel globally: two same-tick telegraphs -> lowest unit id wins (boss-first rule; no boss present)', () => {
    const engine = new CombatEngine(
      makeTestEncounter({ waves: [{ enemies: [caster(trashTV, { count: 2 })] }], boss: INERT_BOSS }),
      [TEST_MINOR_SPELL],
    );

    engine.advance(1000); // both telegraphs start at t=1000
    const channel = engine.advance(1000); // both telegraphs complete at t=2000

    // Both telegraphs finished...
    expect(castFinishes(channel).map((e) => e.sourceId)).toEqual(['w0-0-0', 'w0-0-1']);
    // ...but only one channel opened (global exclusivity), owned by the lowest unit id.
    const fs = focusStarts(channel);
    expect(fs).toHaveLength(1);
    expect(fs[0]!.sourceId).toBe('w0-0-0');

    // The yielding caster's cadence keeps running; no second channel appears while
    // the first is active (intervalMs is far in the future here).
    const more = engine.advance(3000);
    expect(focusStarts(more)).toHaveLength(0);
  });

  it('ends the channel (bossFocusEnded) when the casting trash dies mid-channel', () => {
    // Signature caster has just enough hp to be killed by merc autos a tick into
    // its channel; a filler add keeps the wave alive so the boss never spawns.
    const engine = new CombatEngine(
      makeTestEncounter({
        waves: [{ enemies: [caster(trashTV, { hp: 10 }), FILLER] }],
        boss: INERT_BOSS,
      }),
      [TEST_MINOR_SPELL],
    );

    const open = engine.advance(2000); // telegraph start (t=1000) + finish (t=2000) -> channel begins
    expect(focusStarts(open).map((e) => e.sourceId)).toEqual(['w0-0-0']);

    // Merc autos (front enemy = w0-0-0) chew through its 10 hp; it dies ~t=3000.
    const died = engine.advance(3000);
    expect(died.some((e) => e.type === 'unitDied' && e.unitId === 'w0-0-0')).toBe(true);
    const ends = focusEnds(died);
    expect(ends).toHaveLength(1);
    expect(ends[0]!.sourceId).toBe('w0-0-0');

    // No further focus ticks after the caster is gone.
    expect(focusTicks(engine.advance(4000))).toHaveLength(0);
  });

  it('is deterministic across identical runs with two casters', () => {
    const build = () =>
      new CombatEngine(
        makeTestEncounter({ waves: [{ enemies: [caster(trashTV, { count: 2 })] }], boss: INERT_BOSS }),
        [TEST_MINOR_SPELL],
      );
    const run = (engine: CombatEngine): CombatEvent[] => {
      const log: CombatEvent[] = [];
      log.push(...engine.advance(1000));
      log.push(...engine.advance(1000));
      log.push(...engine.advance(5000));
      return log;
    };
    const a = run(build());
    const b = run(build());
    expect(a).toEqual(b);
    expect(a.some((e) => e.type === 'bossFocusStarted')).toBe(true);
  });
});

describe('boss Bonehowl (partyAoE) — unchanged via derived state.bossCast', () => {
  it('schedules the boss cast, exposes it on state.bossCast + enemyCasts, and attributes AoE to the boss id', () => {
    const bonehowlBoss: BossDef = {
      id: 'gate-warden',
      name: 'Gate Warden',
      hp: 999_999,
      autoDamage: 0,
      swingIntervalMs: 999_999,
      cast: { name: 'Bonehowl', castMs: 2000, firstCastAtMs: 2000, intervalMs: 20_000, partyDamage: 1 },
    };
    const engine = new CombatEngine(
      makeTestEncounter({ waves: [{ enemies: [{ name: 'Weak', hp: 1, count: 1 }] }], boss: bonehowlBoss }),
      [TEST_MINOR_SPELL],
    );

    engine.advance(1000); // 1hp trash dies to dps1's first swing -> boss spawns
    const start = engine.advance(2000); // t=3000: boss telegraph starts (firstCastAtMs 2000 after spawn)
    expect(castStarts(start).map((e) => e.sourceId)).toEqual(['gate-warden']);
    expect(engine.state.bossCast).not.toBeNull();
    expect(engine.state.bossCast!.name).toBe('Bonehowl');
    expect(engine.state.bossCast!.totalMs).toBe(2000);
    expect(engine.state.enemyCasts).toEqual([
      { sourceId: 'gate-warden', name: 'Bonehowl', remainingMs: 2000, totalMs: 2000 },
    ]);

    const land = engine.advance(2000); // t=5000: Bonehowl lands
    expect(castFinishes(land).map((e) => e.sourceId)).toEqual(['gate-warden']);
    const hits = partyDamages(land);
    expect(hits).toHaveLength(4);
    expect(hits.every((d) => d.sourceId === 'gate-warden')).toBe(true);
    expect(engine.state.bossCast).toBeNull();
  });
});
