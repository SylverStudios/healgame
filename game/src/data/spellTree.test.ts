/**
 * SPELL_TREE config integrity + combat resolve parity with buildLoadout.
 */

import { describe, expect, it } from 'vitest';
import { buildLoadout } from '../meta/progression';
import { newSaveData, type SaveData } from '../save/save';
import { SPELLS } from './constants';
import {
  SPELL_TREE,
  combatModsFromTree,
  ownedIdsFromLegacyRanks,
  resolveCombatMods,
  treeStateFromLegacy,
  type SpellTreeContent,
} from './spellTree';
import { create, ownedContents, update, validateConfig, view } from '../tree';

function save(overrides: Partial<SaveData> = {}): SaveData {
  return { ...newSaveData(), ...overrides };
}

describe('SPELL_TREE config', () => {
  it('validates', () => {
    expect(validateConfig(SPELL_TREE)).toBeNull();
  });

  it('has the expected spots (catalogue)', () => {
    expect(SPELL_TREE.spots.map((s) => s.id)).toEqual([
      'deep-reserves',
      'vigil-oath',
      'zealot-oath',
      'vigil-patient-vow',
      'vigil-measured-devotion',
      'zealot-fervent-chain',
      'zealot-desperate-zeal',
    ]);
  });

  it('models multi-rank nodes as chains', () => {
    expect(SPELL_TREE.spots.find((s) => s.id === 'deep-reserves')?.chain).toHaveLength(5);
    expect(SPELL_TREE.spots.find((s) => s.id === 'vigil-patient-vow')?.chain).toHaveLength(3);
    expect(SPELL_TREE.spots.find((s) => s.id === 'zealot-fervent-chain')?.chain).toHaveLength(3);
  });

  it('locks the rival oath via exclusiveGroup', () => {
    let state = create(SPELL_TREE, { gold: 100, ruby: 2 });
    // Buy first deep-reserves rank
    const root = update(SPELL_TREE, state, { type: 'purchase', spotId: 'deep-reserves' });
    expect(root.ok).toBe(true);
    if (!root.ok) return;
    state = root.state;

    const vigil = update(SPELL_TREE, state, { type: 'purchase', spotId: 'vigil-oath' });
    expect(vigil.ok).toBe(true);
    if (!vigil.ok) return;
    state = vigil.state;

    const zealot = update(SPELL_TREE, state, { type: 'purchase', spotId: 'zealot-oath' });
    expect(zealot.ok).toBe(false);
    if (zealot.ok) return;
    expect(zealot.reason).toBe('exclusive-locked');

    const zealotView = view(SPELL_TREE, state).spots.find((s) => s.id === 'zealot-oath');
    expect(zealotView?.status).toBe('exclusive-locked');
  });
});

describe('resolveCombatMods', () => {
  it('sums bonusMaxMana across owned rank contents', () => {
    const contents: SpellTreeContent[] = [
      {
        name: 'Deep Reserves',
        description: '',
        effect: { kind: 'bonusMaxMana', amount: 2 },
      },
      {
        name: 'Deep Reserves',
        description: '',
        effect: { kind: 'bonusMaxMana', amount: 2 },
      },
    ];
    expect(resolveCombatMods(contents, ['solemn-mend']).bonusMaxMana).toBe(4);
  });

  it('merges identical synergies and bakes castMod into spell defs', () => {
    const mods = resolveCombatMods(
      [
        {
          name: 'Patient Vow',
          description: '',
          effect: {
            kind: 'synergy',
            triggerSpellId: SPELLS.solemnMend.id,
            buffedSpellId: SPELLS.solemnVigil.id,
            bonusHeal: 1,
          },
        },
        {
          name: 'Patient Vow',
          description: '',
          effect: {
            kind: 'synergy',
            triggerSpellId: SPELLS.solemnMend.id,
            buffedSpellId: SPELLS.solemnVigil.id,
            bonusHeal: 1,
          },
        },
        {
          name: 'Path of the Vigil',
          description: '',
          effect: { kind: 'grantSpell', spellId: SPELLS.solemnVigil.id },
        },
        {
          name: 'Measured Devotion',
          description: '',
          effect: {
            kind: 'castMod',
            spellId: SPELLS.solemnVigil.id,
            castMsDelta: 1000,
            manaDelta: -3,
          },
        },
      ],
      ['solemn-mend'],
    );
    expect(mods.synergies).toEqual([
      {
        triggerSpellId: SPELLS.solemnMend.id,
        buffedSpellId: SPELLS.solemnVigil.id,
        bonusHeal: 2,
      },
    ]);
    const vigil = mods.spells.find((sp) => sp.id === SPELLS.solemnVigil.id);
    expect(vigil?.castMs).toBe(SPELLS.solemnVigil.castMs + 1000);
    expect(vigil?.mana).toBe(SPELLS.solemnVigil.mana - 3);
    expect(SPELLS.solemnVigil.castMs).toBe(3000); // catalog untouched
  });
});

describe('parity with buildLoadout', () => {
  function expectParity(treeRanks: Record<string, number>, unlockedSpells: string[]): void {
    const legacy = buildLoadout(save({ treeRanks, unlockedSpells }));
    const state = treeStateFromLegacy(treeRanks, { gold: 0, ruby: 0 });
    const next = combatModsFromTree(state, unlockedSpells);
    expect(next.bonusMaxMana).toBe(legacy.bonusMaxMana);
    expect(next.spells).toEqual(legacy.spells);
    expect(next.synergies).toEqual(legacy.synergies);
    expect(next.missingHealthBonuses).toEqual(legacy.missingHealthBonuses);
  }

  it('matches on a fresh kit', () => {
    expectParity({}, ['solemn-mend']);
  });

  it('matches maxed Vigil build', () => {
    expectParity(
      {
        'deep-reserves': 5,
        'vigil-oath': 1,
        'vigil-patient-vow': 3,
        'vigil-measured-devotion': 1,
      },
      ['solemn-mend', 'zealous-mending'],
    );
  });

  it('matches maxed Zealot build', () => {
    expectParity(
      {
        'deep-reserves': 5,
        'zealot-oath': 1,
        'zealot-fervent-chain': 3,
        'zealot-desperate-zeal': 1,
      },
      ['solemn-mend', 'zealous-mending'],
    );
  });

  it('matches partial ranks', () => {
    expectParity(
      { 'deep-reserves': 2, 'vigil-oath': 1, 'vigil-patient-vow': 1 },
      ['solemn-mend'],
    );
  });

  it('ownedIdsFromLegacyRanks expands ranks into chain ids', () => {
    expect(ownedIdsFromLegacyRanks({ 'deep-reserves': 3, 'vigil-oath': 1 })).toEqual([
      'deep-reserves-1',
      'deep-reserves-2',
      'deep-reserves-3',
      'vigil-oath',
    ]);
  });

  it('ownedContents is a flat bag combat can reduce (no layout)', () => {
    const state = treeStateFromLegacy(
      { 'deep-reserves': 2, 'zealot-oath': 1, 'zealot-desperate-zeal': 1 },
      { gold: 0, ruby: 0 },
    );
    const contents = ownedContents<SpellTreeContent>(SPELL_TREE, state);
    expect(contents.map((c) => c.effect.kind)).toEqual([
      'bonusMaxMana',
      'bonusMaxMana',
      'grantSpell',
      'missingHealthBonus',
    ]);
  });
});
