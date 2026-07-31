import { describe, expect, it } from 'vitest';
import { ASH_GATE } from '../data/encounters';
import { SPELLS } from '../data/constants';
import { createBasicPlayer } from './basicPlayer';
import {
  findBasicClearLevel,
  findGodClearLevel,
  formatPlaytestLevelRange,
  toPlaytestLevelRange,
} from './curve';
import { biasAfterWipe, createGodPlayer } from './godPlayer';
import { runHeadless } from './headless';
import {
  healPerManaMillis,
  healPerSecondMillis,
  isEmergency,
  pickHealTarget,
} from './heals';
import { kitAtLevel } from './kit';
import { createSeededRng } from './rng';
import type { Unit } from '../combat/types';

function unit(partial: Partial<Unit> & Pick<Unit, 'id' | 'hp' | 'maxHp'>): Unit {
  return {
    name: partial.id,
    role: 'tank',
    mana: 0,
    maxMana: 0,
    alive: true,
    ...partial,
  };
}

describe('playtest heal helpers', () => {
  it('scores Heal more mana-efficient than a pricey fast mend', () => {
    const heal = { id: 'heal', name: 'Heal', heal: 4, mana: 3, castMs: 2000 };
    const pricey = { id: 'fast', name: 'Fast', heal: 4, mana: 4, castMs: 1000 };
    expect(healPerManaMillis(heal)).toBeGreaterThan(healPerManaMillis(pricey));
    expect(healPerSecondMillis(pricey)).toBeGreaterThan(healPerSecondMillis(heal));
  });

  it('picks the lowest HP% living ally and treats dying as top priority', () => {
    const party = [
      unit({ id: 'tank', hp: 10, maxHp: 20, role: 'tank' }),
      unit({ id: 'dps', hp: 2, maxHp: 10, role: 'dps' }),
      unit({ id: 'healer', hp: 15, maxHp: 15, role: 'healer' }),
    ];
    expect(pickHealTarget(party)?.id).toBe('dps');
    party[0] = unit({ id: 'tank', hp: 0, maxHp: 20, role: 'tank', dying: true });
    expect(pickHealTarget(party)?.id).toBe('tank');
  });

  it('flags emergency below 40% HP or dying', () => {
    expect(isEmergency(unit({ id: 'a', hp: 3, maxHp: 10 }))).toBe(true);
    expect(isEmergency(unit({ id: 'b', hp: 5, maxHp: 10 }))).toBe(false);
    expect(isEmergency(unit({ id: 'c', hp: 0, maxHp: 10, dying: true }))).toBe(true);
  });
});

describe('kitAtLevel', () => {
  it('grants cards unlocks and level mana/HP by level', () => {
    const lv1 = kitAtLevel(1);
    expect(lv1.spells.map((s) => s.id).sort()).toEqual(['bonk', 'heal']);
    expect(lv1.bonusMaxMana).toBe(0);

    const lv2 = kitAtLevel(2);
    expect(lv2.spells.map((s) => s.id)).toContain('mend');
    expect(lv2.bonusMaxMana).toBeGreaterThan(0);

    const lv5 = kitAtLevel(5);
    expect(lv5.spells.map((s) => s.id)).toContain('vowstrike');
  });
});

describe('biasAfterWipe', () => {
  it('treats leftover mana as a heal-output problem', () => {
    expect(biasAfterWipe(3)).toBe('throughput');
    expect(biasAfterWipe(0)).toBe('efficiency');
  });
});

describe('formatPlaytestLevelRange', () => {
  it('formats god→basic and collapses equals', () => {
    expect(formatPlaytestLevelRange({ god: 2, basic: 5 })).toBe('Lv 2–5');
    expect(formatPlaytestLevelRange({ god: 3, basic: 3 })).toBe('Lv 3');
    expect(formatPlaytestLevelRange(null)).toBe('');
    expect(toPlaytestLevelRange({ dungeonId: 'x', dungeonName: 'X', godLevel: 2, basicLevel: 4 })).toEqual({
      god: 2,
      basic: 4,
    });
  });
});

describe('headless bots on Ash Gate', () => {
  it('basic bot at level 1 does not cruise Ash Gate', () => {
    const loadout = kitAtLevel(1);
    const run = runHeadless(ASH_GATE, createBasicPlayer(loadout.spells), {
      loadout,
      random: createSeededRng(1),
    });
    // Starting kit + clumsy play should not be a free clear.
    expect(['wipe', 'timeout']).toContain(run.status);
  });

  it('god bot casts heals and never records absurd overheal on a short Ash Gate scrape', () => {
    const loadout = kitAtLevel(8);
    const run = runHeadless(ASH_GATE, createGodPlayer(loadout.spells, loadout.cooldowns), {
      loadout,
      random: createSeededRng(2),
    });
    expect(run.healsCast).toBeGreaterThan(0);
    // Overheal can be nonzero on the last tick of a save, but should stay modest.
    expect(run.overhealTotal).toBeLessThan(run.healsCast * 4);
  });

  it('finds a finite god clear level for Ash Gate within the sweep cap', () => {
    const level = findGodClearLevel(ASH_GATE, { maxLevel: 14 });
    expect(level).not.toBeNull();
    expect(level!).toBeGreaterThanOrEqual(1);
    expect(level!).toBeLessThanOrEqual(14);
  });

  it('basic clear level is at least the god clear level on Ash Gate', () => {
    const god = findGodClearLevel(ASH_GATE, { maxLevel: 14 });
    const basic = findBasicClearLevel(ASH_GATE, { maxLevel: 14 });
    expect(god).not.toBeNull();
    expect(basic).not.toBeNull();
    expect(basic!).toBeGreaterThanOrEqual(god!);
  });
});

describe('seeded rng', () => {
  it('is deterministic for the same seed', () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('lattice SPELLS still available for balanceBot', () => {
  it('keeps Solemn Mend as the lattice starter heal id', () => {
    expect(SPELLS.solemnMend.id).toBe('solemn-mend');
  });
});
