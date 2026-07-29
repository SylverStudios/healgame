import { describe, expect, it } from 'vitest';
import { loadoutFromRadialSave } from './resolve';
import { RADIAL_BONK, RADIAL_HEAL } from './spells';

describe('loadoutFromRadialSave (chunk 0 stub)', () => {
  it('returns Heal + Bonk from unlocked starters', () => {
    const mods = loadoutFromRadialSave({
      unlockedSpells: [RADIAL_HEAL.id, RADIAL_BONK.id],
    });
    expect(mods.spells.map((s) => s.id)).toEqual([RADIAL_HEAL.id, RADIAL_BONK.id]);
    expect(mods.spells[0]?.name).toBe('Heal');
    expect(mods.spells[1]?.name).toBe('Bonk');
  });

  it('filters fight kit through action bar order', () => {
    const mods = loadoutFromRadialSave({
      unlockedSpells: [RADIAL_HEAL.id, RADIAL_BONK.id],
      actionBar: [RADIAL_BONK.id, RADIAL_HEAL.id, '', ''],
    });
    expect(mods.spells.map((s) => s.id)).toEqual([RADIAL_BONK.id, RADIAL_HEAL.id]);
  });
});
