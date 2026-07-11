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
 *  - Phase 3 (handoff §D): a cast whose target dies mid-cast is auto-cancelled
 *    the instant that death is applied — it never completes, so it never
 *    arms (a trigger cast) and never consumes (a buffed cast); the armed
 *    state of any other rule is left untouched. Mana is refunded, not spent.
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
    'Phase 3: a cast whose target dies mid-cast is auto-cancelled — never arms, never consumes, mana refunded',
    () => {
      // Trash always attacks the tank while it's alive, then the first living DPS. Fixed
      // TRASH.autoDamage=1 every fixed 3000ms swing makes every HP value below exact and
      // reproducible without any randomness.
      const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, {
        bonusMaxMana: 20, // headroom so mana never gates the sequence below
        synergies: [{ triggerSpellId: 'solemn-mend', buffedSpellId: 'zealous-mending', bonusHeal: 4 }],
      });
      const startingMana = engine.state.party.find((u) => u.id === 'healer')!.mana;

      // Bring the tank (maxHp 20) to 1 hp via 19 trash swings (19*3000=57000ms), then a further
      // partial 1500ms (trash timer freshly reset to 3000 at 57000, now at 1500).
      engine.advance(57000);
      engine.advance(1500);
      // Start a 2000ms Solemn Mend (the trigger spell) on the tank; the trash's next swing
      // (1500ms away) lands mid-cast and kills the tank (hp 1 -> 0). Phase 3 rule (handoff §D):
      // this auto-cancels the cast the instant that death is applied — it never completes, so it
      // never arms the synergy, and its reserved mana is refunded rather than spent.
      engine.setTarget('tank');
      engine.castSpell(TEST_SOLEMN_MEND.id);
      const manaAfterReserve = engine.state.party.find((u) => u.id === 'healer')!.mana;
      expect(manaAfterReserve).toBe(startingMana - TEST_SOLEMN_MEND.mana); // reserved at cast start

      const events = engine.advance(2000);
      expect(events.some((e) => e.type === 'unitDied' && e.unitId === 'tank')).toBe(true);
      expect(
        events.some((e) => e.type === 'castCancelled' && e.spellId === 'solemn-mend' && e.reason === 'target-dead'),
      ).toBe(true);
      expect(events.some((e) => e.type === 'castFinished')).toBe(false);
      expect(heals(events)).toHaveLength(0);
      expect(engine.state.party.find((u) => u.id === 'healer')!.mana).toBe(startingMana); // refunded, not spent
      expect(engine.state.armedBuffedSpellIds).not.toContain('zealous-mending'); // never armed

      // dps2 was never targeted by trash (tank always came first) and is still at full HP.
      // Casting the buffed spell on it now proves no bonus was armed by the cancelled cast above.
      engine.setTarget('dps2');
      engine.castSpell(TEST_ZEALOUS_MENDING.id);
      const h = onlyHeal(engine.advance(1000));
      expect(h.amount + h.overheal).toBe(TEST_ZEALOUS_MENDING.heal); // no +4 bonus
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
