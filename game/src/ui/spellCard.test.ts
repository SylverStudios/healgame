import { describe, expect, it } from 'vitest';
import { SPELLS } from '../data/constants';
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
  });

  it('formats a damage spell with cooldown and cast-buff note', () => {
    const card = buildSpellCard(SPELLS.vowstrikeVirtue);
    expect(card.effect).toBe('Damage front 5');
    expect(card.effectTone).toBe('damage');
    expect(card.cast).toBe('Instant');
    expect(card.cooldown).toBe('10s');
    expect(card.notes).toEqual(['Next spell costs 2 less mana']);
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
