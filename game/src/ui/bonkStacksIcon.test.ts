import { describe, expect, it } from 'vitest';
import type { SpellDef } from '../combat/types';
import {
  BONK_STACK_ICON_Y_OFFSET,
  bonkBuffHoverNotes,
  bonkStackIconPositions,
} from './bonkStacksIcon';

const bonk: SpellDef = {
  id: 'bonk',
  name: 'Bonk',
  heal: 0,
  mana: 1,
  castMs: 0,
  damage: 2,
  castBuff: { kind: 'stackNextHealPotencyPct', pct: 10, cap: 3 },
};

const heal: SpellDef = {
  id: 'solemn-mend',
  name: 'Solemn Mend',
  heal: 4,
  mana: 3,
  castMs: 2000,
};

const loadoutSpells = [bonk, heal];

describe('bonkStackIconPositions', () => {
  it('returns no positions for zero stacks', () => {
    expect(bonkStackIconPositions(100, 200, 0)).toEqual([]);
  });

  it('fans one icon per stack up-and-right, clear of the centered Battle Mend cue', () => {
    const positions = bonkStackIconPositions(100, 200, 3);
    expect(positions).toHaveLength(3);
    // First icon sits right of center (dx > 0) at the Battle Mend height.
    expect(positions[0]!.x).toBeGreaterThan(100);
    expect(positions[0]!.y).toBe(200 - BONK_STACK_ICON_Y_OFFSET);
    // Each subsequent icon steps up-and-right so the stack reads as a fan.
    expect(positions[1]!.x).toBeGreaterThan(positions[0]!.x);
    expect(positions[1]!.y).toBeLessThan(positions[0]!.y);
    expect(positions[2]!.x).toBeGreaterThan(positions[1]!.x);
    expect(positions[2]!.y).toBeLessThan(positions[1]!.y);
  });
});

describe('bonkBuffHoverNotes', () => {
  const noBuffs = { bonkHealStacks: 0, nextHealPotencyPct: 0, nextSpellManaReduction: 0 };

  it('returns nothing when no Bonk buffs are active', () => {
    expect(bonkBuffHoverNotes(noBuffs, heal, loadoutSpells)).toEqual([]);
    expect(bonkBuffHoverNotes(noBuffs, bonk, loadoutSpells)).toEqual([]);
  });

  it('shows Blessed stacks with total pct on the arming spell (build status)', () => {
    const notes = bonkBuffHoverNotes({ ...noBuffs, bonkHealStacks: 2 }, bonk, loadoutSpells);
    expect(notes).toContain('Blessed stacks: 2 (+20% next heal)');
  });

  it('shows Blessed stacks on a heal (which consumes them), pct from arming spell', () => {
    const notes = bonkBuffHoverNotes({ ...noBuffs, bonkHealStacks: 3 }, heal, loadoutSpells);
    expect(notes).toContain('Blessed stacks: 3 (+30% next heal)');
  });

  it('omits the pct suffix when the arming spell is not in the loadout', () => {
    const notes = bonkBuffHoverNotes({ ...noBuffs, bonkHealStacks: 2 }, heal, [heal]);
    expect(notes).toContain('Blessed stacks: 2');
  });

  it('shows armed next-heal potency only on heals', () => {
    const state = { ...noBuffs, nextHealPotencyPct: 25 };
    expect(bonkBuffHoverNotes(state, heal, loadoutSpells)).toContain('Next heal +25% potency');
    expect(bonkBuffHoverNotes(state, bonk, loadoutSpells)).not.toContain('Next heal +25% potency');
  });

  it('shows a pending next-spell mana discount on any spell', () => {
    const state = { ...noBuffs, nextSpellManaReduction: 1 };
    expect(bonkBuffHoverNotes(state, heal, loadoutSpells)).toContain('Next spell \u22121 mana');
    expect(bonkBuffHoverNotes(state, bonk, loadoutSpells)).toContain('Next spell \u22121 mana');
  });

  it('combines multiple active buffs on a heal', () => {
    const notes = bonkBuffHoverNotes(
      { bonkHealStacks: 1, nextHealPotencyPct: 20, nextSpellManaReduction: 1 },
      heal,
      loadoutSpells,
    );
    expect(notes).toEqual([
      'Blessed stacks: 1 (+10% next heal)',
      'Next heal +20% potency',
      'Next spell \u22121 mana',
    ]);
  });
});
