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
import { armedSynergyBonus, effectiveHealAmount, willBuffSpell } from './effective';
import { biasAfterWipe, createGodPlayer } from './godPlayer';
import { runHeadless } from './headless';
import {
  healPerManaMillis,
  healPerSecondMillis,
  isEmergency,
  pickHealTarget,
} from './heals';
import { kitAtLevel, saveAtLevel } from './kit';
import { BASIC_CHIP_PLAN, GOD_CHIP_PLAN } from './loadouts';
import { createSeededRng } from './rng';
import type { CombatState, Unit } from '../combat/types';

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

function bareState(overrides: Partial<CombatState> = {}): CombatState {
  return {
    party: [],
    enemies: [],
    playerCast: null,
    bossCast: null,
    targetId: null,
    gcdRemainingMs: 0,
    queuedSpellId: null,
    waveIndex: 0,
    status: 'running',
    spellCooldowns: [],
    cooldowns: [],
    armedBuffedSpellIds: [],
    armedManaDiscountSpellIds: [],
    nextSpellManaReduction: 0,
    nextHealPotencyPct: 0,
    bonkHealStacks: 0,
    ...overrides,
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

describe('kitAtLevel cards chips + upgrades', () => {
  it('basic kit owns simple chips and block ranks', () => {
    const save = saveAtLevel(5, 'basic');
    expect(save.spellChips.heal).toEqual(['heal-graven', 'heal-heavy']);
    expect(save.spellChips.mend).toEqual(['mend-surge', 'mend-penny']);
    expect(save.spellChips.bonk).toEqual(['bonk-mana', 'bonk-vow-link']);
    expect(save.secondaryRanks.block).toBe(4); // levels 2..5 → 4 picks
    expect(save.chosenCooldownIds).toEqual([]);
  });

  it('god kit stacks mend→heal links and picks liturgy at L6', () => {
    const save = saveAtLevel(8, 'god');
    expect(save.spellChips.heal).toEqual(['heal-mend-link', 'heal-vigor']);
    expect(save.spellChips.mend).toEqual(['mend-arming', 'mend-penny']);
    expect(save.spellChips.bonk?.[0]).toBe('bonk-mana');
    expect(save.chosenCooldownIds).toEqual(['frenzied-liturgy', 'iron-canticle']);
    // L8 → 7 picks: block×3, then manaRegen, crit, haste, block
    expect(save.secondaryRanks.block).toBe(4);
    expect(save.secondaryRanks.manaRegen).toBe(1);
    const loadout = kitAtLevel(8, 'god');
    const healSyn = loadout.synergies.filter((s) => s.buffedSpellId === 'heal');
    expect(healSyn.reduce((n, s) => n + s.bonusHeal, 0)).toBe(4);
    expect(loadout.cooldowns.map((c) => c.id)).toContain('frenzied-liturgy');
  });

  it('does not purchase slot-2 chips before level 5', () => {
    const save = saveAtLevel(3, 'god');
    expect(save.spellChips.heal).toEqual(['heal-mend-link']);
    expect(save.spellChips.mend).toEqual(['mend-arming']);
  });

  it('exposes baked plans for both profiles', () => {
    expect(BASIC_CHIP_PLAN.some((p) => p.chipId === 'heal-graven')).toBe(true);
    expect(GOD_CHIP_PLAN.some((p) => p.chipId === 'mend-arming')).toBe(true);
  });
});

describe('combo-aware effective heal', () => {
  it('adds armed mend→heal synergy to Heal amount', () => {
    const loadout = kitAtLevel(5, 'god');
    const heal = loadout.spells.find((s) => s.id === 'heal')!;
    const target = unit({ id: 'tank', hp: 10, maxHp: 20, role: 'tank' });
    const unarmed = effectiveHealAmount(heal, target, bareState(), loadout);
    const armed = effectiveHealAmount(
      heal,
      target,
      bareState({ armedBuffedSpellIds: ['heal'] }),
      loadout,
    );
    expect(armed).toBe(unarmed + 4);
    expect(armedSynergyBonus('heal', bareState({ armedBuffedSpellIds: ['heal'] }), loadout)).toBe(4);
  });

  it('treats an in-flight Mend as soon-to-arm for Heal', () => {
    const loadout = kitAtLevel(5, 'god');
    expect(
      willBuffSpell(
        'heal',
        bareState({
          playerCast: { spellId: 'mend', targetId: 'tank', remainingMs: 500, totalMs: 1500 },
        }),
        loadout,
      ),
    ).toBe(true);
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
    expect(formatPlaytestLevelRange({ god: 6, basic: 5 })).toBe('Lv 5–6');
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
    const loadout = kitAtLevel(1, 'basic');
    const run = runHeadless(ASH_GATE, createBasicPlayer(loadout.spells), {
      loadout,
      random: createSeededRng(1),
    });
    expect(['wipe', 'timeout']).toContain(run.status);
  });

  it('god bot casts heals with the combo kit', () => {
    const loadout = kitAtLevel(8, 'god');
    const run = runHeadless(ASH_GATE, createGodPlayer(loadout), {
      loadout,
      random: createSeededRng(2),
    });
    expect(run.healsCast).toBeGreaterThan(0);
    expect(run.overhealTotal).toBeLessThan(run.healsCast * 6);
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
