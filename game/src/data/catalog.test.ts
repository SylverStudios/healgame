/**
 * Catalog smoke tests for Alpha 0.2 chunk 1 — spell/cooldown data integrity.
 */

import { describe, expect, it } from 'vitest';
import { ALL_SPELLS, spellById } from './spells';
import { COOLDOWNS, cooldownById } from './cooldowns';

describe('Vowstrike spells', () => {
  it('vowstrike-virtue has castMs 0', () => {
    const spell = spellById('vowstrike-virtue');
    expect(spell).toBeDefined();
    expect(spell!.castMs).toBe(0);
  });

  it('vowstrike-vengeance has castMs 0', () => {
    const spell = spellById('vowstrike-vengeance');
    expect(spell).toBeDefined();
    expect(spell!.castMs).toBe(0);
  });

  it('vowstrike-virtue has locked numbers', () => {
    const spell = spellById('vowstrike-virtue');
    expect(spell!.heal).toBe(3);
    expect(spell!.mana).toBe(2);
    expect(spell!.id).toBe('vowstrike-virtue');
    expect(spell!.name).toBe('Vowstrike: Absolution');
  });

  it('vowstrike-vengeance has locked numbers', () => {
    const spell = spellById('vowstrike-vengeance');
    expect(spell!.heal).toBe(2);
    expect(spell!.mana).toBe(2);
    expect(spell!.id).toBe('vowstrike-vengeance');
    expect(spell!.name).toBe('Vowstrike: Reckoning');
  });
});

describe('Wrath Ascendant cooldown', () => {
  it('is retrievable by id', () => {
    const cd = cooldownById('wrath-ascendant');
    expect(cd).toBeDefined();
  });

  it('has healBonus effect with bonusHeal 2', () => {
    const cd = cooldownById('wrath-ascendant');
    expect(cd!.effect.kind).toBe('healBonus');
    if (cd!.effect.kind === 'healBonus') {
      expect(cd!.effect.bonusHeal).toBe(2);
      expect(cd!.effect.durationMs).toBe(12_000);
    }
  });

  it('has correct cooldown and glyph', () => {
    const cd = cooldownById('wrath-ascendant');
    expect(cd!.cooldownMs).toBe(45_000);
    expect(cd!.glyph).toBe('W');
  });
});

describe('glyph coverage', () => {
  it('all ALL_SPELLS entries have a non-empty glyph', () => {
    for (const spell of ALL_SPELLS) {
      expect(spell.glyph, `${spell.id} missing glyph`).toBeTruthy();
    }
  });

  it('all COOLDOWNS entries have a non-empty glyph', () => {
    for (const cd of COOLDOWNS) {
      expect(cd.glyph, `${cd.id} missing glyph`).toBeTruthy();
    }
  });

  it('glyph assignments match the locked table', () => {
    const expected: Record<string, string> = {
      'solemn-mend': 'M',
      'zealous-mending': 'Z',
      'solemn-vigil': 'G',
      'zealous-flare': 'F',
      'vowstrike-virtue': 'V',
      'vowstrike-vengeance': 'X',
      'still-waters': 'S',
      'frenzied-liturgy': 'L',
      'wrath-ascendant': 'W',
    };

    for (const spell of ALL_SPELLS) {
      if (expected[spell.id]) {
        expect(spell.glyph, `${spell.id} glyph mismatch`).toBe(expected[spell.id]);
      }
    }
    for (const cd of COOLDOWNS) {
      if (expected[cd.id]) {
        expect(cd.glyph, `${cd.id} glyph mismatch`).toBe(expected[cd.id]);
      }
    }
  });
});
