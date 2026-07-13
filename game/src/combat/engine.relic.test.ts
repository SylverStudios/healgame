import { describe, expect, it } from 'vitest';
import { CombatEngine } from './engine';
import { GCD_MS } from '../data/constants';
import { EMBER_LEDGER, STILL_RESERVOIR, TRIAGE_BELL } from '../data/relics';
import { makeTestEncounter, TEST_SOLEMN_MEND, TEST_SPELLS, TEST_ZEALOUS_MENDING } from './testFixtures';
import type { CombatEngineOptions, CombatEvent, EncounterDef, SpellDef } from './types';

/**
 * Alpha 0.1 §D7/§D8 (minimal relics): Ember Ledger (overhealManaRestore),
 * Triage Bell (thresholdHealMod), Still Reservoir (manaRegenTradeoff). See
 * combat/README.md-adjacent handoff §D7/§D8 for the rule writeup this file
 * encodes; relics are NOT tree nodes, resolved separately from CombatMods.
 *
 * A single never-dying dummy (mirrors engine.effects.test.ts /
 * engine.cooldown.test.ts) keeps advances free of wave transitions / boss
 * spawns, so only the events under test show up in filtered assertions.
 */
const NEVER_DYING_TRASH_ENCOUNTER: EncounterDef = makeTestEncounter({
  waves: [{ enemies: [{ name: 'Dummy', hp: 999, count: 1 }] }],
});

/** Not in testFixtures.ts (out of this chunk's file ownership) — small custom test spells so
 *  exact clamp/min-heal/pct-stacking numbers are hand-computable. */
const TEST_CHEAP_HEAL: SpellDef = { id: 'test-cheap-heal', name: 'Cheap Heal', heal: 5, mana: 1, castMs: 500 };
const TEST_TINY_HEAL: SpellDef = { id: 'test-tiny-heal', name: 'Tiny Heal', heal: 1, mana: 1, castMs: 500 };
const TEST_BIG_HEAL: SpellDef = { id: 'test-big-heal', name: 'Big Heal', heal: 9, mana: 3, castMs: 1000 };

function heals(events: CombatEvent[]): Extract<CombatEvent, { type: 'heal' }>[] {
  return events.filter((e): e is Extract<CombatEvent, { type: 'heal' }> => e.type === 'heal');
}
function triggers(events: CombatEvent[]): Extract<CombatEvent, { type: 'relicTriggered' }>[] {
  return events.filter((e): e is Extract<CombatEvent, { type: 'relicTriggered' }> => e.type === 'relicTriggered');
}
/** Asserts exactly one heal event occurred and returns it. */
function onlyHeal(events: CombatEvent[]): Extract<CombatEvent, { type: 'heal' }> {
  const found = heals(events);
  expect(found).toHaveLength(1);
  return found[0] as Extract<CombatEvent, { type: 'heal' }>;
}
function healerMana(engine: CombatEngine): number {
  return engine.state.party.find((u) => u.id === 'healer')!.mana;
}

/**
 * Cast `spellId` on `targetId` (healer must be free) and advance through its full busy window
 * — `max(castMs, GCD_MS)` — so the healer is guaranteed free again afterward.
 */
function castAndComplete(engine: CombatEngine, targetId: string, spellId: string, castMs: number): CombatEvent[] {
  engine.setTarget(targetId);
  engine.castSpell(spellId);
  return engine.advance(Math.max(castMs, GCD_MS));
}

/** Advances exactly `missing` trash swings (3000ms each, 1 dmg) against the full-hp tank
 *  (maxHp 20), landing on the boundary so the trash timer is freshly reset afterward. */
function bringTankToMissing(engine: CombatEngine, missing: number): void {
  engine.advance(missing * 3000);
}

describe('Ember Ledger (overhealManaRestore)', () => {
  it('fires once per combat on the first overheal: mana restored, event emitted; a second overheal is ignored', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, { relic: EMBER_LEDGER });
    // Targets dps2 (never hit by trash while the tank is alive — README targeting rule) so both
    // heals stay pure overheal without needing to account for an interleaved trash swing.
    const first = castAndComplete(engine, 'dps2', TEST_SOLEMN_MEND.id, TEST_SOLEMN_MEND.castMs);
    expect(onlyHeal(first).overheal).toBe(TEST_SOLEMN_MEND.heal);
    expect(triggers(first)).toEqual([{ type: 'relicTriggered', id: EMBER_LEDGER.id, name: EMBER_LEDGER.name }]);
    expect(healerMana(engine)).toBe(20 - TEST_SOLEMN_MEND.mana + 3); // reserved 5, restored 3 -> 18

    const second = castAndComplete(engine, 'dps2', TEST_SOLEMN_MEND.id, TEST_SOLEMN_MEND.castMs); // also pure overheal
    expect(onlyHeal(second).overheal).toBe(TEST_SOLEMN_MEND.heal);
    expect(triggers(second)).toHaveLength(0); // already fired this combat
    expect(healerMana(engine)).toBe(18 - TEST_SOLEMN_MEND.mana); // no second restore
  });

  it('restores mana clamped to maxMana when the restore would push past it', () => {
    const spells = [...TEST_SPELLS, TEST_CHEAP_HEAL];
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, spells, { relic: EMBER_LEDGER });
    const events = castAndComplete(engine, 'tank', TEST_CHEAP_HEAL.id, TEST_CHEAP_HEAL.castMs); // reserves 1, overheals
    expect(onlyHeal(events).overheal).toBeGreaterThan(0);
    expect(triggers(events)).toHaveLength(1);
    expect(healerMana(engine)).toBe(20); // 20 - 1 reserved + 3 restored = 22, clamped to maxMana 20
  });

  it('does not fire on a heal with zero overheal (no free charge wasted on a clean, fully-applied heal)', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, { relic: EMBER_LEDGER });
    bringTankToMissing(engine, 19); // tank at 1/20 hp (not dead) -- a 5-heal fully applies, overheal 0
    const events = castAndComplete(engine, 'tank', TEST_SOLEMN_MEND.id, TEST_SOLEMN_MEND.castMs);
    expect(onlyHeal(events).overheal).toBe(0);
    expect(triggers(events)).toHaveLength(0);
    expect(healerMana(engine)).toBe(20 - TEST_SOLEMN_MEND.mana); // no restore
  });
});

describe('Triage Bell (thresholdHealMod)', () => {
  it('heals +2 when the target is below 50% hp (pre-heal)', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, { relic: TRIAGE_BELL });
    bringTankToMissing(engine, 11); // hp 9/20 = 45% -- below 50%
    const h = onlyHeal(castAndComplete(engine, 'tank', TEST_SOLEMN_MEND.id, TEST_SOLEMN_MEND.castMs));
    const raw = TEST_SOLEMN_MEND.heal + 2;
    expect(h.amount).toBe(Math.min(raw, 11));
    expect(h.overheal).toBe(raw - h.amount);
  });

  it('heals -1 when the target is exactly at the 50% boundary (inclusive of the penalty branch)', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, { relic: TRIAGE_BELL });
    bringTankToMissing(engine, 10); // hp 10/20 = exactly 50%
    const h = onlyHeal(castAndComplete(engine, 'tank', TEST_SOLEMN_MEND.id, TEST_SOLEMN_MEND.castMs));
    const raw = TEST_SOLEMN_MEND.heal - 1;
    expect(h.amount).toBe(Math.min(raw, 10));
    expect(h.overheal).toBe(raw - h.amount);
  });

  it('heals -1 when at/above 50% on a full-hp target too', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, { relic: TRIAGE_BELL });
    const h = onlyHeal(castAndComplete(engine, 'tank', TEST_SOLEMN_MEND.id, TEST_SOLEMN_MEND.castMs));
    expect(h.amount + h.overheal).toBe(TEST_SOLEMN_MEND.heal - 1);
  });

  it('clamps the at/above-50% penalty at minHeal 1, not below (1-heal test spell)', () => {
    const spells = [...TEST_SPELLS, TEST_TINY_HEAL];
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, spells, { relic: TRIAGE_BELL });
    const h = onlyHeal(castAndComplete(engine, 'tank', TEST_TINY_HEAL.id, TEST_TINY_HEAL.castMs)); // full hp, at/above 50%
    // raw would be 1 - 1 = 0, clamped up to minHeal 1.
    expect(h.amount + h.overheal).toBe(1);
  });

  it('applies AFTER tree bonuses (missing-health pct bonus stacks first, relic modifies the final sum)', () => {
    const spells = [...TEST_SPELLS, TEST_BIG_HEAL];
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, spells, {
      relic: TRIAGE_BELL,
      missingHealthPctBonuses: [{ spellId: 'test-big-heal', pctPer10PctMissing: 5 }],
    });
    bringTankToMissing(engine, 8); // hp 12/20 = 60% (at/above 50% -> penalty branch); bands = floor(8*10/20) = 4
    const h = onlyHeal(castAndComplete(engine, 'tank', TEST_BIG_HEAL.id, TEST_BIG_HEAL.castMs));
    const pctBonus = Math.ceil((TEST_BIG_HEAL.heal * 5 * 4) / 100); // ceil(1.8) = 2
    const raw = Math.max(1, TEST_BIG_HEAL.heal + pctBonus - 1); // 9 + 2 - 1 = 10
    expect(raw).toBe(10);
    expect(h.amount).toBe(Math.min(raw, 8));
    expect(h.overheal).toBe(raw - h.amount);
  });

  it('never emits relicTriggered — heal mods show up in the heal numbers only', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, { relic: TRIAGE_BELL });
    bringTankToMissing(engine, 11);
    const events = castAndComplete(engine, 'tank', TEST_SOLEMN_MEND.id, TEST_SOLEMN_MEND.castMs);
    expect(triggers(events)).toHaveLength(0);
  });
});

describe('Still Reservoir (manaRegenTradeoff)', () => {
  it('reduces starting AND max mana by 5, applied after bonusMaxMana', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, {
      bonusMaxMana: 4,
      relic: STILL_RESERVOIR,
    });
    const healer = engine.state.party.find((u) => u.id === 'healer')!;
    expect(healer.mana).toBe(20 + 4 - 5); // 19
    expect(healer.maxMana).toBe(19);
  });

  it('regen ticks +2 at exactly 15s and again at 30s of sim time, emitting relicTriggered each time', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, { relic: STILL_RESERVOIR });
    engine.setTarget('healer');
    engine.castSpell(TEST_SOLEMN_MEND.id); // 15 - 5 = 10
    engine.advance(2000); // cast completes, no interference
    expect(healerMana(engine)).toBe(10);

    const first = engine.advance(13000); // cumulative sim time now 15000ms
    expect(triggers(first)).toEqual([
      { type: 'relicTriggered', id: STILL_RESERVOIR.id, name: STILL_RESERVOIR.name },
    ]);
    expect(healerMana(engine)).toBe(12);

    const second = engine.advance(15000); // cumulative 30000ms
    expect(triggers(second)).toHaveLength(1);
    expect(healerMana(engine)).toBe(14);
  });

  it('clamps at maxMana rather than overshooting when already full', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, { relic: STILL_RESERVOIR });
    const events = engine.advance(15000); // already at max (15); tick still fires
    expect(triggers(events)).toHaveLength(1);
    expect(healerMana(engine)).toBe(15);
  });

  it('the regen timer keeps ticking mid-cast (a busy healer does not pause it)', () => {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, { relic: STILL_RESERVOIR });
    engine.setTarget('healer');
    engine.advance(14000); // just short of the first regen boundary
    engine.castSpell(TEST_SOLEMN_MEND.id); // 2000ms cast starts at t=14000, spans the 15000ms boundary
    const events = engine.advance(1000); // crosses to t=15000, cast still has 1000ms left
    expect(triggers(events)).toHaveLength(1);
    expect(engine.state.playerCast).not.toBeNull();
    expect(healerMana(engine)).toBe(15 - TEST_SOLEMN_MEND.mana + 2); // reserved 5, then regen +2
  });
});

describe('no relic configured: regression parity with the pre-relic engine', () => {
  function runScript(options?: CombatEngineOptions): { events: CombatEvent[]; engine: CombatEngine } {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, options);
    engine.setTarget('tank');
    const events: CombatEvent[] = [];
    events.push(...engine.advance(3000)); // one trash swing lands
    engine.castSpell(TEST_SOLEMN_MEND.id);
    events.push(...engine.advance(2000));
    engine.setTarget('dps2');
    engine.castSpell(TEST_ZEALOUS_MENDING.id);
    events.push(...engine.advance(1000));
    return { events, engine };
  }

  it('options omitted entirely and options.relic explicitly undefined produce identical logs and end state', () => {
    const a = runScript(undefined);
    const b = runScript({ relic: undefined });
    expect(a.events).toEqual(b.events);
    expect(a.engine.state).toEqual(b.engine.state);
    expect(a.engine.rewards).toEqual(b.engine.rewards);
  });
});

describe('determinism', () => {
  function runScript(): { events: CombatEvent[]; engine: CombatEngine } {
    const engine = new CombatEngine(NEVER_DYING_TRASH_ENCOUNTER, TEST_SPELLS, { relic: STILL_RESERVOIR });
    engine.setTarget('healer');
    const events: CombatEvent[] = [];
    events.push(...engine.advance(5000));
    engine.castSpell(TEST_SOLEMN_MEND.id);
    events.push(...engine.advance(2000));
    events.push(...engine.advance(9000)); // crosses the 15s regen boundary
    engine.setTarget('tank');
    engine.castSpell(TEST_ZEALOUS_MENDING.id);
    events.push(...engine.advance(20_000)); // crosses the 30s regen boundary too
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
