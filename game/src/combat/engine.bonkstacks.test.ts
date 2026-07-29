/**
 * Unit tests for the `stackNextHealPotencyPct` castBuff mechanic (Blessed Bonk).
 * Uses synthetic SpellDefs so no radial data dependency is required in this chunk.
 *
 * Covered by DoD:
 *  1. Stacks increment on each cast; capped at `cap` (3 in shipped data).
 *  2. Potency applies on the next heal land; stacks clear to 0 afterwards.
 *  3. Non-heal (damage-only) casts do not consume stacks.
 *  4. Both `nextHealPotencyPct` (Reckoning) and Bonk stacks armed simultaneously:
 *     both apply additively (flat pct first, stacks after), both clear.
 */

import { describe, expect, it } from 'vitest';
import { CombatEngine } from './engine';
import { GCD_MS } from '../data/constants';
import type { CombatEvent, EncounterDef, SpellDef } from './types';

// ---------------------------------------------------------------------------
// Synthetic spell defs — no dependency on data/radial (Chunk 1 owns that).
// ---------------------------------------------------------------------------

/** Blessed Bonk: instant damage, stacks next-heal potency +10% per stack, cap 3. */
const BLESSED_BONK: SpellDef = {
  id: 'blessed-bonk',
  name: 'Blessed Bonk',
  heal: 0,
  mana: 0,
  castMs: 0,
  damage: 1,
  castBuff: { kind: 'stackNextHealPotencyPct', pct: 10, cap: 3 },
};

/** Instant heal for stack-consume tests; mana 0 to avoid mana accounting. */
const INSTANT_HEAL: SpellDef = { id: 'instant-heal', name: 'Instant Heal', heal: 10, mana: 0, castMs: 0 };

/** Pure damage spell with no castBuff — used to confirm non-heap casts don't consume stacks. */
const PURE_DAMAGE: SpellDef = { id: 'pure-damage', name: 'Pure Damage', heal: 0, mana: 0, castMs: 0, damage: 1 };

/** Reckoning-style flat potency spell — used for the "both armed" interaction test. */
const FLAT_POTENCY: SpellDef = {
  id: 'flat-potency',
  name: 'Flat Potency',
  heal: 0,
  mana: 0,
  castMs: 0,
  damage: 1,
  castBuff: { kind: 'nextHealPotencyPct', pct: 25 },
};

// ---------------------------------------------------------------------------
// Quiet encounter — enemy does no damage; only used as a damage target for Bonk.
// ---------------------------------------------------------------------------
function makeBonkTestEncounter(): EncounterDef {
  return {
    id: 'bonk-stacks-test',
    name: 'Bonk Stacks Test',
    waves: [{ enemies: [{ name: 'Punching Bag', hp: 200, count: 1, autoDamage: 0, swingIntervalMs: 60_000 }] }],
    boss: { id: 'quiet-boss', name: 'Quiet Boss', hp: 200, autoDamage: 0, swingIntervalMs: 60_000 },
  };
}

/** Cast an instant spell and tick it through the GCD so the next cast can begin. */
function castInstantAndTick(engine: CombatEngine, spellId: string): CombatEvent[] {
  engine.castSpell(spellId);
  return engine.advance(GCD_MS);
}

describe('stackNextHealPotencyPct (Blessed Bonk stacking mechanic)', () => {
  // ── 1. Stack increment and cap ──────────────────────────────────────────

  it('starts at 0 stacks', () => {
    const engine = new CombatEngine(makeBonkTestEncounter(), [BLESSED_BONK, INSTANT_HEAL]);
    expect(engine.state.bonkHealStacks).toBe(0);
  });

  it('increments by 1 per bonk cast', () => {
    const engine = new CombatEngine(makeBonkTestEncounter(), [BLESSED_BONK, INSTANT_HEAL]);
    engine.setTarget('tank');

    castInstantAndTick(engine, BLESSED_BONK.id);
    expect(engine.state.bonkHealStacks).toBe(1);

    castInstantAndTick(engine, BLESSED_BONK.id);
    expect(engine.state.bonkHealStacks).toBe(2);
  });

  it('caps at cap=3 and does not exceed it on further casts', () => {
    const engine = new CombatEngine(makeBonkTestEncounter(), [BLESSED_BONK, INSTANT_HEAL]);
    engine.setTarget('tank');

    castInstantAndTick(engine, BLESSED_BONK.id);
    castInstantAndTick(engine, BLESSED_BONK.id);
    castInstantAndTick(engine, BLESSED_BONK.id);
    expect(engine.state.bonkHealStacks).toBe(3);

    // 4th cast — must stay at 3
    castInstantAndTick(engine, BLESSED_BONK.id);
    expect(engine.state.bonkHealStacks).toBe(3);

    // 5th cast — still 3
    castInstantAndTick(engine, BLESSED_BONK.id);
    expect(engine.state.bonkHealStacks).toBe(3);
  });

  // ── 2. Potency applies on next heal, stacks clear ───────────────────────

  it('applies ceil(baseHeal * stacks * pct / 100) bonus and clears stacks', () => {
    // Use a scratch encounter so the tank takes some damage (ensuring the heal
    // is not fully overhealed, though we also check amount+overheal for raw).
    const encounter: EncounterDef = {
      ...makeBonkTestEncounter(),
      waves: [
        { enemies: [{ name: 'Scratch', hp: 200, count: 1, autoDamage: 3, swingIntervalMs: 1000 }] },
      ],
    };
    const engine = new CombatEngine(encounter, [BLESSED_BONK, INSTANT_HEAL]);
    engine.setTarget('tank');
    engine.advance(3000); // tank takes some damage — plenty of missing HP

    // Stack twice (2 × 10% = 20% bonus)
    castInstantAndTick(engine, BLESSED_BONK.id);
    castInstantAndTick(engine, BLESSED_BONK.id);
    expect(engine.state.bonkHealStacks).toBe(2);

    // Heal
    engine.castSpell(INSTANT_HEAL.id);
    const events = engine.advance(GCD_MS);

    const heal = events.find((e): e is Extract<CombatEvent, { type: 'heal' }> => e.type === 'heal');
    expect(heal).toBeDefined();

    const expectedBonus = Math.ceil((INSTANT_HEAL.heal * 2 * 10) / 100); // ceil(10*2*10/100) = 2
    // amount + overheal === raw (spec invariant) — robust regardless of target hp.
    expect(heal!.amount + heal!.overheal).toBe(INSTANT_HEAL.heal + expectedBonus);
    expect(engine.state.bonkHealStacks).toBe(0);
  });

  it('applies full 3-stack bonus correctly', () => {
    // Use the quiet encounter — autoDamage 0 so the tank stays alive across all GCD advances.
    // Testing raw via amount+overheal works whether or not the target has missing HP.
    const engine = new CombatEngine(makeBonkTestEncounter(), [BLESSED_BONK, INSTANT_HEAL]);
    engine.setTarget('tank');

    castInstantAndTick(engine, BLESSED_BONK.id);
    castInstantAndTick(engine, BLESSED_BONK.id);
    castInstantAndTick(engine, BLESSED_BONK.id);
    expect(engine.state.bonkHealStacks).toBe(3);

    engine.castSpell(INSTANT_HEAL.id);
    const events = engine.advance(GCD_MS);

    const heal = events.find((e): e is Extract<CombatEvent, { type: 'heal' }> => e.type === 'heal');
    expect(heal).toBeDefined();
    const expectedBonus = Math.ceil((INSTANT_HEAL.heal * 3 * 10) / 100); // ceil(10*3*10/100) = 3
    expect(heal!.amount + heal!.overheal).toBe(INSTANT_HEAL.heal + expectedBonus);
    expect(engine.state.bonkHealStacks).toBe(0);
  });

  it('clears stacks after the first heal and the bonus is gone on the second heal', () => {
    const encounter: EncounterDef = {
      ...makeBonkTestEncounter(),
      waves: [
        { enemies: [{ name: 'Scratch', hp: 200, count: 1, autoDamage: 3, swingIntervalMs: 1000 }] },
      ],
    };
    const engine = new CombatEngine(encounter, [BLESSED_BONK, INSTANT_HEAL]);
    engine.setTarget('tank');
    engine.advance(5000);

    castInstantAndTick(engine, BLESSED_BONK.id); // 1 stack
    expect(engine.state.bonkHealStacks).toBe(1);

    // First heal consumes the stack
    engine.castSpell(INSTANT_HEAL.id);
    const firstHealEvents = engine.advance(GCD_MS);
    const firstHeal = firstHealEvents.find(
      (e): e is Extract<CombatEvent, { type: 'heal' }> => e.type === 'heal',
    );
    expect(firstHeal!.amount + firstHeal!.overheal).toBe(
      INSTANT_HEAL.heal + Math.ceil((INSTANT_HEAL.heal * 1 * 10) / 100),
    );
    expect(engine.state.bonkHealStacks).toBe(0);

    // Second heal — no stacks, no bonus
    engine.castSpell(INSTANT_HEAL.id);
    const secondHealEvents = engine.advance(GCD_MS);
    const secondHeal = secondHealEvents.find(
      (e): e is Extract<CombatEvent, { type: 'heal' }> => e.type === 'heal',
    );
    expect(secondHeal!.amount + secondHeal!.overheal).toBe(INSTANT_HEAL.heal);
  });

  // ── 3. Non-heal casts do not consume stacks ──────────────────────────────

  it('does not consume stacks when a damage-only spell (no healingcBuff) completes', () => {
    const engine = new CombatEngine(makeBonkTestEncounter(), [BLESSED_BONK, PURE_DAMAGE, INSTANT_HEAL]);
    engine.setTarget('tank');

    // Build 1 stack via Blessed Bonk
    castInstantAndTick(engine, BLESSED_BONK.id);
    expect(engine.state.bonkHealStacks).toBe(1);

    // Cast a pure damage spell — stacks must remain
    castInstantAndTick(engine, PURE_DAMAGE.id);
    expect(engine.state.bonkHealStacks).toBe(1);
  });

  it('incrementing with Blessed Bonk while stacks are armed does not reset existing stacks', () => {
    const engine = new CombatEngine(makeBonkTestEncounter(), [BLESSED_BONK, INSTANT_HEAL]);
    engine.setTarget('tank');

    // Stack twice, then a third time — should be 3 not reset to 1
    castInstantAndTick(engine, BLESSED_BONK.id);
    castInstantAndTick(engine, BLESSED_BONK.id);
    castInstantAndTick(engine, BLESSED_BONK.id);
    expect(engine.state.bonkHealStacks).toBe(3);
  });

  // ── 4. Interaction with nextHealPotencyPct (both armed simultaneously) ──

  it('applies nextHealPotencyPct and bonk stacks additively when both armed, then clears both', () => {
    const encounter: EncounterDef = {
      ...makeBonkTestEncounter(),
      waves: [
        { enemies: [{ name: 'Scratch', hp: 200, count: 1, autoDamage: 3, swingIntervalMs: 1000 }] },
      ],
    };
    const engine = new CombatEngine(encounter, [BLESSED_BONK, FLAT_POTENCY, INSTANT_HEAL]);
    engine.setTarget('tank');
    engine.advance(3000);

    // Arm Blessed Bonk (1 stack, 10%)
    castInstantAndTick(engine, BLESSED_BONK.id);
    expect(engine.state.bonkHealStacks).toBe(1);
    expect(engine.state.nextHealPotencyPct).toBe(0);

    // Arm Reckoning-style flat potency (25%)
    castInstantAndTick(engine, FLAT_POTENCY.id);
    expect(engine.state.bonkHealStacks).toBe(1);
    expect(engine.state.nextHealPotencyPct).toBe(25);

    // Heal — both should apply additively
    engine.castSpell(INSTANT_HEAL.id);
    const events = engine.advance(GCD_MS);
    const heal = events.find((e): e is Extract<CombatEvent, { type: 'heal' }> => e.type === 'heal');
    expect(heal).toBeDefined();

    const flatBonus = Math.ceil((INSTANT_HEAL.heal * 25) / 100); // 3 (ceil of 2.5)
    const stackBonus = Math.ceil((INSTANT_HEAL.heal * 1 * 10) / 100); // 1
    expect(heal!.amount + heal!.overheal).toBe(INSTANT_HEAL.heal + flatBonus + stackBonus);

    // Both cleared
    expect(engine.state.nextHealPotencyPct).toBe(0);
    expect(engine.state.bonkHealStacks).toBe(0);
  });

  it('bonk stacks armed alone do not clear nextHealPotencyPct', () => {
    const engine = new CombatEngine(makeBonkTestEncounter(), [BLESSED_BONK, FLAT_POTENCY, INSTANT_HEAL]);
    engine.setTarget('tank');

    // Arm flat potency only
    castInstantAndTick(engine, FLAT_POTENCY.id);
    expect(engine.state.nextHealPotencyPct).toBe(25);
    expect(engine.state.bonkHealStacks).toBe(0);

    // Arm bonk stacks — flat potency must remain intact
    castInstantAndTick(engine, BLESSED_BONK.id);
    expect(engine.state.nextHealPotencyPct).toBe(25);
    expect(engine.state.bonkHealStacks).toBe(1);
  });
});
