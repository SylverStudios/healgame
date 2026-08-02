import { describe, expect, it } from 'vitest';
import { SPELLS } from '../data/constants';
import type { SpellDef } from '../combat/types';
import type { CombatMods } from '../data/talentTree';
import { buildSpellCard } from './spellCard';

const emptyLoadout: CombatMods = {
  spells: [],
  bonusMaxMana: 0,
  synergies: [],
  missingHealthBonuses: [],
  missingHealthPctBonuses: [],
  fullHealthBonuses: [],
  paceMultipliersTenths: [],
  cooldowns: [],
};

describe('buildSpellCard', () => {
  it('formats a heal spell into fixed slots', () => {
    const card = buildSpellCard(SPELLS.solemnMend);
    expect(card).toMatchObject({
      name: 'Solemn Mend',
      effect: 'Heal target 4',
      effectTone: 'heal',
      cost: '3',
      cast: '2.0s',
      cooldown: null,
      description: 'Efficient single-target mend. Prefer when the fight is calm.',
      notes: [],
      eyebrow: null,
    });
    // Digits only — UI draws the blue orb; never `3m` / `(3m)`.
    expect(card.cost).not.toMatch(/m/);
  });

  it('formats a damage spell with cooldown and cast-buff note', () => {
    const card = buildSpellCard(SPELLS.vowstrikeVirtue);
    expect(card.effect).toBe('Damage front 7');
    expect(card.effectTone).toBe('damage');
    expect(card.cast).toBe('Instant');
    expect(card.cooldown).toBe('6s');
    expect(card.notes).toEqual(['Next spell costs 2 less mana']);
  });

  it('describes a stacking next-heal cast buff', () => {
    const stackSpell: SpellDef = {
      ...SPELLS.solemnMend,
      castBuff: { kind: 'stackNextHealPotencyPct', pct: 10, cap: 3 },
    };
    const card = buildSpellCard(stackSpell);
    expect(card.notes).toContain('Each hit stacks +10% next heal (cap 3)');
  });

  it('appends live buff notes after static/loadout notes', () => {
    const card = buildSpellCard(SPELLS.solemnMend, {
      liveBuffNotes: ['Blessed stacks: 2 (+20% next heal)'],
    });
    expect(card.notes).toEqual(['Blessed stacks: 2 (+20% next heal)']);
  });

  it('includes loadout synergies as gold notes', () => {
    const loadout: CombatMods = {
      ...emptyLoadout,
      spells: [SPELLS.solemnMend, SPELLS.solemnVigil],
      synergies: [
        {
          triggerSpellId: SPELLS.solemnMend.id,
          buffedSpellId: SPELLS.solemnVigil.id,
          bonusHeal: 2,
        },
      ],
    };
    const onTrigger = buildSpellCard(SPELLS.solemnMend, { loadout });
    expect(onTrigger.notes).toContain('Arms +2 on your next Solemn Vigil');

    const onBuffed = buildSpellCard(SPELLS.solemnVigil, { loadout });
    expect(onBuffed.notes).toContain('+2 heal when armed by Solemn Mend');
  });

  it('allows tree unlocks to override description and set an eyebrow', () => {
    const card = buildSpellCard(SPELLS.solemnVigil, {
      eyebrow: 'Path of the Vigil — 1 point',
      description: 'Swear the Vigil oath (locks out the Zealot).',
    });
    expect(card.eyebrow).toBe('Path of the Vigil — 1 point');
    expect(card.name).toBe('Solemn Vigil');
    expect(card.effect).toBe('Heal target 6');
    expect(card.description).toBe('Swear the Vigil oath (locks out the Zealot).');
  });
});

describe('buildSpellCard (+N) heal bonus', () => {
  it('shows no (+N) when no bonus applies', () => {
    const card = buildSpellCard(SPELLS.solemnMend);
    expect(card.effect).toBe('Heal target 4');
  });

  it('adds (+N) for relic bonusHealing only', () => {
    const card = buildSpellCard(SPELLS.solemnMend, { bonusHealing: 1 });
    expect(card.effect).toBe('Heal target 4 (+1)');
  });

  it('adds (+N) for talent-baked heal delta (loadout heal > catalog base)', () => {
    // Talent bumps solemn-mend from catalog 4 → 6; delta = 2.
    // Effect line always shows catalog base: Heal target 4 (+2).
    const talentSpell: SpellDef = { ...SPELLS.solemnMend, heal: 6 };
    const card = buildSpellCard(talentSpell);
    expect(card.effect).toBe('Heal target 4 (+2)');
  });

  it('combines relic + talent-baked + activeFlatHealBonus into a single (+N)', () => {
    // talent: 6 - 4 = 2; relic: 1; activeFlat: 3 → combined 6
    const talentSpell: SpellDef = { ...SPELLS.solemnMend, heal: 6 };
    const card = buildSpellCard(talentSpell, { bonusHealing: 1, activeFlatHealBonus: 3 });
    expect(card.effect).toBe('Heal target 4 (+6)');
  });

  it('leaves damage spell effect unchanged when bonusHealing is set', () => {
    const card = buildSpellCard(SPELLS.vowstrikeVirtue, { bonusHealing: 5, activeFlatHealBonus: 2 });
    expect(card.effect).toBe('Damage front 7');
  });

  it('does not include target-conditional bonuses (missing/full health) in (+N)', () => {
    const loadout: CombatMods = {
      ...emptyLoadout,
      spells: [SPELLS.solemnMend],
      missingHealthBonuses: [{ spellId: SPELLS.solemnMend.id, healPer10PctMissing: 2 }],
      fullHealthBonuses: [{ spellId: SPELLS.solemnMend.id, hpPctAtLeast: 80, bonusHeal: 1 }],
    };
    const card = buildSpellCard(SPELLS.solemnMend, { loadout });
    // No relic / talent / activeFlat passed → no (+N)
    expect(card.effect).toBe('Heal target 4');
    // Conditional bonuses still appear in notes
    expect(card.notes.some((n) => n.includes('missing'))).toBe(true);
    expect(card.notes.some((n) => n.includes('80%'))).toBe(true);
  });
});
