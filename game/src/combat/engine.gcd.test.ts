import { describe, expect, it } from 'vitest';
import { CombatEngine } from './engine';
import { makeTestEncounter, TEST_SOLEMN_MEND, TEST_SPELLS, TEST_ZEALOUS_MENDING } from './testFixtures';
import type { CombatEvent } from './types';

function heals(events: CombatEvent[]): Extract<CombatEvent, { type: 'heal' }>[] {
  return events.filter((e): e is Extract<CombatEvent, { type: 'heal' }> => e.type === 'heal');
}
function casts(events: CombatEvent[]): Extract<CombatEvent, { type: 'castStarted' }>[] {
  return events.filter((e): e is Extract<CombatEvent, { type: 'castStarted' }> => e.type === 'castStarted');
}

describe('GCD / cast busy timing', () => {
  it('busy time is max(castMs, GCD): Solemn Mend (2000ms cast) blocks a second cast until it completes', () => {
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS);
    engine.setTarget('tank');
    engine.castSpell(TEST_SOLEMN_MEND.id); // starts immediately

    // Attempting to cast again mid-cast just queues it (no second castStarted yet).
    engine.castSpell(TEST_SOLEMN_MEND.id);
    let events = engine.advance(1900);
    expect(casts(events)).toHaveLength(1); // only the original cast-start (flushed on first advance)
    expect(heals(events)).toHaveLength(0);

    events = engine.advance(200); // crosses the 2000ms mark -> first cast resolves, queued one starts
    expect(heals(events)).toHaveLength(1);
    expect(casts(events)).toHaveLength(1); // the queued cast starting
  });

  it('a 1000ms cast (== GCD) is still busy for exactly 1000ms, not longer', () => {
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS);
    engine.setTarget('tank');
    engine.castSpell(TEST_ZEALOUS_MENDING.id);
    const events = engine.advance(999);
    expect(heals(events)).toHaveLength(0);
    expect(engine.state.playerCast).not.toBeNull();

    const events2 = engine.advance(1);
    expect(heals(events2)).toHaveLength(1);
    expect(engine.state.playerCast).toBeNull();
    expect(engine.state.gcdRemainingMs).toBe(0);
  });

  it('queue: only one queued spell is kept, re-queuing replaces it', () => {
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS);
    engine.setTarget('tank');
    engine.castSpell(TEST_SOLEMN_MEND.id); // busy for 2000ms
    engine.castSpell(TEST_ZEALOUS_MENDING.id); // queued
    engine.castSpell(TEST_SOLEMN_MEND.id); // replaces queue with solemn mend again

    const events = engine.advance(2000);
    const started = casts(events);
    // started[0] is the original cast-start (flushed from pending); started[1] is the queued
    // one firing once busy ends — it must be the replacement (solemn mend), not zealous mending.
    expect(started).toHaveLength(2);
    expect(started[1]!.cast.spellId).toBe(TEST_SOLEMN_MEND.id);
  });

  it('an illegal command while busy is dropped without clobbering an existing queue', () => {
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS);
    engine.setTarget('tank');
    engine.castSpell(TEST_SOLEMN_MEND.id); // busy for 2000ms
    engine.castSpell(TEST_ZEALOUS_MENDING.id); // queued
    engine.castSpell('unknown-spell-id'); // illegal (unknown spell) — must be dropped, not queued

    const events = engine.advance(2000);
    const started = casts(events);
    expect(started[1]!.cast.spellId).toBe(TEST_ZEALOUS_MENDING.id);
  });

  it('a legally-queued cast fires as soon as the current cast frees up the GCD', () => {
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS);
    engine.setTarget('tank');
    engine.castSpell(TEST_SOLEMN_MEND.id);
    engine.castSpell(TEST_ZEALOUS_MENDING.id);
    const events = engine.advance(2000);
    expect(casts(events).some((c) => c.cast.spellId === TEST_ZEALOUS_MENDING.id)).toBe(true);
    expect(heals(events)).toHaveLength(1); // only the first cast has resolved so far
  });
});

describe('mana', () => {
  it('reserves mana the instant a cast starts (Phase 3); completion does not spend again', () => {
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS);
    engine.setTarget('tank');
    engine.castSpell(TEST_SOLEMN_MEND.id);
    expect(engine.state.party.find((u) => u.id === 'healer')!.mana).toBe(15); // reserved immediately: 20 - 5
    engine.advance(2000);
    expect(engine.state.party.find((u) => u.id === 'healer')!.mana).toBe(15); // unchanged on completion — no double-spend
  });

  it('rejects (silently ignores) a cast when mana is insufficient', () => {
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS);
    engine.setTarget('tank');
    // Drain mana: 20 / 5 = 4 Solemn Mends exactly empties the healer.
    for (let i = 0; i < 4; i++) {
      engine.castSpell(TEST_SOLEMN_MEND.id);
      engine.advance(2000);
    }
    expect(engine.state.party.find((u) => u.id === 'healer')!.mana).toBe(0);

    engine.castSpell(TEST_SOLEMN_MEND.id); // OOM -> ignored, no cast starts
    const events = engine.advance(2000);
    expect(casts(events)).toHaveLength(0);
    expect(engine.state.playerCast).toBeNull();
  });

  it('a queued cast is dropped (silently) if mana runs out before it fires', () => {
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS);
    engine.setTarget('tank');
    // Spend down to exactly 5 mana left via 3 Solemn Mends (20 -> 5).
    for (let i = 0; i < 3; i++) {
      engine.castSpell(TEST_SOLEMN_MEND.id);
      engine.advance(2000);
    }
    expect(engine.state.party.find((u) => u.id === 'healer')!.mana).toBe(5);

    // Queue a Solemn Mend (5 mana, legal right now) behind a Zealous Mending (8 mana) that will
    // consume the remaining mana down to -3 clamped to 0 on completion, leaving 0 for the queued spell.
    engine.castSpell(TEST_ZEALOUS_MENDING.id); // starts immediately: costs 8 but only 5 available
    // Zealous Mending itself should have been rejected (OOM) since 5 < 8:
    expect(engine.state.playerCast).toBeNull();

    // Now legally start Solemn Mend (5 mana exactly) then queue another Solemn Mend behind it.
    engine.castSpell(TEST_SOLEMN_MEND.id);
    engine.castSpell(TEST_SOLEMN_MEND.id); // queued
    const events = engine.advance(2000);
    expect(engine.state.party.find((u) => u.id === 'healer')!.mana).toBe(0);
    // Queued cast should have been dropped silently (OOM by the time it would fire).
    expect(engine.state.playerCast).toBeNull();
    expect(casts(events)).toHaveLength(1); // only the immediate one
  });
});

describe('overheal', () => {
  it('clamps heal amount to missing hp and reports overheal separately', () => {
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS);
    engine.setTarget('tank'); // tank at full hp (20/20)
    engine.castSpell(TEST_SOLEMN_MEND.id); // heal 5, target already full
    const events = engine.advance(2000);
    const heal = heals(events)[0]!;
    expect(heal.amount).toBe(0);
    expect(heal.overheal).toBe(5);
    expect(engine.state.party.find((u) => u.id === 'tank')!.hp).toBe(20);
  });

  it('applies a partial heal + partial overheal when close to max hp', () => {
    // High-hp dummy so it survives to deliver its own 3000ms auto-attack on the tank rather than
    // dying to merc dps first (a low-hp wave-1 dummy now dies well before its own first swing
    // under the Phase 3 per-role merc cadence — see the auto-attack cadence tests above).
    const encounter = makeTestEncounter({ waves: [{ enemies: [{ name: 'Dummy', hp: 999, count: 1 }] }] });
    const engine = new CombatEngine(encounter, TEST_SPELLS);
    const tank = engine.state.party.find((u) => u.id === 'tank')!;
    // Can't mutate state directly (read-only snapshot) — instead verify via a target with headroom
    // exactly less than the heal amount: dps has 10 max hp, so it's always at/above heal-5 headroom;
    // use two heals on tank isn't damaging either. Simplest: damage the tank first via enemy auto-attack,
    // then heal for more than the deficit.
    void tank;
    engine.setTarget('tank');
    // Let the trash dummy hit the tank once (dummy auto: default TRASH damage from constants via engine).
    engine.advance(3000); // one trash swing lands on tank
    const hpAfterHit = engine.state.party.find((u) => u.id === 'tank')!.hp;
    expect(hpAfterHit).toBeLessThan(20);
    const missing = 20 - hpAfterHit;

    engine.castSpell(TEST_SOLEMN_MEND.id); // heal 5
    const events = engine.advance(2000);
    const heal = heals(events)[0]!;
    expect(heal.amount).toBe(Math.min(5, missing));
    expect(heal.overheal).toBe(5 - Math.min(5, missing));
    expect(engine.state.party.find((u) => u.id === 'tank')!.hp).toBe(20);
  });
});

describe('target switching', () => {
  it('setTarget changes who the next cast heals', () => {
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS);
    engine.setTarget('dps1');
    engine.advance(3000); // let a trash swing land on the tank (dps1 untouched, still full)
    engine.castSpell(TEST_SOLEMN_MEND.id);
    const events = engine.advance(2000);
    const heal = heals(events)[0]!;
    expect(heal.targetId).toBe('dps1');
  });

  it('ignores setTarget for unknown or dead units, keeping the previous target', () => {
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS);
    engine.setTarget('tank');
    engine.setTarget('nonexistent-unit');
    expect(engine.state.targetId).toBe('tank');
  });

  it('ignores setTarget for enemy units (allies only)', () => {
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS);
    engine.setTarget('tank');
    const enemyId = engine.state.enemies[0]!.id;
    engine.setTarget(enemyId);
    expect(engine.state.targetId).toBe('tank');
  });
});
