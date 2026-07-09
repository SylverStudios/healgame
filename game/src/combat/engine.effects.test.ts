import { describe, expect, it } from 'vitest';
import { CombatEngine } from './engine';
import { GCD_MS } from '../data/constants';
import {
  makeTestEncounter,
  TEST_MINOR_SPELL,
  TEST_SOLEMN_MEND,
  TEST_SPELLS,
  TEST_ZEALOUS_MENDING,
} from './testFixtures';
import type { CombatEvent, EncounterDef } from './types';

/**
 * Chunk 1 (phase-2-handoff "Engine"): constructor options for synergy and
 * missing-health heal bonuses. Locked semantics under test:
 *  - synergy: a completed trigger cast arms the buff (re-arming replaces,
 *    never stacks); the next completed buffed cast consumes it, adding
 *    +bonusHeal to the heal's raw value. Armed state persists across
 *    intervening non-matching casts until consumed.
 *  - a trigger cast on a target that dies mid-cast still arms (mana spent,
 *    no heal event). A buffed cast on a dead target has no heal event, so
 *    the armed buff is NOT consumed (kept for the next live cast).
 *  - multiple synergy entries are independent; a matching buffed cast
 *    consumes and sums ALL currently-armed entries.
 *  - missing-health: +healPer10PctMissing per full 10% of the target's
 *    missing HP, computed on hp *before* this heal lands, integer math,
 *    boundary-exact (floor, not round).
 *  - both bonus kinds stack additively on the same cast.
 *  - overheal split always holds: amount + overheal === raw.
 *  - options omitted behaves exactly like Phase 1 (regression).
 *
 * A single trash enemy with very high HP (never dies to merc auto-attacks
 * within these test windows) stands in for a scripted damage source: its
 * fixed TRASH.autoDamage (1) lands on the tank every fixed 3000ms swing
 * (poc-spec's tank-priority targeting), giving fully deterministic,
 * hand-computed HP values without needing any randomness.
 */

const NEVER_DYING_TRASH_ENCOUNTER: EncounterDef = makeTestEncounter({
  waves: [{ enemies: [{ name: 'Dummy', hp: 999, count: 1 }] }],
});

function heals(events: CombatEvent[]): Extract<CombatEvent, { type: 'heal' }>[] {
  return events.filter((e): e is Extract<CombatEvent, { type: 'heal' }> => e.type === 'heal');
}

/** Asserts exactly one heal event occurred and returns it. */
function onlyHeal(events: CombatEvent[]): Extract<CombatEvent, { type: 'heal' }> {
  const found = heals(events);
  expect(found).toHaveLength(1);
  return found[0] as Extract<CombatEvent, { type: 'heal' }>;
}

/**
 * Cast `spellId` on `targetId` (healer must be free) and advance through its full busy window
 * — `max(castMs, GCD_MS)` (README "Busy time") — so the healer is guaranteed free again
 * afterward, even for a cast shorter than the GCD (e.g. the 500ms test-minor spell).
 */
function castAndComplete(engine: CombatEngine, targetId: string, spellId: string, castMs: number): CombatEvent[] {
  engine.setTarget(targetId);
  engine.castSpell(spellId);
  return engine.advance(Math.max(castMs, GCD_MS));
}

describe('CombatEngine effects: synergy bonus', () => {
  it('arms on a completed trigger cast and consumes on the next buffed cast (+N heal)', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, {
      synergies: [{ triggerSpellId: 'solemn-mend', buffedSpellId: 'zealous-mending', bonusHeal: 4 }],
    });
    let h = onlyHeal(castAndComplete(engine, 'tank', TEST_SOLEMN_MEND.id, TEST_SOLEMN_MEND.castMs));
    expect(h.amount + h.overheal).toBe(TEST_SOLEMN_MEND.heal); // no bonus on the trigger's own heal

    h = onlyHeal(castAndComplete(engine, 'tank', TEST_ZEALOUS_MENDING.id, TEST_ZEALOUS_MENDING.castMs));
    expect(h.amount + h.overheal).toBe(TEST_ZEALOUS_MENDING.heal + 4);
  });

  it('re-arming replaces, never stacks: two trigger casts before a consume still add the bonus once', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, {
      synergies: [{ triggerSpellId: 'solemn-mend', buffedSpellId: 'zealous-mending', bonusHeal: 4 }],
    });
    castAndComplete(engine, 'tank', TEST_SOLEMN_MEND.id, TEST_SOLEMN_MEND.castMs);
    castAndComplete(engine, 'tank', TEST_SOLEMN_MEND.id, TEST_SOLEMN_MEND.castMs);
    const h = onlyHeal(castAndComplete(engine, 'tank', TEST_ZEALOUS_MENDING.id, TEST_ZEALOUS_MENDING.castMs));
    expect(h.amount + h.overheal).toBe(TEST_ZEALOUS_MENDING.heal + 4);
  });

  it('armed buff persists across an intervening non-matching cast until consumed', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, {
      synergies: [{ triggerSpellId: 'solemn-mend', buffedSpellId: 'zealous-mending', bonusHeal: 4 }],
    });
    castAndComplete(engine, 'tank', TEST_SOLEMN_MEND.id, TEST_SOLEMN_MEND.castMs); // arms
    castAndComplete(engine, 'tank', TEST_SOLEMN_MEND.id, TEST_SOLEMN_MEND.castMs); // solemn-mend isn't buffedSpellId; still armed
    const h = onlyHeal(castAndComplete(engine, 'tank', TEST_ZEALOUS_MENDING.id, TEST_ZEALOUS_MENDING.castMs));
    expect(h.amount + h.overheal).toBe(TEST_ZEALOUS_MENDING.heal + 4);
  });

  it('two independent synergy entries feeding the same buffed spell are both consumed together (summed)', () => {
    const spells = [...TEST_SPELLS, TEST_MINOR_SPELL];
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, spells, {
      synergies: [
        { triggerSpellId: 'solemn-mend', buffedSpellId: 'zealous-mending', bonusHeal: 4 },
        { triggerSpellId: 'test-minor', buffedSpellId: 'zealous-mending', bonusHeal: 2 },
      ],
    });
    castAndComplete(engine, 'dps2', TEST_SOLEMN_MEND.id, TEST_SOLEMN_MEND.castMs); // arms entry 1
    castAndComplete(engine, 'dps2', TEST_MINOR_SPELL.id, TEST_MINOR_SPELL.castMs); // arms entry 2
    const h = onlyHeal(castAndComplete(engine, 'dps1', TEST_ZEALOUS_MENDING.id, TEST_ZEALOUS_MENDING.castMs));
    expect(h.amount + h.overheal).toBe(TEST_ZEALOUS_MENDING.heal + 4 + 2);
  });

  it(
    'a trigger cast on a target that dies mid-cast still arms; a buffed cast on a dead target ' +
      'does not consume (kept); a later live buffed cast then applies the still-armed bonus',
    () => {
      // Trash always attacks the tank while it's alive, then the first living DPS. Fixed
      // TRASH.autoDamage=1 every fixed 3000ms swing makes every HP value below exact and
      // reproducible without any randomness.
      const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, {
        bonusMaxMana: 20, // headroom so mana never gates the sequence below
        synergies: [{ triggerSpellId: 'solemn-mend', buffedSpellId: 'zealous-mending', bonusHeal: 4 }],
      });

      // --- Phase 1: bring the tank (maxHp 20) to 1 hp via 19 trash swings (19*3000=57000ms),
      // then a further partial 1500ms (trash timer freshly reset to 3000 at 57000, now at 1500).
      engine.advance(57000);
      engine.advance(1500);
      // Start a 2000ms Solemn Mend on the tank; the trash's next swing (1500ms away) lands
      // mid-cast and kills the tank (hp 1 -> 0). The cast still completes: mana spent, no heal
      // event — but it still arms (armed state does not depend on target aliveness).
      engine.setTarget('tank');
      engine.castSpell(TEST_SOLEMN_MEND.id);
      let events = engine.advance(2000);
      expect(events.some((e) => e.type === 'unitDied' && e.unitId === 'tank')).toBe(true);
      expect(events.some((e) => e.type === 'castFinished' && e.spellId === 'solemn-mend')).toBe(true);
      expect(heals(events)).toHaveLength(0);

      // --- Phase 2: tank is dead, so trash now targets dps1 (maxHp 10). Bring it to 1 hp via
      // 9 swings, then a further partial 2500ms (trash timer reset to 3000 after the 9th swing).
      engine.advance(26500); // 9 swings land at cumulative 2500 + (k-1)*3000; the 9th at 26500
      engine.advance(2500); // trash timer now at 500, well short of the 1000ms cast below
      // Start a 1000ms Zealous Flare (the buffed spell) on dps1; the trash's next swing (500ms
      // away) kills dps1 mid-cast. The cast completes (mana spent) but there's no heal event to
      // add the bonus to, so the armed synergy is NOT consumed — it stays armed.
      engine.setTarget('dps1');
      engine.castSpell(TEST_ZEALOUS_MENDING.id);
      events = engine.advance(1000);
      expect(events.some((e) => e.type === 'unitDied' && e.unitId === 'dps1')).toBe(true);
      expect(events.some((e) => e.type === 'castFinished' && e.spellId === 'zealous-mending')).toBe(true);
      expect(heals(events)).toHaveLength(0);

      // --- Phase 3: dps2 was never targeted by trash (tank, then dps1, always came first) and
      // is still at full HP. Casting the buffed spell on it now proves the bonus survived the
      // failed (dead-target) consume attempt in Phase 2.
      engine.setTarget('dps2');
      engine.castSpell(TEST_ZEALOUS_MENDING.id);
      const h = onlyHeal(engine.advance(1000));
      expect(h.amount + h.overheal).toBe(TEST_ZEALOUS_MENDING.heal + 4);
    },
  );
});

describe('CombatEngine effects: missing-health bonus', () => {
  /** Advances exactly `missing` trash swings (3000ms each) against the tank (maxHp 20, starts
   * full), landing precisely on the boundary so the trash's timer is freshly reset afterward —
   * leaving 3000ms of headroom before casting (Solemn Mend's 2000ms cast never collides). */
  function bringTankToMissing(engine: CombatEngine, missing: number): void {
    engine.advance(missing * 3000);
  }

  const cases: { missing: number; expectedBonusUnits: number }[] = [
    { missing: 1, expectedBonusUnits: 0 }, // 5% missing — floors below the 10% boundary
    { missing: 2, expectedBonusUnits: 1 }, // 10% missing exactly — boundary hits
    { missing: 3, expectedBonusUnits: 1 }, // 15% missing — floors below the 20% boundary
    { missing: 4, expectedBonusUnits: 2 }, // 20% missing exactly — boundary hits
  ];

  for (const { missing, expectedBonusUnits } of cases) {
    it(`heals +${expectedBonusUnits * 2} at ${missing}/20 missing HP (floor boundary), computed pre-heal`, () => {
      const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, {
        missingHealthBonuses: [{ spellId: 'solemn-mend', healPer10PctMissing: 2 }],
      });
      bringTankToMissing(engine, missing);
      const h = onlyHeal(castAndComplete(engine, 'tank', TEST_SOLEMN_MEND.id, TEST_SOLEMN_MEND.castMs));
      const bonus = expectedBonusUnits * 2;
      const raw = TEST_SOLEMN_MEND.heal + bonus;
      const applied = Math.min(raw, missing);
      expect(h.amount).toBe(applied);
      expect(h.overheal).toBe(raw - applied);
      expect(h.amount + h.overheal).toBe(raw);
    });
  }
});

describe('CombatEngine effects: both bonuses stack additively', () => {
  it('synergy + missing-health bonuses both apply to the same cast', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, {
      synergies: [{ triggerSpellId: 'solemn-mend', buffedSpellId: 'zealous-mending', bonusHeal: 4 }],
      missingHealthBonuses: [{ spellId: 'zealous-mending', healPer10PctMissing: 2 }],
    });
    // Arm the synergy on dps1 (unrelated to the tank's HP) — trash's timer has 3000ms of full
    // headroom at construction, so Solemn Mend's 2000ms cast never collides with a swing.
    castAndComplete(engine, 'dps1', TEST_SOLEMN_MEND.id, TEST_SOLEMN_MEND.castMs);
    // Trash's timer is now at 1000ms remaining; two more swings (1000ms, then 3000ms) bring the
    // tank to missing 2 (10%) at cumulative 4000ms, landing exactly on a fresh-reset boundary.
    engine.advance(4000);
    // Zealous Flare's 1000ms cast has 3000ms of headroom now — no collision.
    const h = onlyHeal(castAndComplete(engine, 'tank', TEST_ZEALOUS_MENDING.id, TEST_ZEALOUS_MENDING.castMs));
    const raw = TEST_ZEALOUS_MENDING.heal + 4 + 2; // heal + synergy + missing-health(floor(2*10/20)=1 * 2)
    expect(raw).toBe(11);
    const applied = Math.min(raw, 2);
    expect(h.amount).toBe(applied);
    expect(h.overheal).toBe(raw - applied);
    expect(h.amount + h.overheal).toBe(raw);
  });
});

describe('CombatEngine effects: options omitted (Phase 1 regression)', () => {
  it('produces the exact same heal as before when no synergy/missing-health options are passed', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS);
    const h = onlyHeal(castAndComplete(engine, 'tank', TEST_SOLEMN_MEND.id, TEST_SOLEMN_MEND.castMs));
    expect(h.amount + h.overheal).toBe(TEST_SOLEMN_MEND.heal);
    expect(h.overheal).toBe(TEST_SOLEMN_MEND.heal); // tank starts at full HP — fully overheal, unchanged from Phase 1
  });
});
