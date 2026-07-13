import { describe, expect, it } from 'vitest';
import { oathRunMod, runModsFromSave } from './runMods';

describe('runModsFromSave', () => {
  it('returns nothing before oath or relic', () => {
    expect(runModsFromSave({ subclass: null, relicId: null })).toEqual([]);
  });

  it('lists sworn oath first with tree name/description', () => {
    const mods = runModsFromSave({ subclass: 'vigil', relicId: null });
    expect(mods).toHaveLength(1);
    expect(mods[0]).toMatchObject({
      id: 'vigil-oath',
      kind: 'oath',
      name: 'Path of the Vigil',
    });
    expect(mods[0]!.description.length).toBeGreaterThan(0);
  });

  it('lists oath then relic when both are present', () => {
    const mods = runModsFromSave({ subclass: 'zealot', relicId: 'triage-bell' });
    expect(mods.map((m) => m.id)).toEqual(['zealot-oath', 'triage-bell']);
    expect(mods[1]).toMatchObject({
      kind: 'relic',
      name: 'Triage Bell',
    });
  });

  it('oathRunMod matches the sworn subclass node', () => {
    expect(oathRunMod('zealot').id).toBe('zealot-oath');
    expect(oathRunMod('vigil').name).toBe('Path of the Vigil');
  });
});
