import { describe, expect, it } from 'vitest';
import { xpForLevel } from '../constants';
import { pendingCooldownSet, applyCooldownChoice } from './cooldownsChoice';

function makeSave(level: number, chosen: string[] = []) {
  return { xp: xpForLevel(level), chosenCooldownIds: [...chosen] };
}

describe('pendingCooldownSet', () => {
  it('returns null below level 6', () => {
    expect(pendingCooldownSet(makeSave(1))).toBeNull();
    expect(pendingCooldownSet(makeSave(5))).toBeNull();
  });

  it('returns A at level 6+ with 0 chosen CDs', () => {
    expect(pendingCooldownSet(makeSave(6))).toBe('A');
    expect(pendingCooldownSet(makeSave(7))).toBe('A');
    expect(pendingCooldownSet(makeSave(8))).toBe('A');
    expect(pendingCooldownSet(makeSave(10))).toBe('A');
  });

  it('returns B at level 8+ with exactly 1 Set-A CD chosen', () => {
    expect(pendingCooldownSet(makeSave(8, ['still-waters']))).toBe('B');
    expect(pendingCooldownSet(makeSave(8, ['wrath-ascendant']))).toBe('B');
    expect(pendingCooldownSet(makeSave(8, ['frenzied-liturgy']))).toBe('B');
    expect(pendingCooldownSet(makeSave(10, ['still-waters']))).toBe('B');
  });

  it('returns null at level 7 with 1 Set-A CD chosen (Set B not unlocked yet)', () => {
    expect(pendingCooldownSet(makeSave(7, ['still-waters']))).toBeNull();
  });

  it('returns null when 2 CDs are already chosen (both sets done)', () => {
    expect(pendingCooldownSet(makeSave(8, ['still-waters', 'iron-canticle']))).toBeNull();
    expect(pendingCooldownSet(makeSave(10, ['frenzied-liturgy', 'mercy-reserve']))).toBeNull();
  });

  it('returns null at level 8+ with 1 Set-B CD chosen but no Set-A (edge case: skip guard)', () => {
    // Set B chosen directly without Set A — gated by length+Set check, so returns null.
    expect(pendingCooldownSet(makeSave(8, ['iron-canticle']))).toBeNull();
  });
});

describe('applyCooldownChoice', () => {
  it('returns false when no pending set', () => {
    const save = makeSave(5);
    expect(applyCooldownChoice(save, 'still-waters')).toBe(false);
    expect(save.chosenCooldownIds).toEqual([]);
  });

  it('applies a valid Set A choice at level 6', () => {
    const save = makeSave(6);
    expect(applyCooldownChoice(save, 'still-waters')).toBe(true);
    expect(save.chosenCooldownIds).toEqual(['still-waters']);
  });

  it('applies all three Set A choices', () => {
    for (const id of ['still-waters', 'wrath-ascendant', 'frenzied-liturgy']) {
      const save = makeSave(6);
      expect(applyCooldownChoice(save, id)).toBe(true);
      expect(save.chosenCooldownIds).toEqual([id]);
    }
  });

  it('rejects a Set B id when Set A is pending', () => {
    const save = makeSave(8);
    expect(applyCooldownChoice(save, 'iron-canticle')).toBe(false);
    expect(save.chosenCooldownIds).toEqual([]);
  });

  it('applies a valid Set B choice after Set A has been chosen', () => {
    const save = makeSave(8, ['still-waters']);
    expect(applyCooldownChoice(save, 'iron-canticle')).toBe(true);
    expect(save.chosenCooldownIds).toEqual(['still-waters', 'iron-canticle']);
  });

  it('applies all three Set B choices', () => {
    for (const id of ['iron-canticle', 'mercy-reserve', 'ashen-rite']) {
      const save = makeSave(8, ['wrath-ascendant']);
      expect(applyCooldownChoice(save, id)).toBe(true);
      expect(save.chosenCooldownIds).toEqual(['wrath-ascendant', id]);
    }
  });

  it('rejects a Set A id when Set B is pending', () => {
    const save = makeSave(8, ['still-waters']);
    expect(applyCooldownChoice(save, 'wrath-ascendant')).toBe(false);
    expect(save.chosenCooldownIds).toEqual(['still-waters']);
  });

  it('rejects an unknown id', () => {
    const save = makeSave(6);
    expect(applyCooldownChoice(save, 'not-a-cooldown')).toBe(false);
    expect(save.chosenCooldownIds).toEqual([]);
  });

  it('returns false when no pending set (2 already chosen)', () => {
    const save = makeSave(8, ['still-waters', 'iron-canticle']);
    expect(applyCooldownChoice(save, 'mercy-reserve')).toBe(false);
  });
});
