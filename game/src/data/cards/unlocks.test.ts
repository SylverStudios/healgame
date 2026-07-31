import { describe, expect, it } from 'vitest';
import {
  CARD_SLOTS,
  CARD_UNLOCKS,
  cardsLevelUpWelcome,
  cooldownIdsAtLevel,
  spellIdsAtLevel,
  unlocksAtOrBelowLevel,
} from './unlocks';

describe('CARD_UNLOCKS (§3 table)', () => {
  it('exposes two upgrade slots per card', () => {
    expect(CARD_SLOTS).toBe(2);
  });

  it('M5: encodes only spell rows — no cooldown auto-grants', () => {
    expect(CARD_UNLOCKS).toEqual([
      { id: 'heal', kind: 'spell', minLevel: 1 },
      { id: 'bonk', kind: 'spell', minLevel: 1 },
      { id: 'mend', kind: 'spell', minLevel: 2 },
      { id: 'vowstrike', kind: 'spell', minLevel: 5 },
    ]);
    expect(CARD_UNLOCKS.every((u) => u.kind === 'spell')).toBe(true);
  });
});

describe('unlocksAtOrBelowLevel / spellIdsAtLevel / cooldownIdsAtLevel', () => {
  it('level 1 starts with heal + bonk only', () => {
    expect(spellIdsAtLevel(1)).toEqual(['heal', 'bonk']);
    expect(cooldownIdsAtLevel(1)).toEqual([]);
    expect(unlocksAtOrBelowLevel(1).map((u) => u.id)).toEqual(['heal', 'bonk']);
  });

  it('level 2 adds mend', () => {
    expect(spellIdsAtLevel(2)).toEqual(['heal', 'bonk', 'mend']);
    expect(cooldownIdsAtLevel(2)).toEqual([]);
  });

  it('levels 3–4 share the level-2 library (4 grants no upgrade point)', () => {
    expect(spellIdsAtLevel(3)).toEqual(spellIdsAtLevel(2));
    expect(spellIdsAtLevel(4)).toEqual(spellIdsAtLevel(2));
    expect(cooldownIdsAtLevel(4)).toEqual([]);
  });

  it('level 5 adds vowstrike beside bonk', () => {
    expect(spellIdsAtLevel(5)).toEqual(['heal', 'bonk', 'mend', 'vowstrike']);
    expect(cooldownIdsAtLevel(5)).toEqual([]);
  });

  it('M5: levels 6–9 yield empty cooldown list (CDs are player-chosen)', () => {
    expect(cooldownIdsAtLevel(6)).toEqual([]);
    expect(cooldownIdsAtLevel(7)).toEqual([]);
    expect(cooldownIdsAtLevel(8)).toEqual([]);
    expect(cooldownIdsAtLevel(9)).toEqual([]);
    expect(spellIdsAtLevel(8)).toEqual(['heal', 'bonk', 'mend', 'vowstrike']);
  });

  it('level 9+ adds no new unlocks (same library as 8)', () => {
    expect(spellIdsAtLevel(9)).toEqual(spellIdsAtLevel(8));
    expect(cooldownIdsAtLevel(9)).toEqual([]);
    expect(cooldownIdsAtLevel(12)).toEqual([]);
  });

  it('level 0 / negative yields an empty library', () => {
    expect(unlocksAtOrBelowLevel(0)).toEqual([]);
    expect(spellIdsAtLevel(0)).toEqual([]);
    expect(cooldownIdsAtLevel(-1)).toEqual([]);
  });
});

describe('cardsLevelUpWelcome', () => {
  it('M5: L6 and L8 mention CD choice; L4 is unlucky; others are generic', () => {
    expect(cardsLevelUpWelcome(2)).toBe('Welcome to level 2');
    expect(cardsLevelUpWelcome(4)).toBe('Welcome to unlucky level 4');
    expect(cardsLevelUpWelcome(6)).toBe('Welcome to level 6 — choose a major cooldown');
    expect(cardsLevelUpWelcome(8)).toBe('Welcome to lucky level 8 — choose your second cooldown');
  });
});
