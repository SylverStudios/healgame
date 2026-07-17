import { describe, expect, it } from 'vitest';
import { RELICS } from '../data/relics';
import { relicColorRole, relicGlyphColor } from './relicColors';

const ROLE_BY_ID: Record<string, 'defense' | 'offense' | 'healing'> = {
  'ember-ledger': 'healing',
  'triage-bell': 'healing',
  'still-reservoir': 'healing',
  'vital-ember': 'defense',
  'bastion-plate': 'defense',
  'iron-ward': 'defense',
  'twin-fang': 'offense',
  quicksteel: 'offense',
  'warblood-gem': 'offense',
  'vanguard-sigil': 'offense',
};

function channel(color: number, shift: number): number {
  return (color >> shift) & 0xff;
}

describe('relicColorRole', () => {
  it('classifies every catalog relic into the playtest color roles', () => {
    for (const relic of RELICS) {
      expect(relicColorRole(relic.effects), relic.id).toBe(ROLE_BY_ID[relic.id]);
    }
  });

  it('treats hybrid damage+HP as offense', () => {
    expect(
      relicColorRole([
        { kind: 'roleMaxHp', role: 'dps', amount: 3 },
        { kind: 'roleAutoDamage', role: 'dps', amount: 1 },
      ]),
    ).toBe('offense');
  });
});

describe('relicGlyphColor', () => {
  it('keeps healing relics in the green channel, offense in red, defense grey', () => {
    for (const relic of RELICS) {
      const color = relicGlyphColor(relic);
      const r = channel(color, 16);
      const g = channel(color, 8);
      const b = channel(color, 0);
      const role = ROLE_BY_ID[relic.id]!;
      if (role === 'healing') {
        expect(g, relic.id).toBeGreaterThan(r);
        expect(g, relic.id).toBeGreaterThan(b);
      } else if (role === 'offense') {
        expect(r, relic.id).toBeGreaterThan(g);
        expect(r, relic.id).toBeGreaterThan(b);
      } else {
        // Greyscale: channels within a small band.
        expect(Math.abs(r - g), relic.id).toBeLessThanOrEqual(8);
        expect(Math.abs(g - b), relic.id).toBeLessThanOrEqual(8);
      }
    }
  });
});
