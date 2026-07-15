import { describe, expect, it } from 'vitest';
import { CombatEngine } from './engine';
import { COOLDOWNS, FRENZIED_LITURGY, STILL_WATERS } from '../data/cooldowns';
import { makeTestEncounter, TEST_SOLEMN_MEND, TEST_SPELLS, TEST_ZEALOUS_MENDING } from './testFixtures';
import type { CombatEvent, CooldownDef, EncounterDef, SpellDef } from './types';

/**
 * Alpha 0.1 §D6 (first major CDs): Still Waters (freeNextHeal, 60s) and
 * Frenzied Liturgy (manaCostReduction, 30s buff / 40s cooldown). See combat/README.md
 * "Cooldowns" for the full rule writeup this file encodes.
 *
 * A single never-dying dummy (mirrors engine.effects.test.ts's
 * NEVER_DYING_TRASH_ENCOUNTER) keeps the long (30-60s) advances these tests
 * need free of wave transitions / boss spawns, so only the events under test
 * show up in the filtered assertions below.
 */
const NEVER_DYING_TRASH_ENCOUNTER: EncounterDef = makeTestEncounter({
  waves: [{ enemies: [{ name: 'Dummy', hp: 999, count: 1 }] }],
});

/** Not in testFixtures.ts (out of this chunk's file ownership) — a 1-mana spell so the
 *  manaCostReduction min-0 clamp (Alpha 0.1 §D6) is exercised exactly, not just "still positive". */
const TEST_CHEAP_SPELL: SpellDef = { id: 'test-cheap', name: 'Cheap Spell', heal: 1, mana: 1, castMs: 500 };
const SPELLS_WITH_CHEAP: SpellDef[] = [...TEST_SPELLS, TEST_CHEAP_SPELL];

function heals(events: CombatEvent[]): Extract<CombatEvent, { type: 'heal' }>[] {
  return events.filter((e): e is Extract<CombatEvent, { type: 'heal' }> => e.type === 'heal');
}
function castsStarted(events: CombatEvent[]): Extract<CombatEvent, { type: 'castStarted' }>[] {
  return events.filter((e): e is Extract<CombatEvent, { type: 'castStarted' }> => e.type === 'castStarted');
}
function activations(events: CombatEvent[]): Extract<CombatEvent, { type: 'cooldownActivated' }>[] {
  return events.filter((e): e is Extract<CombatEvent, { type: 'cooldownActivated' }> => e.type === 'cooldownActivated');
}
function buffEndeds(events: CombatEvent[]): Extract<CombatEvent, { type: 'cooldownBuffEnded' }>[] {
  return events.filter((e): e is Extract<CombatEvent, { type: 'cooldownBuffEnded' }> => e.type === 'cooldownBuffEnded');
}
function cooldownState(engine: CombatEngine, id: string) {
  const cd = engine.state.cooldowns.find((c) => c.id === id);
  if (!cd) throw new Error(`no cooldown state for ${id}`);
  return cd;
}
function healerMana(engine: CombatEngine): number {
  return engine.state.party.find((u) => u.id === 'healer')!.mana;
}
/** Type-narrowing helper so tests can read FRENZIED_LITURGY's durationMs without inline guards. */
function manaCostReductionDurationMs(def: CooldownDef): number {
  return def.effect.kind === 'manaCostReduction' ? def.effect.durationMs : 0;
}

describe('cooldowns: activation basics', () => {
  it('starts ready (remainingCooldownMs 0); activation emits cooldownActivated and sets remainingCooldownMs to cooldownMs', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, { cooldowns: [STILL_WATERS] });
    expect(cooldownState(engine, STILL_WATERS.id).remainingCooldownMs).toBe(0);

    engine.activateCooldown(STILL_WATERS.id);
    const events = engine.advance(0); // flushes the buffered command's event without any time passing
    expect(activations(events)).toEqual([{ type: 'cooldownActivated', id: STILL_WATERS.id, name: STILL_WATERS.name }]);
    expect(cooldownState(engine, STILL_WATERS.id).remainingCooldownMs).toBe(STILL_WATERS.cooldownMs);
  });

  it('blocks re-activation while still on cooldown: no event, no reset of the running timer', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, { cooldowns: [STILL_WATERS] });
    engine.activateCooldown(STILL_WATERS.id);
    engine.advance(1000);
    expect(cooldownState(engine, STILL_WATERS.id).remainingCooldownMs).toBe(STILL_WATERS.cooldownMs - 1000);

    engine.activateCooldown(STILL_WATERS.id); // still on CD -> ignored
    const events = engine.advance(0);
    expect(activations(events)).toHaveLength(0);
    expect(cooldownState(engine, STILL_WATERS.id).remainingCooldownMs).toBe(STILL_WATERS.cooldownMs - 1000);
  });

  it('is ready again after exactly cooldownMs of advance, not a moment before', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, { cooldowns: [STILL_WATERS] });
    engine.activateCooldown(STILL_WATERS.id);
    engine.advance(STILL_WATERS.cooldownMs - 1);
    expect(cooldownState(engine, STILL_WATERS.id).remainingCooldownMs).toBe(1);

    engine.advance(1);
    expect(cooldownState(engine, STILL_WATERS.id).remainingCooldownMs).toBe(0);

    engine.activateCooldown(STILL_WATERS.id); // ready -> succeeds
    const events = engine.advance(0);
    expect(activations(events)).toHaveLength(1);
  });

  it('an unknown cooldown id is silently ignored', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, { cooldowns: [STILL_WATERS] });
    engine.activateCooldown('not-a-real-cooldown-id');
    const events = engine.advance(0);
    expect(activations(events)).toHaveLength(0);
  });

  it('is off-GCD: activating mid-cast neither disturbs the in-flight cast nor waits for GCD', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, { cooldowns: [FRENZIED_LITURGY] });
    engine.setTarget('healer');
    engine.castSpell(TEST_SOLEMN_MEND.id); // 2000ms cast, busy
    engine.advance(0);
    expect(engine.state.playerCast).not.toBeNull();
    expect(engine.state.gcdRemainingMs).toBeGreaterThan(0);

    engine.activateCooldown(FRENZIED_LITURGY.id);
    const events = engine.advance(0);
    expect(activations(events)).toHaveLength(1);
    expect(engine.state.playerCast?.spellId).toBe(TEST_SOLEMN_MEND.id); // cast untouched

    const completeEvents = engine.advance(2000);
    expect(heals(completeEvents)).toHaveLength(1); // the cast still completes normally
  });

  it('activating a second CD while another CD\'s buff is already active is allowed', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, {
      cooldowns: [STILL_WATERS, FRENZIED_LITURGY],
    });
    engine.activateCooldown(FRENZIED_LITURGY.id);
    engine.advance(0);
    expect(cooldownState(engine, FRENZIED_LITURGY.id).activeRemainingMs).toBeGreaterThan(0);

    engine.activateCooldown(STILL_WATERS.id); // a different CD's buff window is open -- still allowed
    const events = engine.advance(0);
    expect(activations(events).map((e) => e.id)).toEqual([STILL_WATERS.id]);
  });
});

describe('no cooldowns configured', () => {
  it('state.cooldowns is an empty array when no defs are passed to the constructor', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS);
    expect(engine.state.cooldowns).toEqual([]);
  });

  it('activateCooldown is a no-op on an engine with no cooldowns configured', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS);
    engine.activateCooldown(STILL_WATERS.id);
    const events = engine.advance(0);
    expect(activations(events)).toHaveLength(0);
  });
});

describe('Still Waters (freeNextHeal)', () => {
  it('armed charge: a cast at 0 mana succeeds (OOM panic button), reserves 0, completion spends nothing; second cast costs normal mana', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, { cooldowns: [STILL_WATERS] });
    engine.setTarget('healer');
    // Drain to exactly 0 mana (20 -> 0 via 4 Solemn Mends @ 5 mana each).
    for (let i = 0; i < 4; i++) {
      engine.castSpell(TEST_SOLEMN_MEND.id);
      engine.advance(2000);
    }
    expect(healerMana(engine)).toBe(0);

    // Sanity: without the charge, a cast at 0 mana is silently rejected.
    engine.castSpell(TEST_SOLEMN_MEND.id);
    expect(castsStarted(engine.advance(0))).toHaveLength(0);

    engine.activateCooldown(STILL_WATERS.id);
    engine.advance(0);
    expect(cooldownState(engine, STILL_WATERS.id).activeRemainingMs).toBe(1); // armed flag, not a duration

    engine.castSpell(TEST_SOLEMN_MEND.id); // charge armed -> bypasses the affordability check at 0 mana
    const startEvents = engine.advance(0);
    expect(castsStarted(startEvents)).toHaveLength(1);
    expect(healerMana(engine)).toBe(0); // reserved 0 -- mana untouched by the cast starting
    expect(buffEndeds(startEvents)).toEqual([{ type: 'cooldownBuffEnded', id: STILL_WATERS.id }]); // consumed at cast START
    expect(cooldownState(engine, STILL_WATERS.id).activeRemainingMs).toBe(0);

    const completeEvents = engine.advance(2000);
    expect(heals(completeEvents)).toHaveLength(1);
    expect(healerMana(engine)).toBe(0); // completion spends nothing -- it was reserved at 0, never re-debited

    // Second cast: no charge left, the normal 5-mana cost applies -> rejected at 0 mana.
    engine.castSpell(TEST_SOLEMN_MEND.id);
    expect(castsStarted(engine.advance(0))).toHaveLength(0);
  });

  it('a queued cast that fires while armed counts as "the first cast started" and consumes the charge', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, { cooldowns: [STILL_WATERS] });
    engine.setTarget('healer');
    engine.castSpell(TEST_ZEALOUS_MENDING.id); // starts immediately, busy for 1000ms (== GCD)
    engine.advance(0);

    engine.activateCooldown(STILL_WATERS.id);
    engine.advance(0);
    expect(cooldownState(engine, STILL_WATERS.id).activeRemainingMs).toBe(1);

    engine.castSpell(TEST_SOLEMN_MEND.id); // busy -> queued, not started yet
    const beforeFire = engine.advance(999);
    expect(castsStarted(beforeFire)).toHaveLength(0);
    expect(cooldownState(engine, STILL_WATERS.id).activeRemainingMs).toBe(1); // still armed, nothing has started yet

    const fireEvents = engine.advance(1); // crosses the busy boundary -> queued Solemn Mend starts
    expect(castsStarted(fireEvents).map((c) => c.cast.spellId)).toEqual([TEST_SOLEMN_MEND.id]);
    expect(buffEndeds(fireEvents)).toEqual([{ type: 'cooldownBuffEnded', id: STILL_WATERS.id }]);
    expect(cooldownState(engine, STILL_WATERS.id).activeRemainingMs).toBe(0);
  });

  it('a cancelled free cast still consumes the charge and refunds nothing (healer mana unchanged)', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, { cooldowns: [STILL_WATERS] });
    engine.setTarget('healer');
    engine.activateCooldown(STILL_WATERS.id);
    engine.advance(0);
    expect(healerMana(engine)).toBe(20);

    engine.castSpell(TEST_SOLEMN_MEND.id); // armed charge -> reserves 0
    engine.advance(0);
    expect(healerMana(engine)).toBe(20);
    expect(cooldownState(engine, STILL_WATERS.id).activeRemainingMs).toBe(0); // already consumed at start

    engine.cancelCast();
    const events = engine.advance(0);
    expect(events.some((e) => e.type === 'castCancelled' && e.reason === 'escape')).toBe(true);
    expect(healerMana(engine)).toBe(20); // nothing reserved, so nothing to refund
  });
});

describe('Frenzied Liturgy (manaCostReduction)', () => {
  it('a cast during the window reserves cost - reduction; completion consumes nothing extra', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, { cooldowns: [FRENZIED_LITURGY] });
    engine.setTarget('healer');
    engine.activateCooldown(FRENZIED_LITURGY.id);
    engine.advance(0);
    expect(cooldownState(engine, FRENZIED_LITURGY.id).activeRemainingMs).toBe(manaCostReductionDurationMs(FRENZIED_LITURGY));

    engine.castSpell(TEST_SOLEMN_MEND.id); // base 5 mana, reduction 1 -> reserves 4
    engine.advance(0);
    expect(healerMana(engine)).toBe(16); // 20 - 4

    const completeEvents = engine.advance(2000);
    expect(heals(completeEvents)).toHaveLength(1);
    expect(healerMana(engine)).toBe(16); // completion doesn't spend again
  });

  it('clamps at 0: a 1-mana spell with -1 reduction reserves 0, not -1', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, SPELLS_WITH_CHEAP, { cooldowns: [FRENZIED_LITURGY] });
    engine.setTarget('healer');
    engine.activateCooldown(FRENZIED_LITURGY.id);
    engine.advance(0);

    engine.castSpell(TEST_CHEAP_SPELL.id);
    engine.advance(0);
    expect(healerMana(engine)).toBe(20); // 1 - 1 = 0 reserved
  });

  it('cancelling during the window refunds exactly the reduced (reserved) amount, not the base cost', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, { cooldowns: [FRENZIED_LITURGY] });
    engine.setTarget('healer');
    engine.activateCooldown(FRENZIED_LITURGY.id);
    engine.advance(0);

    engine.castSpell(TEST_SOLEMN_MEND.id); // reserves 4 (5 - 1)
    engine.advance(0);
    expect(healerMana(engine)).toBe(16);

    engine.cancelCast();
    engine.advance(0);
    expect(healerMana(engine)).toBe(20); // refunded 4, not 5 -- the reduction locked in at reserve time
  });

  it('a window expiring mid-cast does not retro-charge the difference on completion', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, { cooldowns: [FRENZIED_LITURGY] });
    engine.setTarget('healer');
    engine.activateCooldown(FRENZIED_LITURGY.id);
    engine.advance(0);

    // Start the cast with only 1000ms left in the 30000ms window.
    engine.advance(manaCostReductionDurationMs(FRENZIED_LITURGY) - 1000);
    engine.castSpell(TEST_SOLEMN_MEND.id); // window still open -> reserves 4
    const startEvents = engine.advance(0);
    expect(castsStarted(startEvents)).toHaveLength(1);
    expect(healerMana(engine)).toBe(16);

    // Advance past both the window's remaining 1000ms and the rest of the 2000ms cast.
    const events = engine.advance(2000);
    expect(buffEndeds(events)).toHaveLength(1); // window expires exactly once, mid-cast
    expect(heals(events)).toHaveLength(1); // cast completes normally
    expect(healerMana(engine)).toBe(16); // still only the reduced amount was ever spent
  });

  it('expires after 30s with 10s cooldown remaining; cannot reactivate until the 40s cooldown is ready', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, { cooldowns: [FRENZIED_LITURGY] });
    engine.setTarget('healer');
    engine.activateCooldown(FRENZIED_LITURGY.id);
    const events = engine.advance(manaCostReductionDurationMs(FRENZIED_LITURGY)); // exactly 30_000ms
    expect(buffEndeds(events)).toHaveLength(1);
    expect(cooldownState(engine, FRENZIED_LITURGY.id).activeRemainingMs).toBe(0);
    expect(cooldownState(engine, FRENZIED_LITURGY.id).remainingCooldownMs).toBe(
      FRENZIED_LITURGY.cooldownMs - manaCostReductionDurationMs(FRENZIED_LITURGY),
    );

    engine.castSpell(TEST_SOLEMN_MEND.id); // window closed -> full 5-mana cost
    engine.advance(0);
    expect(healerMana(engine)).toBe(15); // 20 - 5, not 20 - 4

    engine.activateCooldown(FRENZIED_LITURGY.id); // buff is over, but recovery is not -> ignored
    expect(activations(engine.advance(0))).toHaveLength(0);

    const recoveryMs = FRENZIED_LITURGY.cooldownMs - manaCostReductionDurationMs(FRENZIED_LITURGY);
    const beforeReadyEvents = engine.advance(recoveryMs - 1);
    expect(buffEndeds(beforeReadyEvents)).toHaveLength(0); // expiry event never repeats during recovery
    expect(cooldownState(engine, FRENZIED_LITURGY.id).remainingCooldownMs).toBe(1);
    engine.activateCooldown(FRENZIED_LITURGY.id);
    expect(activations(engine.advance(0))).toHaveLength(0);

    engine.advance(1);
    expect(cooldownState(engine, FRENZIED_LITURGY.id).remainingCooldownMs).toBe(0);
    engine.activateCooldown(FRENZIED_LITURGY.id);
    expect(activations(engine.advance(0))).toHaveLength(1);
    expect(cooldownState(engine, FRENZIED_LITURGY.id).activeRemainingMs).toBe(
      manaCostReductionDurationMs(FRENZIED_LITURGY),
    );
  });
});

/** Alpha 0.2 §D6 — Wrath Ascendant stub shape (inline; data lands in chunk 1). */
const TEST_HEAL_BONUS: CooldownDef = {
  id: 'test-heal-bonus',
  name: 'Test Heal Bonus',
  description: 'For 12s, heals gain +2.',
  cooldownMs: 45_000,
  effect: { kind: 'healBonus', durationMs: 12_000, bonusHeal: 2 },
};

function healBonusDurationMs(def: CooldownDef): number {
  return def.effect.kind === 'healBonus' ? def.effect.durationMs : 0;
}

describe('healBonus window (Alpha 0.2)', () => {
  it('adds bonusHeal to completed heals while the window is open', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, {
      cooldowns: [TEST_HEAL_BONUS],
    });
    engine.setTarget('healer');
    engine.activateCooldown(TEST_HEAL_BONUS.id);
    engine.advance(0);
    expect(cooldownState(engine, TEST_HEAL_BONUS.id).activeRemainingMs).toBe(
      healBonusDurationMs(TEST_HEAL_BONUS),
    );

    engine.castSpell(TEST_SOLEMN_MEND.id);
    const events = engine.advance(TEST_SOLEMN_MEND.castMs);
    const heal = heals(events)[0]!;
    // Base 5 + healBonus 2; full-HP target → all overheal.
    expect(heal.amount + heal.overheal).toBe(TEST_SOLEMN_MEND.heal + 2);
  });

  it('expires after durationMs and stops adding bonusHeal', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, {
      cooldowns: [TEST_HEAL_BONUS],
    });
    engine.setTarget('healer');
    engine.activateCooldown(TEST_HEAL_BONUS.id);
    const expireEvents = engine.advance(healBonusDurationMs(TEST_HEAL_BONUS));
    expect(buffEndeds(expireEvents)).toEqual([{ type: 'cooldownBuffEnded', id: TEST_HEAL_BONUS.id }]);
    expect(cooldownState(engine, TEST_HEAL_BONUS.id).activeRemainingMs).toBe(0);

    engine.castSpell(TEST_SOLEMN_MEND.id);
    const events = engine.advance(TEST_SOLEMN_MEND.castMs);
    const heal = heals(events)[0]!;
    expect(heal.amount + heal.overheal).toBe(TEST_SOLEMN_MEND.heal);
  });

  it('stacks after relic bonusHealing on the same completed cast', () => {
    const relic = {
      id: 'test-relic-heal',
      name: 'Test Relic',
      description: '+1 healing',
      effects: [{ kind: 'bonusHealing' as const, amount: 1 }],
    };
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, {
      cooldowns: [TEST_HEAL_BONUS],
      relics: [relic],
    });
    engine.setTarget('healer');
    engine.activateCooldown(TEST_HEAL_BONUS.id);
    engine.advance(0);
    engine.castSpell(TEST_SOLEMN_MEND.id);
    const heal = heals(engine.advance(TEST_SOLEMN_MEND.castMs))[0]!;
    expect(heal.amount + heal.overheal).toBe(TEST_SOLEMN_MEND.heal + 1 + 2);
  });
});

describe('interaction: Still Waters + Frenzied Liturgy both active', () => {
  it('the free charge wins: reserves 0, consumes only the freeNextHeal charge, leaves the cost-reduction window untouched', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, {
      cooldowns: [STILL_WATERS, FRENZIED_LITURGY],
    });
    engine.setTarget('healer');
    engine.activateCooldown(STILL_WATERS.id);
    engine.activateCooldown(FRENZIED_LITURGY.id);
    engine.advance(0);
    expect(cooldownState(engine, STILL_WATERS.id).activeRemainingMs).toBe(1);
    expect(cooldownState(engine, FRENZIED_LITURGY.id).activeRemainingMs).toBe(manaCostReductionDurationMs(FRENZIED_LITURGY));

    engine.castSpell(TEST_SOLEMN_MEND.id);
    const events = engine.advance(0);
    expect(healerMana(engine)).toBe(20); // free charge wins -> reserved 0, not 4
    expect(buffEndeds(events)).toEqual([{ type: 'cooldownBuffEnded', id: STILL_WATERS.id }]); // only the charge is consumed
    expect(cooldownState(engine, STILL_WATERS.id).activeRemainingMs).toBe(0);
    expect(cooldownState(engine, FRENZIED_LITURGY.id).activeRemainingMs).toBe(manaCostReductionDurationMs(FRENZIED_LITURGY)); // untouched

    const complete = engine.advance(2000);
    expect(heals(complete)).toHaveLength(1);

    // Next cast (no charge left) falls through to the still-open reduction window.
    engine.castSpell(TEST_SOLEMN_MEND.id);
    engine.advance(0);
    expect(healerMana(engine)).toBe(16); // 20 - 4
  });
});

describe('determinism', () => {
  function runScript(): { events: CombatEvent[]; engine: CombatEngine } {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, { cooldowns: COOLDOWNS });
    engine.setTarget('healer');
    const events: CombatEvent[] = [];
    events.push(...engine.advance(500));
    engine.activateCooldown(FRENZIED_LITURGY.id);
    events.push(...engine.advance(1000));
    engine.castSpell(TEST_SOLEMN_MEND.id);
    events.push(...engine.advance(2000));
    engine.activateCooldown(STILL_WATERS.id);
    events.push(...engine.advance(500));
    engine.castSpell(TEST_ZEALOUS_MENDING.id);
    events.push(...engine.advance(500));
    engine.cancelCast();
    events.push(...engine.advance(31_000));
    engine.castSpell(TEST_SOLEMN_MEND.id);
    events.push(...engine.advance(2000));
    return { events, engine };
  }

  it('two identical command sequences produce identical event logs and end state', () => {
    const runA = runScript();
    const runB = runScript();
    expect(runA.events).toEqual(runB.events);
    expect(runA.engine.state).toEqual(runB.engine.state);
    expect(runA.engine.rewards).toEqual(runB.engine.rewards);
  });
});
