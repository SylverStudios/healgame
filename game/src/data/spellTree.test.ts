/**
 * SPELL_TREE config integrity + combat resolve parity with buildLoadout.
 */

import { describe, expect, it } from 'vitest';
import { buildLoadout } from '../meta/progression';
import { newSaveData, type SaveData } from '../save/save';
import { SPELLS, LEVEL_MANA } from './constants';
import { STILL_WATERS, FRENZIED_LITURGY, WRATH_ASCENDANT } from './cooldowns';
import {
  SPELL_TREE,
  combatModsFromTree,
  legacyRanksFromOwned,
  loadoutFromSave,
  ownedIdsFromLegacyRanks,
  resolveCombatMods,
  treeStateFromLegacy,
  type CombatMods,
  type SpellTreeContent,
} from './spellTree';
import { create, ownedContents, ownedOf, update, validateConfig, view, walletOf } from '../tree';

function save(overrides: Partial<SaveData> = {}): SaveData {
  // Empty actionBar → loadoutFromSave keeps all owned spells (bar not under test).
  return { ...newSaveData(), actionBar: ['', '', '', ''], ...overrides };
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
      'vigil-thrift',
      'vigil-still-waters',
      'zealot-quick-breath',
      'zealot-frenzied-liturgy',
      'shared-mend-potency',
      'shared-zealous-potency',
      'vowstrike-virtue',
      'vowstrike-vengeance',
      'wrath-ascendant',
      'vowbound-crown',
    ]);
  });

  it('retires zealot-desperate-zeal — absent from the live tree (Alpha 0.1 §D4)', () => {
    expect(SPELL_TREE.spots.map((s) => s.id)).not.toContain('zealot-desperate-zeal');
    expect(SPELL_TREE.nodes.map((n) => n.id)).not.toContain('zealot-desperate-zeal');
  });

  it('retires vigil-deep-well and zealot-spendthrift-grace (Alpha 0.2)', () => {
    expect(SPELL_TREE.spots.map((s) => s.id)).not.toContain('vigil-deep-well');
    expect(SPELL_TREE.spots.map((s) => s.id)).not.toContain('zealot-spendthrift-grace');
    expect(SPELL_TREE.nodes.map((n) => n.id)).not.toContain('vigil-deep-well');
    expect(SPELL_TREE.nodes.map((n) => n.id)).not.toContain('zealot-spendthrift-grace');
  });

  it('models multi-rank nodes as chains', () => {
    expect(SPELL_TREE.spots.find((s) => s.id === 'deep-reserves')?.chain).toHaveLength(3);
    expect(SPELL_TREE.spots.find((s) => s.id === 'vigil-patient-vow')?.chain).toHaveLength(3);
    expect(SPELL_TREE.spots.find((s) => s.id === 'zealot-fervent-chain')?.chain).toHaveLength(3);
  });

  it('deep-reserves max ranks is 3 (Alpha 0.2 — was 5)', () => {
    const chain = SPELL_TREE.spots.find((s) => s.id === 'deep-reserves')?.chain ?? [];
    expect(chain).toEqual(['deep-reserves-1', 'deep-reserves-2', 'deep-reserves-3']);
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

  it('castMod bakes optional healDelta into the spell def', () => {
    const mods = resolveCombatMods(
      [
        {
          name: 'Mend Potency',
          description: '',
          effect: {
            kind: 'castMod',
            spellId: SPELLS.solemnMend.id,
            castMsDelta: 0,
            manaDelta: 0,
            healDelta: 1,
          },
        },
      ],
      [SPELLS.solemnMend.id],
    );
    const mend = mods.spells.find((sp) => sp.id === SPELLS.solemnMend.id);
    expect(mend?.heal).toBe(SPELLS.solemnMend.heal + 1);
    expect(mend?.castMs).toBe(SPELLS.solemnMend.castMs);
    expect(mend?.mana).toBe(SPELLS.solemnMend.mana);
    expect(SPELLS.solemnMend.heal).toBe(4); // catalog untouched
  });

  it('castMod healDelta defaults to 0 when omitted', () => {
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
    expect(mend?.heal).toBe(SPELLS.solemnMend.heal); // unchanged
  });

  it('ampOwnedSpells adds damageDelta to owned vowstrike spells', () => {
    const mods = resolveCombatMods(
      [
        {
          name: 'Path of the Vigil',
          description: '',
          effect: { kind: 'grantSpell', spellId: SPELLS.vowstrikeVirtue.id },
        },
        {
          name: 'Vowbound Crown',
          description: '',
          effect: {
            kind: 'ampOwnedSpells',
            spellIds: [SPELLS.vowstrikeVirtue.id, SPELLS.vowstrikeVengeance.id],
            damageDelta: 1,
          },
        },
      ],
      [],
    );
    const virtue = mods.spells.find((sp) => sp.id === SPELLS.vowstrikeVirtue.id);
    expect(virtue?.damage).toBe((SPELLS.vowstrikeVirtue.damage ?? 0) + 1);
    expect(SPELLS.vowstrikeVirtue.damage).toBe(5); // catalog untouched
  });

  it('ampOwnedSpells skips spells not in the loadout', () => {
    const mods = resolveCombatMods(
      [
        {
          name: 'Vowbound Crown',
          description: '',
          effect: {
            kind: 'ampOwnedSpells',
            spellIds: [SPELLS.vowstrikeVirtue.id, SPELLS.vowstrikeVengeance.id],
            damageDelta: 1,
          },
        },
      ],
      [],
    );
    expect(mods.spells).toEqual([]);
  });
});

describe('tree layer 2 (Alpha 0.1 §D5 — output nodes only after Alpha 0.2 trim)', () => {
  const VIGIL_OUTPUT_SPOTS = ['vigil-thrift', 'vigil-still-waters'];
  const ZEALOT_OUTPUT_SPOTS = ['zealot-quick-breath', 'zealot-frenzied-liturgy'];

  it('locks Vigil output layer without any owned branch node', () => {
    const state = treeStateFromLegacy({ 'deep-reserves': 1, 'vigil-oath': 1 }, 3);
    const spots = view(SPELL_TREE, state).spots;
    for (const id of VIGIL_OUTPUT_SPOTS) {
      expect(spots.find((s) => s.id === id)?.status).toBe('locked');
    }
  });

  it('unlocks Vigil output layer via patient-vow rank 1 alone', () => {
    const state = treeStateFromLegacy(
      { 'deep-reserves': 1, 'vigil-oath': 1, 'vigil-patient-vow': 1 },
      3,
    );
    const spots = view(SPELL_TREE, state).spots;
    for (const id of VIGIL_OUTPUT_SPOTS) {
      expect(spots.find((s) => s.id === id)?.status).toBe('affordable');
    }
  });

  it('unlocks Vigil output layer via measured-devotion alone (any-of prereq)', () => {
    const state = treeStateFromLegacy(
      { 'deep-reserves': 1, 'vigil-oath': 1, 'vigil-measured-devotion': 1 },
      3,
    );
    const spots = view(SPELL_TREE, state).spots;
    for (const id of VIGIL_OUTPUT_SPOTS) {
      expect(spots.find((s) => s.id === id)?.status).toBe('affordable');
    }
  });

  it('locks Zealot output layer without any owned branch node', () => {
    const state = treeStateFromLegacy({ 'deep-reserves': 1, 'zealot-oath': 1 }, 3);
    const spots = view(SPELL_TREE, state).spots;
    for (const id of ZEALOT_OUTPUT_SPOTS) {
      expect(spots.find((s) => s.id === id)?.status).toBe('locked');
    }
  });

  it('unlocks Zealot output layer via fervent-chain rank 1 alone', () => {
    const state = treeStateFromLegacy(
      { 'deep-reserves': 1, 'zealot-oath': 1, 'zealot-fervent-chain': 1 },
      3,
    );
    const spots = view(SPELL_TREE, state).spots;
    for (const id of ZEALOT_OUTPUT_SPOTS) {
      expect(spots.find((s) => s.id === id)?.status).toBe('affordable');
    }
  });

  it('unlocks Zealot output layer via steady-hands alone (any-of prereq)', () => {
    const state = treeStateFromLegacy(
      { 'deep-reserves': 1, 'zealot-oath': 1, 'zealot-steady-hands': 1 },
      3,
    );
    const spots = view(SPELL_TREE, state).spots;
    for (const id of ZEALOT_OUTPUT_SPOTS) {
      expect(spots.find((s) => s.id === id)?.status).toBe('affordable');
    }
  });

  it('bonusMaxMana from deep-reserves ranks sum correctly (3 ranks max)', () => {
    const mods = resolveCombatMods(
      [
        { name: 'Deep Reserves', description: '', effect: { kind: 'bonusMaxMana', amount: 6 } },
        { name: 'Deep Reserves', description: '', effect: { kind: 'bonusMaxMana', amount: 6 } },
        { name: 'Deep Reserves', description: '', effect: { kind: 'bonusMaxMana', amount: 6 } },
      ],
      ['solemn-mend'],
    );
    expect(mods.bonusMaxMana).toBe(18);
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

  it('round-trips output layer-2 node ids through the legacy bridge', () => {
    const vigilRanks = {
      'deep-reserves': 1,
      'vigil-oath': 1,
      'vigil-patient-vow': 1,
      'vigil-thrift': 1,
      'vigil-still-waters': 1,
    };
    expect(legacyRanksFromOwned(ownedIdsFromLegacyRanks(vigilRanks))).toEqual(vigilRanks);

    const zealotRanks = {
      'deep-reserves': 1,
      'zealot-oath': 1,
      'zealot-fervent-chain': 1,
      'zealot-quick-breath': 1,
      'zealot-frenzied-liturgy': 1,
    };
    expect(legacyRanksFromOwned(ownedIdsFromLegacyRanks(zealotRanks))).toEqual(zealotRanks);
  });
});

describe('shared mid (Alpha 0.2)', () => {
  const SHARED_MID_SPOTS = ['shared-mend-potency', 'shared-zealous-potency'];

  it('locks shared mid nodes without any oath follow-up', () => {
    const state = treeStateFromLegacy({ 'deep-reserves': 1, 'vigil-oath': 1 }, 5);
    const spots = view(SPELL_TREE, state).spots;
    for (const id of SHARED_MID_SPOTS) {
      expect(spots.find((s) => s.id === id)?.status).toBe('locked');
    }
  });

  it('unlocks shared mid via vigil-patient-vow rank 1', () => {
    const state = treeStateFromLegacy(
      { 'deep-reserves': 1, 'vigil-oath': 1, 'vigil-patient-vow': 1 },
      5,
    );
    const spots = view(SPELL_TREE, state).spots;
    for (const id of SHARED_MID_SPOTS) {
      expect(spots.find((s) => s.id === id)?.status).toBe('affordable');
    }
  });

  it('unlocks shared mid via vigil-measured-devotion', () => {
    const state = treeStateFromLegacy(
      { 'deep-reserves': 1, 'vigil-oath': 1, 'vigil-measured-devotion': 1 },
      5,
    );
    const spots = view(SPELL_TREE, state).spots;
    for (const id of SHARED_MID_SPOTS) {
      expect(spots.find((s) => s.id === id)?.status).toBe('affordable');
    }
  });

  it('unlocks shared mid via zealot-fervent-chain rank 1', () => {
    const state = treeStateFromLegacy(
      { 'deep-reserves': 1, 'zealot-oath': 1, 'zealot-fervent-chain': 1 },
      5,
    );
    const spots = view(SPELL_TREE, state).spots;
    for (const id of SHARED_MID_SPOTS) {
      expect(spots.find((s) => s.id === id)?.status).toBe('affordable');
    }
  });

  it('unlocks shared mid via zealot-steady-hands', () => {
    const state = treeStateFromLegacy(
      { 'deep-reserves': 1, 'zealot-oath': 1, 'zealot-steady-hands': 1 },
      5,
    );
    const spots = view(SPELL_TREE, state).spots;
    for (const id of SHARED_MID_SPOTS) {
      expect(spots.find((s) => s.id === id)?.status).toBe('affordable');
    }
  });

  it('shared-mend-potency adds +1 heal to Solemn Mend', () => {
    const state = treeStateFromLegacy(
      { 'deep-reserves': 1, 'vigil-oath': 1, 'vigil-patient-vow': 1, 'shared-mend-potency': 1 },
      0,
    );
    const mods = combatModsFromTree(state, [SPELLS.solemnMend.id]);
    const mend = mods.spells.find((sp) => sp.id === SPELLS.solemnMend.id);
    expect(mend?.heal).toBe(SPELLS.solemnMend.heal + 1);
  });

  it('shared-zealous-potency adds +1 heal to Zealous Mending', () => {
    const state = treeStateFromLegacy(
      { 'deep-reserves': 1, 'zealot-oath': 1, 'zealot-steady-hands': 1, 'shared-zealous-potency': 1 },
      0,
    );
    const mods = combatModsFromTree(state, [SPELLS.zealousMending.id]);
    const mending = mods.spells.find((sp) => sp.id === SPELLS.zealousMending.id);
    expect(mending?.heal).toBe(SPELLS.zealousMending.heal + 1);
  });
});

describe('vowstrike fork (Alpha 0.2)', () => {
  it('locks vowstrike nodes without shared mid', () => {
    const state = treeStateFromLegacy(
      { 'deep-reserves': 1, 'vigil-oath': 1, 'vigil-patient-vow': 1 },
      5,
    );
    const spots = view(SPELL_TREE, state).spots;
    expect(spots.find((s) => s.id === 'vowstrike-virtue')?.status).toBe('locked');
    expect(spots.find((s) => s.id === 'vowstrike-vengeance')?.status).toBe('locked');
  });

  it('unlocks vowstrike nodes via shared-mend-potency', () => {
    const state = treeStateFromLegacy(
      { 'deep-reserves': 1, 'vigil-oath': 1, 'vigil-patient-vow': 1, 'shared-mend-potency': 1 },
      5,
    );
    const spots = view(SPELL_TREE, state).spots;
    expect(spots.find((s) => s.id === 'vowstrike-virtue')?.status).toBe('affordable');
    expect(spots.find((s) => s.id === 'vowstrike-vengeance')?.status).toBe('affordable');
  });

  it('unlocks vowstrike nodes via shared-zealous-potency', () => {
    const state = treeStateFromLegacy(
      { 'deep-reserves': 1, 'zealot-oath': 1, 'zealot-steady-hands': 1, 'shared-zealous-potency': 1 },
      5,
    );
    const spots = view(SPELL_TREE, state).spots;
    expect(spots.find((s) => s.id === 'vowstrike-virtue')?.status).toBe('affordable');
    expect(spots.find((s) => s.id === 'vowstrike-vengeance')?.status).toBe('affordable');
  });

  it('makes vowstrike-virtue and vowstrike-vengeance mutually exclusive', () => {
    let state = treeStateFromLegacy(
      {
        'deep-reserves': 1,
        'vigil-oath': 1,
        'vigil-patient-vow': 1,
        'shared-mend-potency': 1,
      },
      2,
    );
    const virtue = update(SPELL_TREE, state, { type: 'purchase', spotId: 'vowstrike-virtue' });
    expect(virtue.ok).toBe(true);
    if (!virtue.ok) return;
    state = virtue.state;

    const vengeance = update(SPELL_TREE, state, {
      type: 'purchase',
      spotId: 'vowstrike-vengeance',
    });
    expect(vengeance.ok).toBe(false);
    if (vengeance.ok) return;
    expect(vengeance.reason).toBe('exclusive-locked');
  });

  it('vowstrike-virtue grantSpell adds the virtue spell to CombatMods', () => {
    const state = treeStateFromLegacy(
      {
        'deep-reserves': 1,
        'vigil-oath': 1,
        'vigil-patient-vow': 1,
        'shared-mend-potency': 1,
        'vowstrike-virtue': 1,
      },
      0,
    );
    const mods = combatModsFromTree(state, ['solemn-mend']);
    expect(mods.spells.map((sp) => sp.id)).toContain(SPELLS.vowstrikeVirtue.id);
  });

  it('vowstrike-vengeance grantSpell adds the vengeance spell to CombatMods', () => {
    const state = treeStateFromLegacy(
      {
        'deep-reserves': 1,
        'zealot-oath': 1,
        'zealot-fervent-chain': 1,
        'shared-zealous-potency': 1,
        'vowstrike-vengeance': 1,
      },
      0,
    );
    const mods = combatModsFromTree(state, ['solemn-mend']);
    expect(mods.spells.map((sp) => sp.id)).toContain(SPELLS.vowstrikeVengeance.id);
  });
});

describe('shared crown (Alpha 0.2)', () => {
  it('locks crown nodes without any vowstrike aspect', () => {
    const state = treeStateFromLegacy(
      {
        'deep-reserves': 1,
        'vigil-oath': 1,
        'vigil-patient-vow': 1,
        'shared-mend-potency': 1,
      },
      5,
    );
    const spots = view(SPELL_TREE, state).spots;
    expect(spots.find((s) => s.id === 'wrath-ascendant')?.status).toBe('locked');
    expect(spots.find((s) => s.id === 'vowbound-crown')?.status).toBe('locked');
  });

  it('unlocks crown nodes after purchasing vowstrike-virtue', () => {
    const state = treeStateFromLegacy(
      {
        'deep-reserves': 1,
        'vigil-oath': 1,
        'vigil-patient-vow': 1,
        'shared-mend-potency': 1,
        'vowstrike-virtue': 1,
      },
      5,
    );
    const spots = view(SPELL_TREE, state).spots;
    expect(spots.find((s) => s.id === 'wrath-ascendant')?.status).toBe('affordable');
    expect(spots.find((s) => s.id === 'vowbound-crown')?.status).toBe('affordable');
  });

  it('unlocks crown nodes after purchasing vowstrike-vengeance', () => {
    const state = treeStateFromLegacy(
      {
        'deep-reserves': 1,
        'zealot-oath': 1,
        'zealot-fervent-chain': 1,
        'shared-zealous-potency': 1,
        'vowstrike-vengeance': 1,
      },
      5,
    );
    const spots = view(SPELL_TREE, state).spots;
    expect(spots.find((s) => s.id === 'wrath-ascendant')?.status).toBe('affordable');
    expect(spots.find((s) => s.id === 'vowbound-crown')?.status).toBe('affordable');
  });

  it('wrath-ascendant grants Wrath Ascendant CD', () => {
    const state = treeStateFromLegacy(
      {
        'deep-reserves': 1,
        'vigil-oath': 1,
        'vigil-patient-vow': 1,
        'shared-mend-potency': 1,
        'vowstrike-virtue': 1,
        'wrath-ascendant': 1,
      },
      0,
    );
    const mods = combatModsFromTree(state, ['solemn-mend']);
    expect(mods.cooldowns).toContainEqual(WRATH_ASCENDANT);
  });

  it('vowbound-crown adds +1 damage to owned Vowstrike via ampOwnedSpells', () => {
    const state = treeStateFromLegacy(
      {
        'deep-reserves': 1,
        'vigil-oath': 1,
        'vigil-patient-vow': 1,
        'shared-mend-potency': 1,
        'vowstrike-virtue': 1,
        'vowbound-crown': 1,
      },
      0,
    );
    const mods = combatModsFromTree(state, ['solemn-mend']);
    const virtue = mods.spells.find((sp) => sp.id === SPELLS.vowstrikeVirtue.id);
    expect(virtue?.damage).toBe((SPELLS.vowstrikeVirtue.damage ?? 0) + 1);
    // Vengeance not owned — not affected
    expect(mods.spells.find((sp) => sp.id === SPELLS.vowstrikeVengeance.id)).toBeUndefined();
  });

  it('vowbound-crown does not amp an unowned vengeance vowstrike', () => {
    const mods = resolveCombatMods(
      [
        {
          name: 'Vowbound Crown',
          description: '',
          effect: {
            kind: 'ampOwnedSpells',
            spellIds: [SPELLS.vowstrikeVirtue.id, SPELLS.vowstrikeVengeance.id],
            damageDelta: 1,
          },
        },
      ],
      [],
    );
    expect(mods.spells).toEqual([]);
  });
});

describe('oath × vowstrike twists (Alpha 0.2 §D5)', () => {
  function makeBaseMods(oath: 'vigil' | 'zealot', aspect: 'virtue' | 'vengeance'): CombatMods {
    const oathSpellId = oath === 'vigil' ? SPELLS.solemnVigil.id : SPELLS.zealousFlare.id;
    const aspectSpellId =
      aspect === 'virtue' ? SPELLS.vowstrikeVirtue.id : SPELLS.vowstrikeVengeance.id;
    const contents: SpellTreeContent[] = [
      {
        name: oath === 'vigil' ? 'Path of the Vigil' : 'Path of the Zealot',
        description: '',
        subclass: oath,
        effect: { kind: 'grantSpell', spellId: oathSpellId },
      },
      {
        name: aspect === 'virtue' ? 'Vowstrike: Absolution' : 'Vowstrike: Reckoning',
        description: '',
        effect: { kind: 'grantSpell', spellId: aspectSpellId },
      },
    ];
    return resolveCombatMods(contents, ['solemn-mend']);
  }

  it('Vigil × Virtue: vowstrike-virtue mana reduced by 1', () => {
    const mods = makeBaseMods('vigil', 'virtue');
    const virtue = mods.spells.find((sp) => sp.id === SPELLS.vowstrikeVirtue.id);
    expect(virtue?.mana).toBe(SPELLS.vowstrikeVirtue.mana - 1);
    expect(virtue?.damage).toBe(SPELLS.vowstrikeVirtue.damage);
    expect(SPELLS.vowstrikeVirtue.mana).toBe(3); // catalog untouched
  });

  it('Vigil × Vengeance: vowstrike-vengeance damage +1 and potency +15', () => {
    const mods = makeBaseMods('vigil', 'vengeance');
    const vengeance = mods.spells.find((sp) => sp.id === SPELLS.vowstrikeVengeance.id);
    expect(vengeance?.damage).toBe((SPELLS.vowstrikeVengeance.damage ?? 0) + 1);
    expect(vengeance?.mana).toBe(SPELLS.vowstrikeVengeance.mana);
    expect(vengeance?.castBuff).toEqual({ kind: 'nextHealPotencyPct', pct: 40 });
    expect(mods.missingHealthBonuses).toEqual([]);
  });

  it('Zealot × Virtue: synergy trigger vowstrike-virtue → buff zealous-mending added', () => {
    const mods = makeBaseMods('zealot', 'virtue');
    expect(mods.synergies).toContainEqual({
      triggerSpellId: SPELLS.vowstrikeVirtue.id,
      buffedSpellId: SPELLS.zealousMending.id,
      bonusHeal: 1,
    });
    const virtue = mods.spells.find((sp) => sp.id === SPELLS.vowstrikeVirtue.id);
    expect(virtue?.mana).toBe(SPELLS.vowstrikeVirtue.mana);
  });

  it('Zealot × Vengeance: vowstrike-vengeance damage +1', () => {
    const mods = makeBaseMods('zealot', 'vengeance');
    const vengeance = mods.spells.find((sp) => sp.id === SPELLS.vowstrikeVengeance.id);
    expect(vengeance?.damage).toBe((SPELLS.vowstrikeVengeance.damage ?? 0) + 1);
    expect(vengeance?.mana).toBe(SPELLS.vowstrikeVengeance.mana);
    expect(SPELLS.vowstrikeVengeance.damage).toBe(5); // catalog untouched
  });

  it('no twist when aspect is absent', () => {
    const contents: SpellTreeContent[] = [
      {
        name: 'Path of the Vigil',
        description: '',
        subclass: 'vigil',
        effect: { kind: 'grantSpell', spellId: SPELLS.solemnVigil.id },
      },
    ];
    const mods = resolveCombatMods(contents, ['solemn-mend']);
    expect(mods.missingHealthBonuses).toEqual([]);
    expect(mods.synergies).toEqual([]);
  });

  it('no twist when oath is absent', () => {
    const contents: SpellTreeContent[] = [
      {
        name: 'Vowstrike: Absolution',
        description: '',
        effect: { kind: 'grantSpell', spellId: SPELLS.vowstrikeVirtue.id },
      },
    ];
    const mods = resolveCombatMods(contents, []);
    const virtue = mods.spells.find((sp) => sp.id === SPELLS.vowstrikeVirtue.id);
    expect(virtue?.mana).toBe(SPELLS.vowstrikeVirtue.mana); // unchanged
  });

  it('Vigil × Vengeance stacks damageDelta from ampOwnedSpells and the oath twist', () => {
    const contents: SpellTreeContent[] = [
      {
        name: 'Vowbound Crown',
        description: '',
        effect: {
          kind: 'ampOwnedSpells',
          spellIds: [SPELLS.vowstrikeVengeance.id],
          damageDelta: 1,
        },
      },
      {
        name: 'Path of the Vigil',
        description: '',
        subclass: 'vigil',
        effect: { kind: 'grantSpell', spellId: SPELLS.solemnVigil.id },
      },
      {
        name: 'Vowstrike: Reckoning',
        description: '',
        effect: { kind: 'grantSpell', spellId: SPELLS.vowstrikeVengeance.id },
      },
    ];
    const mods = resolveCombatMods(contents, []);
    const vengeance = mods.spells.find((sp) => sp.id === SPELLS.vowstrikeVengeance.id);
    expect(vengeance?.damage).toBe((SPELLS.vowstrikeVengeance.damage ?? 0) + 2);
  });

  it('full Vigil + Virtue round-trip via combatModsFromTree', () => {
    const state = treeStateFromLegacy(
      {
        'deep-reserves': 1,
        'vigil-oath': 1,
        'vigil-patient-vow': 1,
        'shared-mend-potency': 1,
        'vowstrike-virtue': 1,
      },
      0,
    );
    const mods = combatModsFromTree(state, ['solemn-mend']);
    const virtue = mods.spells.find((sp) => sp.id === SPELLS.vowstrikeVirtue.id);
    // Vigil × Virtue: mana -1
    expect(virtue?.mana).toBe(SPELLS.vowstrikeVirtue.mana - 1);
  });
});

describe('level mana in loadoutFromSave (Alpha 0.2 §D2)', () => {
  it('adds no bonus at level 1 (xp=0)', () => {
    const mods = loadoutFromSave({ treeRanks: {}, unlockedSpells: ['solemn-mend'], xp: 0 });
    expect(mods.bonusMaxMana).toBe(0);
    expect(mods.manaRegen).toBeUndefined();
  });

  it('orders fight spells from actionBar (duplicates allowed)', () => {
    const mods = loadoutFromSave({
      treeRanks: {},
      unlockedSpells: ['bonk', 'solemn-mend', 'zealous-mending'],
      actionBar: ['solemn-mend', 'bonk', 'solemn-mend', ''],
      xp: 0,
    });
    expect(mods.spells.map((s) => s.id)).toEqual(['solemn-mend', 'bonk', 'solemn-mend']);
  });

  it('adds bonusMaxMana + manaRegen for level 5 (xp=100)', () => {
    // level 5 → bonusMaxMana = 3*(5-1) = 12, regen = 2/10s (ranks at L2, L5)
    const mods = loadoutFromSave({ treeRanks: {}, unlockedSpells: ['solemn-mend'], xp: 100 });
    expect(mods.bonusMaxMana).toBe(12);
    expect(mods.manaRegen).toEqual({
      amount: 2,
      intervalMs: LEVEL_MANA.regenIntervalMs,
    });
  });

  it('stacks level mana on top of deep-reserves tree bonus', () => {
    // deep-reserves rank 1 = +6 mana; level 5 = +12 mana → total 18
    const mods = loadoutFromSave({
      treeRanks: { 'deep-reserves': 1 },
      unlockedSpells: ['solemn-mend'],
      xp: 100,
    });
    expect(mods.bonusMaxMana).toBe(6 + 12);
  });

  it('xp defaults to 0 when omitted', () => {
    const mods = loadoutFromSave({ treeRanks: {}, unlockedSpells: ['solemn-mend'] });
    expect(mods.bonusMaxMana).toBe(0);
    expect(mods.manaRegen).toBeUndefined();
  });
});

describe('parity with buildLoadout', () => {
  function expectParity(treeRanks: Record<string, number>, unlockedSpells: string[]): void {
    const legacy = buildLoadout(save({ treeRanks, unlockedSpells }));
    const state = treeStateFromLegacy(treeRanks, 0);
    const next = combatModsFromTree(state, unlockedSpells);
    // buildLoadout with xp=0 (level 1) adds no level mana, so both should match.
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

  it('matches maxed Vigil build (deep-reserves capped at 3)', () => {
    expectParity(
      {
        'deep-reserves': 3,
        'vigil-oath': 1,
        'vigil-patient-vow': 3,
      },
      ['solemn-mend', 'zealous-mending'],
    );
  });

  it('matches maxed Zealot build (deep-reserves capped at 3)', () => {
    expectParity(
      {
        'deep-reserves': 3,
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
        'deep-reserves': 3,
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

  it('ownedIdsFromLegacyRanks caps deep-reserves at 3 (Alpha 0.2)', () => {
    expect(ownedIdsFromLegacyRanks({ 'deep-reserves': 5 })).toEqual([
      'deep-reserves-1',
      'deep-reserves-2',
      'deep-reserves-3',
    ]);
  });

  it('round-trips an efficiency-specialized Vigil build', () => {
    const ranks = {
      'deep-reserves': 3,
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

  it('round-trips Alpha 0.1 node ids through the legacy bridge', () => {
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

  it('round-trips new Alpha 0.2 node ids through the legacy bridge', () => {
    const ranks = {
      'deep-reserves': 1,
      'vigil-oath': 1,
      'vigil-patient-vow': 1,
      'shared-mend-potency': 1,
      'vowstrike-virtue': 1,
      'wrath-ascendant': 1,
      'vowbound-crown': 1,
    };
    expect(legacyRanksFromOwned(ownedIdsFromLegacyRanks(ranks))).toEqual(ranks);

    const zealotRanks = {
      'deep-reserves': 1,
      'zealot-oath': 1,
      'zealot-fervent-chain': 1,
      'shared-zealous-potency': 1,
      'vowstrike-vengeance': 1,
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
    const state = treeStateFromLegacy(
      { 'zealot-oath': 1, 'zealot-desperate-zeal': 1, 'vigil-deep-well': 1, 'zealot-spendthrift-grace': 1 },
      2,
    );
    expect(ownedOf(state)).not.toContain('zealot-desperate-zeal');
    expect(ownedOf(state)).not.toContain('vigil-deep-well');
    expect(ownedOf(state)).not.toContain('zealot-spendthrift-grace');
    expect(walletOf(state)['talent']).toBe(2);
  });

  it('loadoutFromSave matches combatModsFromTree at level 1 (no level mana bonus)', () => {
    const ranks = {
      'deep-reserves': 3,
      'vigil-oath': 1,
      'vigil-patient-vow': 3,
    };
    const unlocked = ['solemn-mend', 'zealous-mending'];
    const viaSave = loadoutFromSave({ treeRanks: ranks, unlockedSpells: unlocked, xp: 0 });
    const viaState = combatModsFromTree(treeStateFromLegacy(ranks, 0), unlocked);
    expect(viaSave).toEqual(viaState);
  });
});
