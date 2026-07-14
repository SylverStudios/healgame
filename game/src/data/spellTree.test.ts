/**
 * SPELL_TREE config integrity + combat resolve parity with buildLoadout.
 */

import { describe, expect, it } from 'vitest';
import { buildLoadout } from '../meta/progression';
import { newSaveData, type SaveData } from '../save/save';
import { SPELLS } from './constants';
import { STILL_WATERS, FRENZIED_LITURGY } from './cooldowns';
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
      'vigil-deep-well',
      'vigil-thrift',
      'vigil-still-waters',
      'zealot-quick-breath',
      'zealot-spendthrift-grace',
      'zealot-frenzied-liturgy',
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

  it('costs one talent point for every live node', () => {
    for (const node of SPELL_TREE.nodes) {
      expect(node.cost).toEqual({ currency: 'talent', amount: 1 });
    }
  });

  it('locks the rival oath via exclusiveGroup', () => {
    let state = create(SPELL_TREE, { talent: 3 });
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
    let state = create(SPELL_TREE, { talent: 3 });
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

  it('makes Patient Vow and Measured Devotion mutually exclusive', () => {
    let state = treeStateFromLegacy({ 'deep-reserves': 1, 'vigil-oath': 1 }, 2);
    const power = update(SPELL_TREE, state, { type: 'purchase', spotId: 'vigil-patient-vow' });
    expect(power.ok).toBe(true);
    if (!power.ok) return;
    state = power.state;

    const efficiency = update(SPELL_TREE, state, {
      type: 'purchase',
      spotId: 'vigil-measured-devotion',
    });
    expect(efficiency.ok).toBe(false);
    if (efficiency.ok) return;
    expect(efficiency.reason).toBe('exclusive-locked');
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

describe('tree layer 2 (Alpha 0.1 §D5)', () => {
  const VIGIL_LAYER2_SPOTS = ['vigil-deep-well', 'vigil-thrift', 'vigil-still-waters'];
  const ZEALOT_LAYER2_SPOTS = ['zealot-quick-breath', 'zealot-spendthrift-grace', 'zealot-frenzied-liturgy'];

  it('locks Vigil layer 2 without any owned branch node', () => {
    const state = treeStateFromLegacy({ 'deep-reserves': 1, 'vigil-oath': 1 }, 3);
    const spots = view(SPELL_TREE, state).spots;
    for (const id of VIGIL_LAYER2_SPOTS) {
      expect(spots.find((s) => s.id === id)?.status).toBe('locked');
    }
  });

  it('unlocks Vigil layer 2 via patient-vow rank 1 alone', () => {
    const state = treeStateFromLegacy(
      { 'deep-reserves': 1, 'vigil-oath': 1, 'vigil-patient-vow': 1 },
      3,
    );
    const spots = view(SPELL_TREE, state).spots;
    for (const id of VIGIL_LAYER2_SPOTS) {
      expect(spots.find((s) => s.id === id)?.status).toBe('affordable');
    }
  });

  it('unlocks Vigil layer 2 via measured-devotion alone (any-of prereq)', () => {
    const state = treeStateFromLegacy(
      { 'deep-reserves': 1, 'vigil-oath': 1, 'vigil-measured-devotion': 1 },
      3,
    );
    const spots = view(SPELL_TREE, state).spots;
    for (const id of VIGIL_LAYER2_SPOTS) {
      expect(spots.find((s) => s.id === id)?.status).toBe('affordable');
    }
  });

  it('locks Zealot layer 2 without any owned branch node', () => {
    const state = treeStateFromLegacy({ 'deep-reserves': 1, 'zealot-oath': 1 }, 3);
    const spots = view(SPELL_TREE, state).spots;
    for (const id of ZEALOT_LAYER2_SPOTS) {
      expect(spots.find((s) => s.id === id)?.status).toBe('locked');
    }
  });

  it('unlocks Zealot layer 2 via fervent-chain rank 1 alone', () => {
    const state = treeStateFromLegacy(
      { 'deep-reserves': 1, 'zealot-oath': 1, 'zealot-fervent-chain': 1 },
      3,
    );
    const spots = view(SPELL_TREE, state).spots;
    for (const id of ZEALOT_LAYER2_SPOTS) {
      expect(spots.find((s) => s.id === id)?.status).toBe('affordable');
    }
  });

  it('unlocks Zealot layer 2 via steady-hands alone (any-of prereq)', () => {
    const state = treeStateFromLegacy(
      { 'deep-reserves': 1, 'zealot-oath': 1, 'zealot-steady-hands': 1 },
      3,
    );
    const spots = view(SPELL_TREE, state).spots;
    for (const id of ZEALOT_LAYER2_SPOTS) {
      expect(spots.find((s) => s.id === id)?.status).toBe('affordable');
    }
  });

  it('vigil-deep-well and zealot-spendthrift-grace bonusMaxMana sum with Deep Reserves', () => {
    const mods = resolveCombatMods(
      [
        { name: 'Deep Reserves', description: '', effect: { kind: 'bonusMaxMana', amount: 5 } },
        { name: 'Deep Well', description: '', effect: { kind: 'bonusMaxMana', amount: 4 } },
        { name: 'Spendthrift Grace', description: '', effect: { kind: 'bonusMaxMana', amount: 3 } },
      ],
      ['solemn-mend'],
    );
    expect(mods.bonusMaxMana).toBe(12);
  });

  it('vigil-thrift castMod reduces Solemn Mend mana by 1', () => {
    const mods = resolveCombatMods(
      [
        {
          name: 'Thrift',
          description: '',
          effect: {
            kind: 'castMod',
            spellId: SPELLS.solemnMend.id,
            castMsDelta: 0,
            manaDelta: -1,
          },
        },
      ],
      [SPELLS.solemnMend.id],
    );
    const mend = mods.spells.find((sp) => sp.id === SPELLS.solemnMend.id);
    expect(mend?.mana).toBe(SPELLS.solemnMend.mana - 1);
    expect(mend?.castMs).toBe(SPELLS.solemnMend.castMs);
  });

  it('zealot-quick-breath castMod reduces Zealous Flare castMs by 200', () => {
    const mods = resolveCombatMods(
      [
        {
          name: 'Quick Breath',
          description: '',
          effect: {
            kind: 'castMod',
            spellId: SPELLS.zealousFlare.id,
            castMsDelta: -200,
            manaDelta: 0,
          },
        },
      ],
      [SPELLS.zealousFlare.id],
    );
    const flare = mods.spells.find((sp) => sp.id === SPELLS.zealousFlare.id);
    expect(flare?.castMs).toBe(SPELLS.zealousFlare.castMs - 200);
    expect(flare?.mana).toBe(SPELLS.zealousFlare.mana);
  });

  it('grantCooldown resolves the full CooldownDef into CombatMods.cooldowns', () => {
    const mods = resolveCombatMods(
      [
        {
          name: 'Still Waters',
          description: '',
          effect: { kind: 'grantCooldown', cooldownId: STILL_WATERS.id },
        },
        {
          name: 'Frenzied Liturgy',
          description: '',
          effect: { kind: 'grantCooldown', cooldownId: FRENZIED_LITURGY.id },
        },
      ],
      ['solemn-mend'],
    );
    expect(mods.cooldowns).toEqual([STILL_WATERS, FRENZIED_LITURGY]);
  });

  it('dedupes grantCooldown by id', () => {
    const mods = resolveCombatMods(
      [
        {
          name: 'Still Waters',
          description: '',
          effect: { kind: 'grantCooldown', cooldownId: STILL_WATERS.id },
        },
        {
          name: 'Still Waters (dup)',
          description: '',
          effect: { kind: 'grantCooldown', cooldownId: STILL_WATERS.id },
        },
      ],
      ['solemn-mend'],
    );
    expect(mods.cooldowns).toEqual([STILL_WATERS]);
  });

  it('ignores an unknown grantCooldown id, like unknown spell ids', () => {
    const mods = resolveCombatMods(
      [
        {
          name: 'Bogus',
          description: '',
          effect: { kind: 'grantCooldown', cooldownId: 'not-a-real-cooldown' },
        },
      ],
      ['solemn-mend'],
    );
    expect(mods.cooldowns).toEqual([]);
  });

  it('combatModsFromTree yields Still Waters cooldown for a purchased vigil-still-waters', () => {
    const state = treeStateFromLegacy(
      {
        'deep-reserves': 1,
        'vigil-oath': 1,
        'vigil-patient-vow': 1,
        'vigil-still-waters': 1,
      },
      0,
    );
    const mods = combatModsFromTree(state, ['solemn-mend']);
    expect(mods.cooldowns).toEqual([STILL_WATERS]);
  });

  it('combatModsFromTree yields Frenzied Liturgy cooldown for a purchased zealot-frenzied-liturgy', () => {
    const state = treeStateFromLegacy(
      {
        'deep-reserves': 1,
        'zealot-oath': 1,
        'zealot-steady-hands': 1,
        'zealot-frenzied-liturgy': 1,
      },
      0,
    );
    const mods = combatModsFromTree(state, ['zealous-mending']);
    expect(mods.cooldowns).toEqual([FRENZIED_LITURGY]);
  });

  it('round-trips all six layer-2 node ids through the legacy bridge', () => {
    const ranks = {
      'deep-reserves': 1,
      'vigil-oath': 1,
      'vigil-patient-vow': 1,
      'vigil-deep-well': 1,
      'vigil-thrift': 1,
      'vigil-still-waters': 1,
    };
    expect(legacyRanksFromOwned(ownedIdsFromLegacyRanks(ranks))).toEqual(ranks);

    const zealotRanks = {
      'deep-reserves': 1,
      'zealot-oath': 1,
      'zealot-fervent-chain': 1,
      'zealot-quick-breath': 1,
      'zealot-spendthrift-grace': 1,
      'zealot-frenzied-liturgy': 1,
    };
    expect(legacyRanksFromOwned(ownedIdsFromLegacyRanks(zealotRanks))).toEqual(zealotRanks);
  });
});

describe('parity with buildLoadout', () => {
  function expectParity(treeRanks: Record<string, number>, unlockedSpells: string[]): void {
    const legacy = buildLoadout(save({ treeRanks, unlockedSpells }));
    const state = treeStateFromLegacy(treeRanks, 0);
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

  it('round-trips an efficiency-specialized Vigil build', () => {
    const ranks = {
      'deep-reserves': 5,
      'vigil-oath': 1,
      'vigil-measured-devotion': 1,
    };
    expect(legacyRanksFromOwned(ownedIdsFromLegacyRanks(ranks))).toEqual(ranks);
  });

  it('ownedContents is a flat bag combat can reduce (no layout)', () => {
    const state = treeStateFromLegacy(
      { 'deep-reserves': 2, 'zealot-oath': 1, 'zealot-steady-hands': 1 },
      0,
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
      0,
    );
    const mods = combatModsFromTree(state, ['solemn-mend']);
    expect(mods.missingHealthPctBonuses).toEqual([{ spellId: 'solemn-vigil', pctPer10PctMissing: 5 }]);
  });

  it('resolveCombatMods emits fullHealthBonus for a purchased Steady Hands', () => {
    const state = treeStateFromLegacy(
      { 'deep-reserves': 1, 'zealot-oath': 1, 'zealot-steady-hands': 1 },
      0,
    );
    const mods = combatModsFromTree(state, ['zealous-mending']);
    expect(mods.fullHealthBonuses).toEqual([
      { spellId: 'zealous-mending', hpPctAtLeast: 80, bonusHeal: 2 },
    ]);
  });

  it('preserves available talent points while omitting retired legacy nodes', () => {
    const state = treeStateFromLegacy({ 'zealot-oath': 1, 'zealot-desperate-zeal': 1 }, 2);
    expect(ownedOf(state)).not.toContain('zealot-desperate-zeal');
    expect(walletOf(state)['talent']).toBe(2);
  });

  it('loadoutFromSave matches combatModsFromTree for a maxed Vigil save', () => {
    const ranks = {
      'deep-reserves': 5,
      'vigil-oath': 1,
      'vigil-patient-vow': 3,
    };
    const unlocked = ['solemn-mend', 'zealous-mending'];
    const viaSave = loadoutFromSave({ treeRanks: ranks, unlockedSpells: unlocked });
    const viaState = combatModsFromTree(treeStateFromLegacy(ranks, 0), unlocked);
    expect(viaSave).toEqual(viaState);
  });
});
