/**
 * v0.3 §Coyote — the 250ms grace window after lethal damage (see README
 * "Dying state"). A downed party member is still a valid heal target; a heal
 * completing inside the window saves them, an unsaved expiry finalizes death.
 */
import { describe, expect, it } from 'vitest';
import { CombatEngine } from './engine';
import { COYOTE_MS } from '../data/constants';
import { makeTestEncounter, TEST_MINOR_SPELL, TEST_SOLEMN_MEND } from './testFixtures';
import type { CombatEvent, EncounterDef } from './types';

const KIT = [TEST_SOLEMN_MEND, TEST_MINOR_SPELL];

/** One unkillable enemy that one-shots the tank on its first swing at `swingIntervalMs`. */
function lethalEncounter(swingIntervalMs: number): EncounterDef {
  return makeTestEncounter({
    waves: [{ enemies: [{ name: 'Executioner', hp: 1_000_000, count: 1, autoDamage: 99, swingIntervalMs }] }],
  });
}

function ofType<T extends CombatEvent['type']>(events: CombatEvent[], type: T) {
  return events.filter((e): e is Extract<CombatEvent, { type: T }> => e.type === type);
}

describe('coyote-time grace window', () => {
  it('lethal damage downs a party member (unitDying) without killing them', () => {
    const engine = new CombatEngine(lethalEncounter(3000), KIT);
    const events = engine.advance(3000); // first swing lands exactly at t=3000

    const dying = ofType(events, 'unitDying');
    expect(dying).toHaveLength(1);
    expect(dying[0]).toEqual({ type: 'unitDying', unitId: 'tank', coyoteMs: COYOTE_MS });
    expect(ofType(events, 'unitDied')).toHaveLength(0);

    const tank = engine.state.party.find((u) => u.id === 'tank')!;
    expect(tank.alive).toBe(true);
    expect(tank.dying).toBe(true);
    expect(tank.hp).toBe(0);
  });

  it('a heal completing inside the window saves the unit; the in-flight cast is never cancelled', () => {
    const engine = new CombatEngine(lethalEncounter(3000), KIT);
    engine.advance(2700);
    engine.setTarget('tank');
    engine.castSpell(TEST_MINOR_SPELL.id); // 500ms cast: completes t=3200, inside the 3000..3250 window

    const events = engine.advance(2300); // through t=5000
    expect(ofType(events, 'castCancelled')).toHaveLength(0); // entering dying never cancels the cast
    expect(ofType(events, 'unitDying')).toHaveLength(1);

    const saved = ofType(events, 'unitSaved');
    expect(saved).toEqual([{ type: 'unitSaved', unitId: 'tank' }]);
    expect(ofType(events, 'unitDied')).toHaveLength(0);

    const tank = engine.state.party.find((u) => u.id === 'tank')!;
    expect(tank.alive).toBe(true);
    expect(tank.dying).toBe(false);
    expect(tank.hp).toBe(TEST_MINOR_SPELL.heal); // healed up from 0
  });

  it('an unsaved expiry finalizes death and only then auto-cancels a cast on the target (target-dead, refund)', () => {
    const engine = new CombatEngine(lethalEncounter(3000), KIT);
    engine.advance(2000);
    const manaBefore = engine.state.party.find((u) => u.id === 'healer')!.mana;
    engine.setTarget('tank');
    engine.castSpell(TEST_SOLEMN_MEND.id); // 2000ms cast: would complete t=4000, past the window

    const events = engine.advance(2000); // through t=4000; window expires unsaved at t=3250
    const died = ofType(events, 'unitDied');
    expect(died).toEqual([{ type: 'unitDied', unitId: 'tank' }]);

    const cancelled = ofType(events, 'castCancelled');
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0]!.reason).toBe('target-dead');
    // Death resolved before the cancel it caused, and the reserved mana came back.
    expect(events.indexOf(died[0]!)).toBeLessThan(events.indexOf(cancelled[0]!));
    expect(engine.state.party.find((u) => u.id === 'healer')!.mana).toBe(manaBefore);
  });

  it('dying units take no further damage and are skipped by enemy target selection', () => {
    // 200ms swings: tank downed t=200 (window to 450); the t=400 swing must skip the
    // still-dying tank and hit dps1 instead, dealing the tank no additional damage.
    const engine = new CombatEngine(lethalEncounter(200), KIT);
    const events = engine.advance(400);

    const tankHits = ofType(events, 'damage').filter((d) => d.targetId === 'tank');
    expect(tankHits).toHaveLength(1); // only the t=200 down — nothing after
    const secondSwing = ofType(events, 'damage').filter((d) => d.sourceId.startsWith('w0-') && d.targetId !== 'tank');
    expect(secondSwing).toHaveLength(1);
    expect(secondSwing[0]!.targetId).toBe('dps1');
    expect(ofType(events, 'unitDying').map((e) => e.unitId)).toEqual(['tank', 'dps1']);
  });

  it('a wipe resolves only after the LAST party member’s window expires', () => {
    // Cascade: tank 200, dps1 400, dps2 600, healer 800 → wipe at 800 + 250 = 1050.
    const engine = new CombatEngine(lethalEncounter(200), KIT);
    const until1049 = engine.advance(1049);
    expect(ofType(until1049, 'combatEnded')).toHaveLength(0);
    expect(engine.state.status).toBe('running');

    const atExpiry = engine.advance(1);
    expect(ofType(atExpiry, 'combatEnded')).toEqual([{ type: 'combatEnded', status: 'wipe' }]);
    expect(ofType(atExpiry, 'unitDied').map((e) => e.unitId)).toContain('healer');
  });

  it('event log is identical regardless of how advance() is chunked across window boundaries', () => {
    const run = (dtChunks: number[]): CombatEvent[] => {
      const engine = new CombatEngine(lethalEncounter(200), KIT);
      const log: CombatEvent[] = [];
      for (const dt of dtChunks) log.push(...engine.advance(dt));
      return log;
    };
    const oneShot = run([2000]);
    const fine = run(Array.from({ length: 200 }, () => 10));
    const uneven = run([199, 2, 48, 251, 1500]);
    expect(fine).toEqual(oneShot);
    expect(uneven).toEqual(oneShot);
  });
});
