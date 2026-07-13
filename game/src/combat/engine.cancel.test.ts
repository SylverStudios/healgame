import { describe, expect, it } from 'vitest';
import { CombatEngine } from './engine';
import { GCD_MS } from '../data/constants';
import { GATE_WARDEN_MOB } from '../data/mobs';
import {
  makeTestEncounter,
  TEST_MINOR_SPELL,
  TEST_SOLEMN_MEND,
  TEST_SPELLS,
  TEST_ZEALOUS_MENDING,
} from './testFixtures';
import type { CombatEvent } from './types';

/**
 * Phase 3 handoff §D: mana reserve/refund + cancelCast + mid-cast target-death
 * auto-cancel, and §B: per-role swing cadence. Chunk 1 "what's left" items 1-3.
 */

function heals(events: CombatEvent[]): Extract<CombatEvent, { type: 'heal' }>[] {
  return events.filter((e): e is Extract<CombatEvent, { type: 'heal' }> => e.type === 'heal');
}
function casts(events: CombatEvent[]): Extract<CombatEvent, { type: 'castStarted' }>[] {
  return events.filter((e): e is Extract<CombatEvent, { type: 'castStarted' }> => e.type === 'castStarted');
}
function cancels(events: CombatEvent[]): Extract<CombatEvent, { type: 'castCancelled' }>[] {
  return events.filter((e): e is Extract<CombatEvent, { type: 'castCancelled' }> => e.type === 'castCancelled');
}
function damages(events: CombatEvent[]): Extract<CombatEvent, { type: 'damage' }>[] {
  return events.filter((e): e is Extract<CombatEvent, { type: 'damage' }> => e.type === 'damage');
}
function healerMana(engine: CombatEngine): number {
  return engine.state.party.find((u) => u.id === 'healer')!.mana;
}

describe('mana reserve/refund (Phase 3 handoff §D)', () => {
  it('reserves (debits) mana the instant a cast starts, not on completion', () => {
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS);
    engine.setTarget('tank');
    const before = healerMana(engine);
    engine.castSpell(TEST_SOLEMN_MEND.id);
    expect(healerMana(engine)).toBe(before - TEST_SOLEMN_MEND.mana);
  });

  it('does not double-spend mana when the cast completes', () => {
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS);
    engine.setTarget('tank');
    engine.castSpell(TEST_SOLEMN_MEND.id);
    const afterReserve = healerMana(engine);
    engine.advance(TEST_SOLEMN_MEND.castMs);
    expect(healerMana(engine)).toBe(afterReserve);
  });

  it('refunds reserved mana on an escape cancel (cancelCast) and emits castCancelled', () => {
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS);
    engine.setTarget('tank');
    const before = healerMana(engine);
    engine.castSpell(TEST_SOLEMN_MEND.id);
    expect(healerMana(engine)).toBe(before - TEST_SOLEMN_MEND.mana);

    engine.cancelCast();
    const events = engine.advance(100);
    expect(cancels(events)).toEqual([{ type: 'castCancelled', spellId: 'solemn-mend', reason: 'escape' }]);
    expect(healerMana(engine)).toBe(before);
    expect(engine.state.playerCast).toBeNull();
    expect(heals(events)).toHaveLength(0);
  });

  it('refunds reserved mana when the cast target dies mid-cast, same tick as unitDied', () => {
    const encounter = makeTestEncounter({ waves: [{ enemies: [{ name: 'Dummy', hp: 999, count: 1 }] }] });
    const engine = new CombatEngine(encounter, TEST_SPELLS);
    // Bring the tank (maxHp 20) to 1 hp via 19 trash swings (19*3000=57000ms), then a further
    // partial 1500ms so the next swing is exactly 1500ms away (well inside the 2000ms cast below).
    engine.advance(57000);
    engine.advance(1500);
    const before = healerMana(engine);
    engine.setTarget('tank');
    engine.castSpell(TEST_SOLEMN_MEND.id);
    expect(healerMana(engine)).toBe(before - TEST_SOLEMN_MEND.mana);

    const events = engine.advance(2000); // trash's next swing (at +1500ms) kills the tank mid-cast
    const diedIdx = events.findIndex((e) => e.type === 'unitDied' && e.unitId === 'tank');
    const cancelIdx = events.findIndex((e) => e.type === 'castCancelled' && e.reason === 'target-dead');
    expect(diedIdx).toBeGreaterThanOrEqual(0);
    expect(cancelIdx).toBeGreaterThanOrEqual(0);
    // Same-tick delivery: both events land in this one advance() call, death immediately
    // followed (or accompanied) by the cancel — order asserted loosely (index >= 0 above),
    // strictly here: cancel never precedes the death that caused it.
    expect(cancelIdx).toBeGreaterThanOrEqual(diedIdx);
    expect(events.some((e) => e.type === 'castFinished')).toBe(false);
    expect(heals(events)).toHaveLength(0);
    expect(healerMana(engine)).toBe(before); // refunded, not spent
  });
});

describe('cancelCast API', () => {
  it('clears both the active cast and any queued cast', () => {
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS);
    engine.setTarget('tank');
    engine.castSpell(TEST_SOLEMN_MEND.id); // active
    engine.castSpell(TEST_ZEALOUS_MENDING.id); // queued
    engine.cancelCast();
    const events = engine.advance(5000); // long enough that the queued cast would've fired if not cleared
    // The original cast legitimately started (castStarted was buffered before the cancel) and was
    // then cancelled — but the queued zealous-mending must never fire (only 1 castStarted total).
    expect(casts(events)).toHaveLength(1);
    expect(cancels(events)).toHaveLength(1);
    expect(engine.state.playerCast).toBeNull();
    expect(heals(events)).toHaveLength(0);
  });

  it('with only a queue entry (no active cast): clears it silently — no refund, no event', () => {
    const spells = [...TEST_SPELLS, TEST_MINOR_SPELL];
    const engine = new CombatEngine(makeTestEncounter(), spells);
    engine.setTarget('tank');
    engine.castSpell(TEST_MINOR_SPELL.id); // 500ms cast, well under the 1000ms GCD
    engine.advance(500); // cast completes; playerCast is null, but gcdRemainingMs (500ms) keeps busy=true
    expect(engine.state.playerCast).toBeNull();

    engine.castSpell(TEST_SOLEMN_MEND.id); // busy (GCD tail) -> queued, no active cast exists
    const manaBefore = healerMana(engine);
    engine.cancelCast(); // queue-only path: silent, no refund, no event
    const events = engine.advance(1000);
    expect(cancels(events)).toHaveLength(0);
    expect(casts(events)).toHaveLength(0); // the queued solemn-mend never fires
    expect(healerMana(engine)).toBe(manaBefore); // nothing was reserved for a queued (never-started) cast
  });

  it('is a no-op when nothing is active or queued', () => {
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS);
    expect(() => engine.cancelCast()).not.toThrow();
    const events = engine.advance(100);
    expect(cancels(events)).toHaveLength(0);
  });
});

describe('cancelled casts and synergy arming', () => {
  it('an escape-cancelled trigger cast does not arm its synergy', () => {
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS, {
      synergies: [{ triggerSpellId: 'solemn-mend', buffedSpellId: 'zealous-mending', bonusHeal: 4 }],
    });
    engine.setTarget('tank');
    engine.castSpell(TEST_SOLEMN_MEND.id); // trigger spell, active
    engine.cancelCast(); // escape before it completes
    // cancelCast clears the cast but the GCD it started keeps running (documented behavior) —
    // let it fully expire before casting again.
    engine.advance(GCD_MS);
    expect(engine.state.armedBuffedSpellIds).not.toContain('zealous-mending');

    // Confirm via a live buffed cast: no bonus was armed.
    engine.setTarget('tank');
    engine.castSpell(TEST_ZEALOUS_MENDING.id);
    const events = engine.advance(TEST_ZEALOUS_MENDING.castMs);
    const heal = heals(events)[0]!;
    expect(heal.amount + heal.overheal).toBe(TEST_ZEALOUS_MENDING.heal);
  });

  it('a target-dead-cancelled trigger cast does not arm its synergy', () => {
    const encounter = makeTestEncounter({ waves: [{ enemies: [{ name: 'Dummy', hp: 999, count: 1 }] }] });
    const engine = new CombatEngine(encounter, TEST_SPELLS, {
      synergies: [{ triggerSpellId: 'solemn-mend', buffedSpellId: 'zealous-mending', bonusHeal: 4 }],
    });
    engine.advance(57000);
    engine.advance(1500);
    engine.setTarget('tank');
    engine.castSpell(TEST_SOLEMN_MEND.id);
    engine.advance(2000); // trash kills the tank mid-cast -> auto-cancel
    expect(engine.state.armedBuffedSpellIds).not.toContain('zealous-mending');
  });
});

describe('armedBuffedSpellIds lifecycle', () => {
  it('starts empty, is armed after the trigger completes, and is removed after the buffed cast consumes it', () => {
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS, {
      synergies: [{ triggerSpellId: 'solemn-mend', buffedSpellId: 'zealous-mending', bonusHeal: 4 }],
    });
    expect(engine.state.armedBuffedSpellIds).toEqual([]);

    engine.setTarget('tank');
    engine.castSpell(TEST_SOLEMN_MEND.id);
    engine.advance(TEST_SOLEMN_MEND.castMs);
    expect(engine.state.armedBuffedSpellIds).toEqual(['zealous-mending']);

    engine.castSpell(TEST_ZEALOUS_MENDING.id);
    engine.advance(TEST_ZEALOUS_MENDING.castMs);
    expect(engine.state.armedBuffedSpellIds).toEqual([]);
  });
});

describe('per-role swing cadence (Phase 3 handoff §B)', () => {
  it('tank (2500ms) and dps (1000ms) fire at different times; the two dps mercs sync with each other', () => {
    const encounter = makeTestEncounter({ waves: [{ enemies: [{ name: 'Tanky', hp: 999, count: 1 }] }] });
    const engine = new CombatEngine(encounter, TEST_SPELLS);

    const first = engine.advance(1000); // both dps mercs' first swing; tank not due until 2500ms
    const dpsHits = damages(first).filter((d) => d.sourceId === 'dps1' || d.sourceId === 'dps2');
    expect(dpsHits).toHaveLength(2); // dps1 and dps2 swing in sync with each other
    expect(damages(first).some((d) => d.sourceId === 'tank')).toBe(false);

    const untilTank = engine.advance(1500); // crosses t=2500
    expect(damages(untilTank).some((d) => d.sourceId === 'tank')).toBe(true);
  });

  it('trash (3000ms) fires on a different cadence than either merc role', () => {
    const encounter = makeTestEncounter({ waves: [{ enemies: [{ name: 'Tanky', hp: 999, count: 1 }] }] });
    const engine = new CombatEngine(encounter, TEST_SPELLS);
    const early = engine.advance(2999); // just before the trash's first swing
    expect(damages(early).some((d) => d.targetId === 'tank' && d.sourceId.startsWith('w0-'))).toBe(false);
    const onTime = engine.advance(1); // crosses t=3000
    expect(damages(onTime).some((d) => d.targetId === 'tank' && d.sourceId.startsWith('w0-'))).toBe(true);
  });

  it('boss swing cadence (Gate Warden 3500ms) differs from trash cadence (3000ms)', () => {
    const encounter = makeTestEncounter({
      waves: [{ enemies: [{ name: 'Weak', hp: 1, count: 1 }] }],
      boss: {
        id: 'test-boss',
        name: 'Test Boss',
        hp: 999,
        autoDamage: 2,
        swingIntervalMs: GATE_WARDEN_MOB.swingIntervalMs,
      },
    });
    const engine = new CombatEngine(encounter, TEST_SPELLS);
    // dps1's first swing (t=1000, 2dmg) kills the 1hp dummy -> boss spawns at t=1000. Its first
    // auto-attack lands swingIntervalMs (3500ms) later, at t=4500 — not t=4000 (a 3000ms cadence).
    const early = engine.advance(4499);
    expect(damages(early).some((d) => d.sourceId === 'test-boss')).toBe(false);
    const onTime = engine.advance(1);
    expect(damages(onTime).some((d) => d.sourceId === 'test-boss')).toBe(true);
  });
});
