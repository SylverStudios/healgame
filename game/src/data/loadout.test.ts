import { describe, expect, it } from 'vitest';
import { newSaveData } from '../save/save';
import { loadoutForSave, ownedSpellsForSave } from './loadout';
import { RADIAL_BONK, RADIAL_HEAL } from './radial/spells';
import { SPELLS } from './constants';

describe('loadoutForSave facade', () => {
  it('defaults lattice path to existing starter Bonk kit shape', () => {
    const save = newSaveData('lattice');
    save.unlockedSpells = [SPELLS.bonk.id, SPELLS.solemnMend.id];
    save.actionBar = [SPELLS.bonk.id, SPELLS.solemnMend.id, '', ''];
    const mods = loadoutForSave(save);
    expect(mods.spells.map((s) => s.id)).toEqual([SPELLS.bonk.id, SPELLS.solemnMend.id]);
  });

  it('radial path returns Heal + Bonk starters', () => {
    const save = newSaveData('radial');
    const mods = loadoutForSave(save);
    expect(mods.spells.map((s) => s.id)).toEqual([RADIAL_HEAL.id, RADIAL_BONK.id]);
    expect(ownedSpellsForSave(save).map((s) => s.name)).toEqual(['Heal', 'Bonk']);
  });
});
