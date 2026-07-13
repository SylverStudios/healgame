/**
 * Tunnel Vision boss cast (Alpha 0.1 §D3): telegraph -> single-target channel
 * that ticks damage into one focused non-tank party member, deterministic
 * round-robin target selection (no Math.random -- poc engine purity rule).
 *
 * Regression note: every existing Bonehowl/Extinction-style ("partyAoE")
 * test in engine.combat.test.ts / balance.test.ts / etc. is untouched and
 * still passes unmodified -- the `kind` discriminant is optional on that arm
 * specifically so pre-union encounter data keeps compiling as-is.
 */
import { describe, expect, it } from 'vitest';
import { CombatEngine } from './engine';
import { makeTestEncounter, TEST_MINOR_SPELL } from './testFixtures';
import type { BossDef, CombatEvent, TunnelVisionCastDef } from './types';

function damages(events: CombatEvent[]): Extract<CombatEvent, { type: 'damage' }>[] {
  return events.filter((e): e is Extract<CombatEvent, { type: 'damage' }> => e.type === 'damage');
}
function focusStarts(events: CombatEvent[]): Extract<CombatEvent, { type: 'bossFocusStarted' }>[] {
  return events.filter((e): e is Extract<CombatEvent, { type: 'bossFocusStarted' }> => e.type === 'bossFocusStarted');
}
function focusTicks(events: CombatEvent[]): Extract<CombatEvent, { type: 'bossFocusTick' }>[] {
  return events.filter((e): e is Extract<CombatEvent, { type: 'bossFocusTick' }> => e.type === 'bossFocusTick');
}
function focusEnds(events: CombatEvent[]): Extract<CombatEvent, { type: 'bossFocusEnded' }>[] {
  return events.filter((e): e is Extract<CombatEvent, { type: 'bossFocusEnded' }> => e.type === 'bossFocusEnded');
}
function castStarts(events: CombatEvent[]): Extract<CombatEvent, { type: 'bossCastStarted' }>[] {
  return events.filter((e): e is Extract<CombatEvent, { type: 'bossCastStarted' }> => e.type === 'bossCastStarted');
}
function castFinishes(events: CombatEvent[]): Extract<CombatEvent, { type: 'bossCastFinished' }>[] {
  return events.filter((e): e is Extract<CombatEvent, { type: 'bossCastFinished' }> => e.type === 'bossCastFinished');
}

/** A single 1hp trash enemy so dps1's first swing (t=1000) kills it and the boss spawns at t=1000 -- same convention as the Bonehowl tests in engine.combat.test.ts. */
const ONE_TRASH_WAVE = [{ enemies: [{ name: 'Weak', hp: 1, count: 1 }] }];

function tunnelVisionBoss(
  cast: TunnelVisionCastDef,
  overrides: Partial<Pick<BossDef, 'hp' | 'autoDamage' | 'swingIntervalMs' | 'id' | 'name'>> = {},
): BossDef {
  return {
    id: overrides.id ?? 'tv-boss',
    name: overrides.name ?? 'Spire Lancer',
    // High hp by default so merc auto-attacks never end the fight mid-test.
    hp: overrides.hp ?? 999_999,
    autoDamage: overrides.autoDamage ?? 0,
    swingIntervalMs: overrides.swingIntervalMs ?? 999_999,
    cast,
  };
}

describe('Tunnel Vision (boss cast union)', () => {
  it('telegraph -> focus start timing uses start-to-start cadence off the pinned draft numbers', () => {
    // Pinned draft numbers (task brief): telegraph 3000, channel 10000, tick 1000,
    // damagePerTick 2, firstCastAtMs 8000, intervalMs 30000.
    const cast: TunnelVisionCastDef = {
      kind: 'tunnelVision',
      name: 'Tunnel Vision',
      telegraphMs: 3000,
      firstCastAtMs: 8000,
      intervalMs: 30_000,
      channelMs: 10_000,
      tickMs: 1000,
      damagePerTick: 2,
    };
    const encounter = makeTestEncounter({ waves: ONE_TRASH_WAVE, boss: tunnelVisionBoss(cast) });
    const engine = new CombatEngine(encounter, [TEST_MINOR_SPELL]);

    engine.advance(1000); // trash dies -> boss spawns at t=1000
    // Telegraph starts at spawn(1000) + firstCastAtMs(8000) = 9000.
    const startEvents = engine.advance(8000);
    expect(castStarts(startEvents)).toHaveLength(1);
    expect(engine.state.bossCast).not.toBeNull();
    expect(engine.state.bossCast!.totalMs).toBe(3000);

    const notYet = engine.advance(2999); // t=11999, telegraph completes at 12000
    expect(castFinishes(notYet)).toHaveLength(0);
    expect(focusStarts(notYet)).toHaveLength(0);

    const landing = engine.advance(1); // t=12000: telegraph completes -> channel begins
    expect(castFinishes(landing)).toHaveLength(1);
    expect(engine.state.bossCast).toBeNull();
    const starts = focusStarts(landing);
    expect(starts).toHaveLength(1);
    expect(starts[0]!.name).toBe('Tunnel Vision');
    expect(starts[0]!.totalMs).toBe(10_000);
    expect(starts[0]!.targetId).toBe('dps1'); // first eligible (non-tank) by sorted id
  });

  it('deterministic rotation across 4 activations: sorted-by-id, skips tank, wraps back to the first target', () => {
    // Short telegraph/channel (1 tick, 0 damage) so many activations happen quickly.
    const cast: TunnelVisionCastDef = {
      kind: 'tunnelVision',
      name: 'Tunnel Vision',
      telegraphMs: 500,
      firstCastAtMs: 500,
      intervalMs: 3000,
      channelMs: 1000,
      tickMs: 1000,
      damagePerTick: 0,
    };
    const encounter = makeTestEncounter({ waves: ONE_TRASH_WAVE, boss: tunnelVisionBoss(cast) });
    const engine = new CombatEngine(encounter, [TEST_MINOR_SPELL]);

    engine.advance(1000); // boss spawns at t=1000
    // Activations start at t=1500, 4500, 7500, 10500 (start-to-start every 3000ms).
    const events = engine.advance(11_000);
    const starts = focusStarts(events);
    expect(starts.length).toBeGreaterThanOrEqual(4);
    expect(starts.slice(0, 4).map((e) => e.targetId)).toEqual(['dps1', 'dps2', 'healer', 'dps1']);
  });

  it('ticks damagePerTick every tickMs for channelMs/tickMs ticks through the normal damage pipeline; total = 2x a 10-maxHp target when kept alive', () => {
    const cast: TunnelVisionCastDef = {
      kind: 'tunnelVision',
      name: 'Tunnel Vision',
      telegraphMs: 1000,
      firstCastAtMs: 2000,
      intervalMs: 100_000,
      channelMs: 10_000,
      tickMs: 1000,
      damagePerTick: 2,
    };
    const encounter = makeTestEncounter({ waves: ONE_TRASH_WAVE, boss: tunnelVisionBoss(cast) });
    const engine = new CombatEngine(encounter, [TEST_MINOR_SPELL]);

    engine.advance(1000); // boss spawns t=1000
    engine.advance(2000); // telegraph starts t=3000
    engine.advance(1000); // telegraph completes -> channel begins at t=4000

    expect(engine.state.party.find((u) => u.id === 'dps1')!.maxHp).toBe(10);

    // Keep dps1 topped off: heal (2hp/2mana/500ms cast) lands on the same 1000ms
    // boundary as each tick (heal completes before the tick per fixed priority
    // order), exactly offsetting the incoming 2 damage/tick so dps1 survives
    // the full 10-tick channel instead of dying early.
    engine.setTarget('dps1');
    const allEvents: CombatEvent[] = [];
    for (let i = 0; i < 10; i++) {
      engine.castSpell(TEST_MINOR_SPELL.id);
      allEvents.push(...engine.advance(1000));
    }

    const ticks = focusTicks(allEvents);
    expect(ticks).toHaveLength(10);
    expect(ticks.every((t) => t.amount === 2 && t.targetId === 'dps1')).toBe(true);
    expect(ticks.reduce((sum, t) => sum + t.amount, 0)).toBe(20); // 2x dps1's 10 maxHp

    const dpsDamage = damages(allEvents).filter((d) => d.targetId === 'dps1' && d.sourceId === 'tv-boss');
    expect(dpsDamage).toHaveLength(10);

    expect(focusEnds(allEvents)).toHaveLength(1);
    expect(focusEnds(allEvents)[0]!.targetId).toBe('dps1');
    expect(engine.state.party.find((u) => u.id === 'dps1')!.alive).toBe(true);
  });

  it('ends the channel early (no retarget) the instant an unhealed focus target dies mid-channel', () => {
    const cast: TunnelVisionCastDef = {
      kind: 'tunnelVision',
      name: 'Tunnel Vision',
      telegraphMs: 1000,
      firstCastAtMs: 1000,
      intervalMs: 8000,
      channelMs: 10_000,
      tickMs: 1000,
      damagePerTick: 2,
    };
    const encounter = makeTestEncounter({ waves: ONE_TRASH_WAVE, boss: tunnelVisionBoss(cast) });
    const engine = new CombatEngine(encounter, [TEST_MINOR_SPELL]);

    engine.advance(1000); // boss spawns t=1000
    // Telegraph starts t=2000, completes t=3000 -> channel begins, unhealed.
    // dps1 (10 maxHp) takes 2 dmg/tick: dies exactly on the 5th tick (t=8000, 10 dmg total).
    const events = engine.advance(7000); // t=1000..8000 covers all 5 ticks (4000,5000,6000,7000,8000)

    const ticks = focusTicks(events);
    expect(ticks).toHaveLength(5);
    expect(ticks.every((t) => t.targetId === 'dps1')).toBe(true);

    const ends = focusEnds(events);
    expect(ends).toHaveLength(1);
    expect(ends[0]!.targetId).toBe('dps1');

    expect(events.some((e) => e.type === 'unitDied' && e.unitId === 'dps1')).toBe(true);
    expect(engine.state.party.find((u) => u.id === 'dps1')!.alive).toBe(false);

    // No 6th tick after death.
    const laterEvents = engine.advance(2000);
    expect(focusTicks(laterEvents)).toHaveLength(0);
  });

  it('excludes a dead eligible unit from the rotation without resetting the round-robin cursor', () => {
    const cast: TunnelVisionCastDef = {
      kind: 'tunnelVision',
      name: 'Tunnel Vision',
      telegraphMs: 1000,
      firstCastAtMs: 1000,
      intervalMs: 8000,
      channelMs: 10_000,
      tickMs: 1000,
      damagePerTick: 2,
    };
    const encounter = makeTestEncounter({ waves: ONE_TRASH_WAVE, boss: tunnelVisionBoss(cast) });
    const engine = new CombatEngine(encounter, [TEST_MINOR_SPELL]);

    engine.advance(1000); // boss spawns t=1000
    // Activation 1 telegraph starts t=2000, channel begins t=3000; dps1 (index 0)
    // is the first target and dies unhealed at the 5th tick (t=8000).
    const first = engine.advance(9000);
    expect(focusStarts(first)[0]!.targetId).toBe('dps1');
    expect(engine.state.party.find((u) => u.id === 'dps1')!.alive).toBe(false);

    // Activation 2 starts at t=2000+8000=10000 (start-to-start cadence). With
    // dps1 dead, eligible = [dps2, healer]; focusIndex is now 1 (incremented
    // once by activation 1), so eligible[1 % 2] = healer -- not dps2 (which
    // would have been the naive "next" pick if the dead unit weren't skipped).
    const second = engine.advance(2000); // reaches t=11000, well past the t=10000 telegraph start
    const secondStarts = focusStarts(second);
    expect(secondStarts).toHaveLength(1);
    expect(secondStarts[0]!.targetId).toBe('healer');
  });

  it('boss keeps auto-attacking the tank during both the telegraph and the channel', () => {
    const cast: TunnelVisionCastDef = {
      kind: 'tunnelVision',
      name: 'Tunnel Vision',
      telegraphMs: 3000,
      firstCastAtMs: 1000,
      intervalMs: 100_000,
      channelMs: 6000,
      tickMs: 1000,
      damagePerTick: 1,
    };
    const encounter = makeTestEncounter({
      waves: ONE_TRASH_WAVE,
      boss: tunnelVisionBoss(cast, { autoDamage: 1, swingIntervalMs: 2000 }),
    });
    const engine = new CombatEngine(encounter, [TEST_MINOR_SPELL]);

    engine.advance(1000); // boss spawns t=1000
    engine.advance(1000); // t=2000: telegraph starts
    expect(engine.state.bossCast).not.toBeNull();

    const telegraphWindow = engine.advance(3000); // t=2000..5000: entirely inside the telegraph
    expect(engine.state.bossCast).toBeNull(); // telegraph just completed, channel now active
    const telegraphAutos = damages(telegraphWindow).filter((d) => d.sourceId === 'tv-boss' && d.targetId === 'tank');
    expect(telegraphAutos.length).toBeGreaterThanOrEqual(1);

    const channelWindow = engine.advance(6000); // t=5000..11000: entirely inside the channel
    const channelAutos = damages(channelWindow).filter((d) => d.sourceId === 'tv-boss' && d.targetId === 'tank');
    expect(channelAutos.length).toBeGreaterThanOrEqual(1);
  });

  it('is deterministic: identical inputs and command sequence produce an identical event log', () => {
    const buildEngine = () => {
      const cast: TunnelVisionCastDef = {
        kind: 'tunnelVision',
        name: 'Tunnel Vision',
        telegraphMs: 500,
        firstCastAtMs: 500,
        intervalMs: 3000,
        channelMs: 2000,
        tickMs: 1000,
        damagePerTick: 1,
      };
      const encounter = makeTestEncounter({
        waves: ONE_TRASH_WAVE,
        boss: tunnelVisionBoss(cast, { autoDamage: 1, swingIntervalMs: 1700 }),
      });
      return new CombatEngine(encounter, [TEST_MINOR_SPELL]);
    };

    const run = (engine: CombatEngine): CombatEvent[] => {
      const log: CombatEvent[] = [];
      log.push(...engine.advance(1000));
      engine.setTarget('dps2');
      log.push(...engine.advance(2500));
      engine.castSpell(TEST_MINOR_SPELL.id);
      log.push(...engine.advance(1500));
      log.push(...engine.advance(6000));
      return log;
    };

    const a = run(buildEngine());
    const b = run(buildEngine());
    expect(a).toEqual(b);
    // Sanity: this scenario actually exercises Tunnel Vision (not a vacuous comparison).
    expect(a.some((e) => e.type === 'bossFocusStarted')).toBe(true);
    expect(a.some((e) => e.type === 'bossFocusTick')).toBe(true);
  });
});
