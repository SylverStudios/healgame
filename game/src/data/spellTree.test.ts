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
  legacyRanksFromOwned,
  loadoutFromSave,
  ownedIdsFromLegacyRanks,
  resolveCombatMods,
  treeStateFromLegacy,
  type SpellTreeContent,
} from './spellTree';
import { create, ownedContents, ownedOf, update, validateConfig, view, walletOf } from '../tree';

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
      'vigil-graven-scale',
      'zealot-fervent-chain',
      'zealot-steady-hands',
    ]);
  });

  it('retires zealot-desperate-zeal — absent from the live tree (Alpha 0.1 §D4)', () => {
    expect(SPELL_TREE.spots.map((s) => s.id)).not.toContain('zealot-desperate-zeal');
    expect(SPELL_TREE.nodes.map((n) => n.id)).not.toContain('zealot-desperate-zeal');
  });

  it('models multi-rank nodes as chains', () => {
    expect(SPELL_TREE.spots.find((s) => s.id === 'deep-reserves')?.chain).toHaveLength(5);
    expect(SPELL_TREE.spots.find((s) => s.id === 'vigil-patient-vow')?.chain).toHaveLength(3);
    expect(SPELL_TREE.spots.find((s) => s.id === 'zealot-fervent-chain')?.chain).toHaveLength(3);
  });

  it('locks the rival oath via exclusiveGroup', () => {
    let state = create(SPELL_TREE, { gold: 100, ruby: 2 });
    const root = update(SPELL_TREE, state, { type: 'purchase', spotId: 'deep-reserves' });
    expect(root.ok).toBe(true);
    if (!root.ok) return;
    state = root.state;

    const vigil = update(SPELL_TREE, state, { type: 'purchase', spotId: 'vigil-oath' });
    expect(vigil.ok).toBe(true);
    if (!vigil.ok) return;
    state = vigil.state;

    const zealotSpotPurchase = update(SPELL_TREE, state, { type: 'purchase', spotId: 'zealot-oath' });
    expect(zealotSpotPurchase.ok).toBe(true);
    if (!zealotSpotPurchase.ok) return;
    expect(ownedOf(zealotSpotPurchase.state)).not.toContain('zealot-oath');
    expect(ownedOf(zealotSpotPurchase.state)).toContain('warped-tempo-via-zealot');

    const zealotView = view(SPELL_TREE, zealotSpotPurchase.state).spots.find((s) => s.id === 'zealot-oath');
    expect(zealotView?.next?.id).toBe('zealot-oath');
    expect(zealotView?.status).toBe('exclusive-locked');
  });

  it('offers forsaken-path tempo on the rival spot after swearing an oath', () => {
    let state = create(SPELL_TREE, { gold: 10, ruby: 2 });
    const root = update(SPELL_TREE, state, { type: 'purchase', spotId: 'deep-reserves' });
    expect(root.ok).toBe(true);
    if (!root.ok) return;
    state = root.state;

    const vigil = update(SPELL_TREE, state, { type: 'purchase', spotId: 'vigil-oath' });
    expect(vigil.ok).toBe(true);
    if (!vigil.ok) return;
    state = vigil.state;

    const zealotSpot = view(SPELL_TREE, state).spots.find((s) => s.id === 'zealot-oath');
    expect(zealotSpot?.next?.id).toBe('warped-tempo-via-zealot');

    const tempo = update(SPELL_TREE, state, { type: 'purchase', spotId: 'zealot-oath' });
    expect(tempo.ok).toBe(true);
    if (!tempo.ok) return;
    state = tempo.state;

    const vigilSpot = view(SPELL_TREE, state).spots.find((s) => s.id === 'vigil-oath');
    expect(vigilSpot?.next?.id).toBe('warped-tempo-via-vigil');
    expect(vigilSpot?.status).toBe('locked');

    const rivalTempo = update(SPELL_TREE, state, { type: 'purchase', spotId: 'vigil-oath' });
    expect(rivalTempo.ok).toBe(false);
    if (rivalTempo.ok) return;
    expect(rivalTempo.reason).toBe('requirements-unmet');
  });

  it('adds 1.5× pace to CombatMods when warped tempo is owned', () => {
    const mods = resolveCombatMods(
      [
        {
          name: 'Warped Tempo',
          description: '',
          effect: { kind: 'combatPace', multiplierTenths: 15 },
        },
      ],
      ['solemn-mend'],
    );
    expect(mods.paceMultipliersTenths).toEqual([10, 15]);
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
    expect(next.missingHealthPctBonuses).toEqual(legacy.missingHealthPctBonuses);
    expect(next.fullHealthBonuses).toEqual(legacy.fullHealthBonuses);
    expect(next.paceMultipliersTenths).toEqual(legacy.paceMultipliersTenths);
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
        'zealot-steady-hands': 1,
      },
      ['solemn-mend', 'zealous-mending'],
    );
  });

  it('matches maxed Vigil build with Graven Scale', () => {
    expectParity(
      {
        'deep-reserves': 5,
        'vigil-oath': 1,
        'vigil-patient-vow': 3,
        'vigil-measured-devotion': 1,
        'vigil-graven-scale': 1,
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

  it('legacyRanksFromOwned round-trips with ownedIdsFromLegacyRanks', () => {
    const ranks = {
      'deep-reserves': 5,
      'vigil-oath': 1,
      'vigil-patient-vow': 2,
      'vigil-measured-devotion': 1,
    };
    expect(legacyRanksFromOwned(ownedIdsFromLegacyRanks(ranks))).toEqual(ranks);
  });

  it('ownedContents is a flat bag combat can reduce (no layout)', () => {
    const state = treeStateFromLegacy(
      { 'deep-reserves': 2, 'zealot-oath': 1, 'zealot-steady-hands': 1 },
      { gold: 0, ruby: 0 },
    );
    const contents = ownedContents<SpellTreeContent>(SPELL_TREE, state);
    expect(contents.map((c) => c.effect.kind)).toEqual([
      'bonusMaxMana',
      'bonusMaxMana',
      'grantSpell',
      'fullHealthBonus',
    ]);
  });

  it('round-trips the new Alpha 0.1 node ids through the legacy bridge', () => {
    const ranks = {
      'deep-reserves': 1,
      'vigil-oath': 1,
      'vigil-patient-vow': 1,
      'vigil-graven-scale': 1,
    };
    expect(legacyRanksFromOwned(ownedIdsFromLegacyRanks(ranks))).toEqual(ranks);

    const zealotRanks = {
      'deep-reserves': 1,
      'zealot-oath': 1,
      'zealot-fervent-chain': 1,
      'zealot-steady-hands': 1,
    };
    expect(legacyRanksFromOwned(ownedIdsFromLegacyRanks(zealotRanks))).toEqual(zealotRanks);
  });

  it('resolveCombatMods emits missingHealthPctBonus for a purchased Graven Scale', () => {
    const state = treeStateFromLegacy(
      { 'deep-reserves': 1, 'vigil-oath': 1, 'vigil-patient-vow': 1, 'vigil-graven-scale': 1 },
      { gold: 0, ruby: 0 },
    );
    const mods = combatModsFromTree(state, ['solemn-mend']);
    expect(mods.missingHealthPctBonuses).toEqual([{ spellId: 'solemn-vigil', pctPer10PctMissing: 5 }]);
  });

  it('resolveCombatMods emits fullHealthBonus for a purchased Steady Hands', () => {
    const state = treeStateFromLegacy(
      { 'deep-reserves': 1, 'zealot-oath': 1, 'zealot-steady-hands': 1 },
      { gold: 0, ruby: 0 },
    );
    const mods = combatModsFromTree(state, ['zealous-mending']);
    expect(mods.fullHealthBonuses).toEqual([
      { spellId: 'zealous-mending', hpPctAtLeast: 80, bonusHeal: 1 },
    ]);
  });

  it('refunds gold for legacy saves that still own the retired desperate-zeal node', () => {
    const state = treeStateFromLegacy(
      { 'zealot-oath': 1, 'zealot-desperate-zeal': 1 },
      { gold: 2, ruby: 0 },
    );
    expect(ownedOf(state)).not.toContain('zealot-desperate-zeal');
    expect(walletOf(state)['gold']).toBe(6); // 2 on hand + 4 refunded (the retired node's old cost)
  });

  it('does not refund when the retired node was never owned', () => {
    const state = treeStateFromLegacy({ 'zealot-oath': 1 }, { gold: 2, ruby: 0 });
    expect(walletOf(state)['gold']).toBe(2);
  });

  it('loadoutFromSave matches combatModsFromTree for a maxed Vigil save', () => {
    const ranks = {
      'deep-reserves': 5,
      'vigil-oath': 1,
      'vigil-patient-vow': 3,
      'vigil-measured-devotion': 1,
    };
    const unlocked = ['solemn-mend', 'zealous-mending'];
    const viaSave = loadoutFromSave({ treeRanks: ranks, unlockedSpells: unlocked });
    const viaState = combatModsFromTree(treeStateFromLegacy(ranks, { gold: 0, ruby: 0 }), unlocked);
    expect(viaSave).toEqual(viaState);
  });
});
