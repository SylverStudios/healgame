/**
 * Boss-phase hard enrage: when bossPhaseElapsedMs >= enrageAtMs and the boss
 * is still alive, the engine emits an `enrage` event then immediately ends the
 * fight as a wipe (combatEnded status: wipe). No party deaths required.
 *
 * Tests use tiny synthetic encounters so timing math is exact.
 */
import { describe, expect, it } from 'vitest';
import { CombatEngine } from './engine';
import type { BossDef, CombatEvent, EncounterDef } from './types';

// Minimal single-trash-wave encounter so the boss spawns after one swing.
function makeEnrageEncounter(bossOverrides: Partial<BossDef> = {}): EncounterDef {
  return {
    id: 'enrage-test',
    name: 'Enrage Test',
    waves: [
      // One very-low-hp trash enemy — killed instantly by dps1's first auto (t=1000ms)
      { enemies: [{ name: 'Fodder', hp: 1, count: 1, autoDamage: 0, swingIntervalMs: 9_999_999 }] },
    ],
    boss: {
      id: 'steel-sentinel',
      name: 'Steel Sentinel',
      hp: 999_999,   // effectively unkillable by mercs alone
      autoDamage: 0,
      swingIntervalMs: 9_999_999,
      ...bossOverrides,
    },
  };
}

function enrageEvents(events: CombatEvent[]): Extract<CombatEvent, { type: 'enrage' }>[] {
  return events.filter((e): e is Extract<CombatEvent, { type: 'enrage' }> => e.type === 'enrage');
}
function endEvents(events: CombatEvent[]): Extract<CombatEvent, { type: 'combatEnded' }>[] {
  return events.filter(
    (e): e is Extract<CombatEvent, { type: 'combatEnded' }> => e.type === 'combatEnded',
  );
}

// Boss spawns at t=1000ms (dps1's first swing kills the 1-hp fodder).
const BOSS_SPAWN_MS = 1_000;

describe('Boss-phase hard enrage', () => {
  it('no enrageAtMs → never enrages; enrageRemainingMs is null throughout', () => {
    const engine = new CombatEngine(makeEnrageEncounter(), []);
    // Start of combat: trash wave, boss not yet out.
    expect(engine.state.enrageRemainingMs).toBeNull();

    // Run past the boss spawn and deep into boss phase.
    const events = engine.advance(BOSS_SPAWN_MS + 120_000);
    expect(enrageEvents(events)).toHaveLength(0);
    // With no enrageAtMs, enrageRemainingMs is still null in boss phase.
    expect(engine.state.enrageRemainingMs).toBeNull();
    // Combat is still running (unkillable boss, no party deaths from autoDamage: 0).
    expect(engine.state.status).toBe('running');
  });

  it('short enrageAtMs with unkillable boss → wipe with enrage event, then combatEnded', () => {
    const ENRAGE_AT = 1_000; // 1s after boss spawns
    const engine = new CombatEngine(makeEnrageEncounter({ enrageAtMs: ENRAGE_AT }), []);

    // Advance past trash kill and far enough into boss phase to trigger enrage.
    // Boss spawns at t=1000; enrage at bossPhaseElapsed=1000 → t=2000 total.
    const events = engine.advance(BOSS_SPAWN_MS + ENRAGE_AT + 100);

    const enrages = enrageEvents(events);
    expect(enrages).toHaveLength(1);
    expect(enrages[0]!.sourceId).toBe('steel-sentinel');

    const ends = endEvents(events);
    expect(ends).toHaveLength(1);
    expect(ends[0]!.status).toBe('wipe');

    // enrage always precedes combatEnded in the event list.
    const enrageIdx = events.indexOf(enrages[0]!);
    const endIdx = events.indexOf(ends[0]!);
    expect(enrageIdx).toBeLessThan(endIdx);

    expect(engine.state.status).toBe('wipe');
  });

  it('enrageRemainingMs counts down during boss phase and reaches 0 on enrage', () => {
    const ENRAGE_AT = 5_000;
    const engine = new CombatEngine(makeEnrageEncounter({ enrageAtMs: ENRAGE_AT }), []);

    // During trash wave: null.
    expect(engine.state.enrageRemainingMs).toBeNull();

    // Kill trash (boss spawns at t=1000).
    engine.advance(BOSS_SPAWN_MS);
    expect(engine.state.status).toBe('running');
    // Boss has just spawned: elapsed=0, remaining=enrageAt.
    expect(engine.state.enrageRemainingMs).toBe(ENRAGE_AT);

    // Advance 2s into boss phase.
    engine.advance(2_000);
    const remaining = engine.state.enrageRemainingMs;
    expect(remaining).not.toBeNull();
    expect(remaining!).toBeLessThan(ENRAGE_AT);
    expect(remaining!).toBeGreaterThan(0);

    // Advance to exactly the enrage deadline.
    engine.advance(remaining!);
    expect(engine.state.enrageRemainingMs).toBe(0);
    expect(engine.state.status).toBe('wipe');
  });

  it('killing boss before enrage → victory, no enrage event', () => {
    const ENRAGE_AT = 60_000;
    // Low-hp boss that mercs can actually kill quickly.
    const engine = new CombatEngine(
      makeEnrageEncounter({ hp: 6, enrageAtMs: ENRAGE_AT }),
      [],
    );

    // Run long enough for mercs to kill the boss.
    const events = engine.advance(BOSS_SPAWN_MS + 30_000);

    expect(enrageEvents(events)).toHaveLength(0);
    const ends = endEvents(events);
    expect(ends).toHaveLength(1);
    expect(ends[0]!.status).toBe('victory');
    expect(engine.state.status).toBe('victory');
  });

  it('enrage timer does not advance during trash waves', () => {
    const ENRAGE_AT = 2_000;
    // Even with a very short enrageAtMs, it must not fire while trash is alive.
    const engine = new CombatEngine(
      // Use a very tough trash mob that stays alive much longer than enrageAtMs.
      {
        id: 'enrage-trash-test',
        name: 'Enrage Trash Test',
        waves: [
          { enemies: [{ name: 'Tank Husk', hp: 9_999, count: 1, autoDamage: 0, swingIntervalMs: 9_999_999 }] },
        ],
        boss: {
          id: 'steel-sentinel',
          name: 'Steel Sentinel',
          hp: 999_999,
          autoDamage: 0,
          swingIntervalMs: 9_999_999,
          enrageAtMs: ENRAGE_AT,
        },
      },
      [],
    );

    // Advance well past where enrage would have fired if the timer ran during trash.
    const events = engine.advance(ENRAGE_AT * 10);
    expect(enrageEvents(events)).toHaveLength(0);
    expect(engine.state.status).toBe('running');
    // Timer is null because boss hasn't spawned yet.
    expect(engine.state.enrageRemainingMs).toBeNull();
  });
});
