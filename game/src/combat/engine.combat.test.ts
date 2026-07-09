import { describe, expect, it } from 'vitest';
import { CombatEngine } from './engine';
import { TRASH } from '../data/constants';
import { makeTestEncounter, TEST_SPELLS } from './testFixtures';
import type { CombatEvent } from './types';

function damages(events: CombatEvent[]): Extract<CombatEvent, { type: 'damage' }>[] {
  return events.filter((e): e is Extract<CombatEvent, { type: 'damage' }> => e.type === 'damage');
}
function deaths(events: CombatEvent[]): Extract<CombatEvent, { type: 'unitDied' }>[] {
  return events.filter((e): e is Extract<CombatEvent, { type: 'unitDied' }> => e.type === 'unitDied');
}
function waveStarts(events: CombatEvent[]): Extract<CombatEvent, { type: 'waveStarted' }>[] {
  return events.filter((e): e is Extract<CombatEvent, { type: 'waveStarted' }> => e.type === 'waveStarted');
}
function ended(events: CombatEvent[]): Extract<CombatEvent, { type: 'combatEnded' }>[] {
  return events.filter((e): e is Extract<CombatEvent, { type: 'combatEnded' }> => e.type === 'combatEnded');
}

describe('auto-attack cadence', () => {
  it('mercs swing on a fixed 3s cadence, focusing the first living enemy', () => {
    // A tanky single dummy that survives many swings so we can count them.
    const encounter = makeTestEncounter({ waves: [{ enemies: [{ name: 'Tanky', hp: 1000, count: 1 }] }] });
    const engine = new CombatEngine(encounter, TEST_SPELLS);
    const events = engine.advance(9000); // 3 swings expected per merc
    const dmg = damages(events).filter((d) => ['tank', 'dps1', 'dps2'].includes(d.sourceId));
    expect(dmg.filter((d) => d.sourceId === 'tank')).toHaveLength(3);
    expect(dmg.filter((d) => d.sourceId === 'dps1')).toHaveLength(3);
    expect(dmg.filter((d) => d.sourceId === 'dps2')).toHaveLength(3);
    expect(dmg.filter((d) => d.sourceId === 'tank')[0]!.amount).toBe(1);
    expect(dmg.filter((d) => d.sourceId === 'dps1')[0]!.amount).toBe(2);
  });

  it('enemy trash auto-attacks the tank on a 3s cadence', () => {
    const encounter = makeTestEncounter({ waves: [{ enemies: [{ name: 'Tanky', hp: 1000, count: 1 }] }] });
    const engine = new CombatEngine(encounter, TEST_SPELLS);
    const events = engine.advance(9000);
    const hits = damages(events).filter((d) => d.targetId === 'tank');
    expect(hits).toHaveLength(3);
    expect(hits[0]!.amount).toBe(TRASH.autoDamage);
  });

  it('once the tank dies, enemy autos fall through to a living DPS, then the healer', () => {
    // Tank has 20 hp and takes 1 dmg/3s from a single dummy -> dies after 20 swings (60s),
    // but the dummy is being killed by mercs too, so give it effectively unkillable hp and
    // reduce the tank's effective survival by starting it near death via repeated advances.
    const encounter = makeTestEncounter({ waves: [{ enemies: [{ name: 'Tanky', hp: 1_000_000, count: 1 }] }] });
    const engine = new CombatEngine(encounter, TEST_SPELLS);
    // 60s = 20 trash swings @ 1 dmg = exactly kills the 20-hp tank.
    engine.advance(60_000);
    expect(engine.state.party.find((u) => u.id === 'tank')!.alive).toBe(false);

    const events = engine.advance(3000); // next trash swing should now target a living DPS
    const hit = damages(events).find((d) => d.sourceId.startsWith('w0-'));
    expect(hit).toBeDefined();
    expect(['dps1', 'dps2']).toContain(hit!.targetId);
  });
});

describe('wave progression', () => {
  it('advances to the next wave once all enemies in the current wave are dead', () => {
    const encounter = makeTestEncounter({
      // Wave 2's dummy needs enough hp to survive the other mercs' swings landing in the same
      // tick that wave 1 clears (mercs don't pause when a new wave spawns mid-tick).
      waves: [{ enemies: [{ name: 'Weak', hp: 1, count: 1 }] }, { enemies: [{ name: 'Weak2', hp: 10, count: 1 }] }],
    });
    const engine = new CombatEngine(encounter, TEST_SPELLS);
    expect(engine.state.waveIndex).toBe(0);
    const events = engine.advance(3000); // tank's first swing (1 dmg) kills the 1-hp wave-1 dummy
    expect(deaths(events).some((d) => d.unitId.startsWith('w0-'))).toBe(true);
    expect(waveStarts(events).some((w) => w.waveIndex === 1)).toBe(true);
    expect(engine.state.waveIndex).toBe(1);
    expect(engine.state.enemies.every((e) => e.alive)).toBe(true);
    expect(engine.state.enemies[0]!.name).toBe('Weak2');
  });

  it('spawns the boss once the last trash wave clears', () => {
    const encounter = makeTestEncounter({
      waves: [{ enemies: [{ name: 'Weak', hp: 1, count: 1 }] }],
    });
    const engine = new CombatEngine(encounter, TEST_SPELLS);
    const events = engine.advance(3000);
    expect(waveStarts(events).some((w) => w.waveIndex === 1)).toBe(true); // waves.length === 1 -> boss phase index
    expect(engine.state.enemies).toHaveLength(1);
    expect(engine.state.enemies[0]!.role).toBe('boss');
    expect(engine.state.enemies[0]!.name).toBe('Test Boss');
  });
});

describe('Bonehowl (boss cast)', () => {
  it('deals party damage to every living member exactly when the 10s cast completes', () => {
    // Boss hp set high enough that merc auto-attacks don't kill it before the cast lands.
    const encounter = makeTestEncounter({
      waves: [{ enemies: [{ name: 'Weak', hp: 1, count: 1 }] }],
      boss: {
        id: 'test-boss',
        name: 'Test Boss',
        hp: 1000,
        autoDamage: 2,
        swingIntervalMs: 3000,
        cast: { name: 'Bonehowl', castMs: 10_000, firstCastAtMs: 5000, intervalMs: 15_000, partyDamage: 4 },
      },
    });
    const engine = new CombatEngine(encounter, TEST_SPELLS);
    // Clear the single trash wave (1 dmg swing at t=3000 kills the 1hp dummy) -> boss spawns at t=3000.
    // Boss cast starts at t=3000+5000=8000, completes at t=18000.
    let events = engine.advance(8000);
    expect(events.some((e) => e.type === 'bossCastStarted')).toBe(true);
    expect(engine.state.bossCast).not.toBeNull();
    expect(engine.state.bossCast!.totalMs).toBe(10_000);

    events = engine.advance(9999); // not yet landed
    expect(events.some((e) => e.type === 'bossCastFinished')).toBe(false);
    const aliveJustBeforeLanding = engine.state.party.filter((u) => u.alive).map((u) => u.id);

    events = engine.advance(1); // exactly lands now (10_000ms after cast start)
    expect(events.some((e) => e.type === 'bossCastFinished')).toBe(true);
    // Bonehowl's signature is amount === 4 from the boss; the boss's regular 2-dmg tank auto
    // (which may also land in this same tick) is a separate event and doesn't count here.
    const bonehowlHits = damages(events).filter((d) => d.sourceId === 'test-boss' && d.amount === 4);
    for (const id of aliveJustBeforeLanding) {
      expect(bonehowlHits.some((d) => d.targetId === id)).toBe(true);
    }
    expect(engine.state.bossCast).toBeNull();
  });

  it('boss keeps auto-attacking the tank while it is casting', () => {
    const encounter = makeTestEncounter({ waves: [{ enemies: [{ name: 'Weak', hp: 1, count: 1 }] }] });
    const engine = new CombatEngine(encounter, TEST_SPELLS);
    engine.advance(8000); // boss cast starts
    expect(engine.state.bossCast).not.toBeNull();
    const events = engine.advance(3000); // a boss auto-attack swing should land mid-cast
    const bossAutos = damages(events).filter((d) => d.sourceId === 'test-boss' && d.targetId === 'tank');
    expect(bossAutos.length).toBeGreaterThanOrEqual(1);
    expect(engine.state.bossCast).not.toBeNull(); // still casting, not interrupted
  });
});

describe('victory / wipe detection', () => {
  it('reports victory when the boss dies', () => {
    const encounter = makeTestEncounter({
      waves: [{ enemies: [{ name: 'Weak', hp: 1, count: 1 }] }],
      boss: { id: 'weak-boss', name: 'Weak Boss', hp: 1, autoDamage: 0, swingIntervalMs: 999_999 },
    });
    const engine = new CombatEngine(encounter, TEST_SPELLS);
    // t=3000: trash dies, boss (1hp) spawns and is killed by a merc swing within the same tick.
    const events = engine.advance(6000);
    expect(ended(events)).toEqual([{ type: 'combatEnded', status: 'victory' }]);
    expect(engine.state.status).toBe('victory');
  });

  it('reports wipe when the whole party dies, and freezes the sim after', () => {
    const encounter = makeTestEncounter({
      waves: [{ enemies: [{ name: 'Deadly', hp: 1_000_000, count: 1 }] }],
    });
    const engine = new CombatEngine(encounter, TEST_SPELLS);
    // Tank (20hp) dies at t=60_000 (20 swings @1dmg/3s). DPS (10hp each) then die at
    // +30_000 each (10 swings), sequentially since only one ally is targeted at a time.
    const events = engine.advance(200_000);
    expect(engine.state.status).toBe('wipe');
    expect(ended(events)).toEqual([{ type: 'combatEnded', status: 'wipe' }]);

    // Further advances are no-ops.
    const more = engine.advance(5000);
    expect(more).toHaveLength(0);
  });

  it('victory freezes the sim: no further events after combatEnded', () => {
    const encounter = makeTestEncounter({
      waves: [{ enemies: [{ name: 'Weak', hp: 1, count: 1 }] }],
      boss: { id: 'weak-boss', name: 'Weak Boss', hp: 1, autoDamage: 0, swingIntervalMs: 999_999 },
    });
    const engine = new CombatEngine(encounter, TEST_SPELLS);
    engine.advance(6000);
    expect(engine.state.status).toBe('victory');
    const more = engine.advance(10_000);
    expect(more).toHaveLength(0);
  });
});

describe('reward accrual', () => {
  it('grants gold + xp immediately on each kill, even counting kills from a run that later wipes', () => {
    const encounter = makeTestEncounter({
      waves: [{ enemies: [{ name: 'Weak', hp: 1, count: 2 }] }, { enemies: [{ name: 'Deadly', hp: 1_000_000, count: 1 }] }],
    });
    const engine = new CombatEngine(encounter, TEST_SPELLS);
    // Wave 1: two 1-hp dummies die quickly to mercs.
    engine.advance(6000);
    expect(engine.rewards.gold).toBe(2);
    expect(engine.rewards.xp).toBe(2);

    // Wave 2 is unkillable in reasonable time and eventually wipes the party — rewards from
    // the wave-1 kills must still be retained after the wipe.
    engine.advance(200_000);
    expect(engine.state.status).toBe('wipe');
    expect(engine.rewards.gold).toBe(2);
    expect(engine.rewards.xp).toBe(2);
  });

  it('counts the boss kill toward rewards on victory', () => {
    const encounter = makeTestEncounter({
      waves: [{ enemies: [{ name: 'Weak', hp: 1, count: 1 }] }],
      boss: { id: 'weak-boss', name: 'Weak Boss', hp: 1, autoDamage: 0, swingIntervalMs: 999_999 },
    });
    const engine = new CombatEngine(encounter, TEST_SPELLS);
    engine.advance(6000);
    expect(engine.state.status).toBe('victory');
    expect(engine.rewards.gold).toBe(2); // 1 trash + 1 boss
    expect(engine.rewards.xp).toBe(2);
  });
});

describe('determinism', () => {
  it('produces an identical event log for the same inputs regardless of dt chunking', () => {
    const encounter = makeTestEncounter({ waves: [{ enemies: [{ name: 'Weak', hp: 1, count: 1 }] }] });

    const engineA = new CombatEngine(encounter, TEST_SPELLS);
    const logA: CombatEvent[] = [];
    logA.push(...engineA.advance(20_000));

    const engineB = new CombatEngine(encounter, TEST_SPELLS);
    const logB: CombatEvent[] = [];
    for (let i = 0; i < 20_000; i += 16) {
      logB.push(...engineB.advance(16));
    }

    expect(logA).toEqual(logB);
    expect(engineA.state).toEqual(engineB.state);
    expect(engineA.rewards).toEqual(engineB.rewards);
  });
});
