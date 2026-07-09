import { describe, expect, it } from 'vitest';
import {
  applyCombatResult,
  buildLoadout,
  isDungeon2Unlocked,
  nodeStatus,
  purchaseNode,
} from './progression';
import { newSaveData, type SaveData } from '../save/save';
import { SPELLS, XP_LEVEL_2_THRESHOLD } from '../data/constants';
import { THE_MAW } from '../data/encounters';
import type { CombatResult } from '../scenes/CombatScene';

function save(overrides: Partial<SaveData> = {}): SaveData {
  return { ...newSaveData(), ...overrides };
}

function result(overrides: Partial<CombatResult> = {}): CombatResult {
  return { encounterId: 'ash-gate', status: 'wipe', gold: 0, xp: 0, ...overrides };
}

describe('applyCombatResult', () => {
  it('accrues gold and xp on a wipe', () => {
    const s = save();
    const notices = applyCombatResult(s, result({ status: 'wipe', gold: 3, xp: 2 }));
    expect(s.gold).toBe(3);
    expect(s.xp).toBe(2);
    expect(notices).toEqual([]);
  });

  it('accrues gold and xp on a victory', () => {
    const s = save();
    applyCombatResult(s, result({ status: 'victory', gold: 4, xp: 3 }));
    expect(s.gold).toBe(4);
    expect(s.xp).toBe(3);
  });

  it('auto-grants zealous-mending exactly once when xp crosses the level-2 threshold', () => {
    const s = save({ xp: XP_LEVEL_2_THRESHOLD - 1, unlockedSpells: ['solemn-mend'] });
    const notices = applyCombatResult(s, result({ xp: 1 }));
    expect(s.unlockedSpells).toContain(SPELLS.zealousMending.id);
    expect(s.unlockedSpells.filter((id) => id === SPELLS.zealousMending.id)).toHaveLength(1);
    expect(notices).toEqual([{ kind: 'levelUp', text: `LEVEL 2 — ${SPELLS.zealousMending.name} learned!` }]);
  });

  it('does not grant the spell when xp does not cross the threshold', () => {
    const s = save({ xp: 0, unlockedSpells: ['solemn-mend'] });
    const notices = applyCombatResult(s, result({ xp: 1 }));
    expect(s.unlockedSpells).not.toContain(SPELLS.zealousMending.id);
    expect(notices).toEqual([]);
  });

  it('grants a ruby and records the clear on the first victory in a dungeon', () => {
    const s = save();
    const notices = applyCombatResult(s, result({ status: 'victory', encounterId: 'ash-gate' }));
    expect(s.rubies).toBe(1);
    expect(s.clearedDungeons).toEqual(['ash-gate']);
    expect(notices).toEqual([{ kind: 'firstClear', text: 'FIRST CLEAR — +1 Ruby' }]);
  });

  it('does not grant a second ruby on a replay victory', () => {
    const s = save({ rubies: 1, clearedDungeons: ['ash-gate'] });
    const notices = applyCombatResult(s, result({ status: 'victory', encounterId: 'ash-gate' }));
    expect(s.rubies).toBe(1);
    expect(notices).toEqual([]);
  });

  it('does not grant a ruby on a wipe', () => {
    const s = save();
    applyCombatResult(s, result({ status: 'wipe', encounterId: 'ash-gate' }));
    expect(s.rubies).toBe(0);
    expect(s.clearedDungeons).toEqual([]);
  });
});

describe('buildLoadout', () => {
  it('resolves unlocked spell ids to full defs on a fresh-ish save', () => {
    const s = save({ unlockedSpells: ['solemn-mend'] });
    const loadout = buildLoadout(s);
    expect(loadout.spells.map((sp) => sp.id)).toEqual(['solemn-mend']);
    expect(loadout.spells[0]).toEqual({ ...SPELLS.solemnMend });
    expect(loadout.bonusMaxMana).toBe(0);
    expect(loadout.synergies).toEqual([]);
    expect(loadout.missingHealthBonuses).toEqual([]);
  });

  it('adds tree-granted spells after unlocked ones', () => {
    const s = save({
      unlockedSpells: ['solemn-mend', 'zealous-mending'],
      treeRanks: { 'vigil-oath': 1 },
      subclass: 'vigil',
    });
    expect(buildLoadout(s).spells.map((sp) => sp.id)).toEqual([
      'solemn-mend',
      'zealous-mending',
      'solemn-vigil',
    ]);
  });

  it('scales bonusMaxMana with deep-reserves ranks', () => {
    expect(buildLoadout(save({ treeRanks: { 'deep-reserves': 1 } })).bonusMaxMana).toBe(2);
    expect(buildLoadout(save({ treeRanks: { 'deep-reserves': 5 } })).bonusMaxMana).toBe(10);
  });

  it('emits synergies scaled by ranks', () => {
    const s = save({ treeRanks: { 'zealot-oath': 1, 'zealot-fervent-chain': 2 }, subclass: 'zealot' });
    expect(buildLoadout(s).synergies).toEqual([
      { triggerSpellId: 'zealous-mending', buffedSpellId: 'zealous-flare', bonusHeal: 2 },
    ]);
  });

  it('emits missing-health bonuses', () => {
    const s = save({ treeRanks: { 'zealot-oath': 1, 'zealot-desperate-zeal': 1 }, subclass: 'zealot' });
    expect(buildLoadout(s).missingHealthBonuses).toEqual([
      { spellId: 'zealous-flare', healPer10PctMissing: 1 },
    ]);
  });

  it('resolves castMod into the granted spell def (never leaks to the engine)', () => {
    const s = save({
      treeRanks: { 'vigil-oath': 1, 'vigil-measured-devotion': 1 },
      subclass: 'vigil',
    });
    const vigil = buildLoadout(s).spells.find((sp) => sp.id === 'solemn-vigil');
    expect(vigil?.castMs).toBe(SPELLS.solemnVigil.castMs + 1000);
    expect(vigil?.mana).toBe(SPELLS.solemnVigil.mana - 3);
  });

  it('castMod never mutates the shared spell catalog', () => {
    const s = save({
      treeRanks: { 'vigil-oath': 1, 'vigil-measured-devotion': 1 },
      subclass: 'vigil',
    });
    buildLoadout(s);
    expect(SPELLS.solemnVigil.castMs).toBe(3000);
    expect(SPELLS.solemnVigil.mana).toBe(7);
  });

  it('ignores unknown tree node ids and unknown spell ids', () => {
    const s = save({ unlockedSpells: ['not-a-spell'], treeRanks: { 'not-a-node': 3 } });
    const loadout = buildLoadout(s);
    expect(loadout.spells).toEqual([]);
    expect(loadout.bonusMaxMana).toBe(0);
  });
});

describe('purchaseNode', () => {
  it('buys the root node with gold and records rank 1', () => {
    const s = save({ gold: 5 });
    expect(purchaseNode(s, 'deep-reserves')).toBe(true);
    expect(s.gold).toBe(0);
    expect(s.treeRanks).toEqual({ 'deep-reserves': 1 });
  });

  it('buys additional ranks up to maxRanks, then refuses', () => {
    const s = save({ gold: 100, treeRanks: { 'deep-reserves': 4 } });
    expect(purchaseNode(s, 'deep-reserves')).toBe(true);
    expect(s.treeRanks['deep-reserves']).toBe(5);
    expect(purchaseNode(s, 'deep-reserves')).toBe(false);
    expect(s.gold).toBe(95);
  });

  it('fails on insufficient gold, without mutating the save', () => {
    const s = save({ gold: 4 });
    expect(purchaseNode(s, 'deep-reserves')).toBe(false);
    expect(s.gold).toBe(4);
    expect(s.treeRanks).toEqual({});
  });

  it('fails on an unknown node id', () => {
    const s = save({ gold: 100 });
    expect(purchaseNode(s, 'not-a-real-node')).toBe(false);
    expect(s.gold).toBe(100);
  });

  it('gates on prerequisites: no oath without deep-reserves', () => {
    const s = save({ rubies: 1 });
    expect(purchaseNode(s, 'vigil-oath')).toBe(false);
    expect(s.rubies).toBe(1);
    expect(s.subclass).toBeNull();
  });

  it('buys a subclass oath with a ruby and sets save.subclass', () => {
    const s = save({ rubies: 1, treeRanks: { 'deep-reserves': 1 } });
    expect(purchaseNode(s, 'vigil-oath')).toBe(true);
    expect(s.rubies).toBe(0);
    expect(s.subclass).toBe('vigil');
    expect(s.treeRanks['vigil-oath']).toBe(1);
  });

  it('buying one oath permanently locks the other (exclusiveGroup)', () => {
    const s = save({ rubies: 2, treeRanks: { 'deep-reserves': 1 } });
    expect(purchaseNode(s, 'zealot-oath')).toBe(true);
    expect(purchaseNode(s, 'vigil-oath')).toBe(false);
    expect(s.rubies).toBe(1);
    expect(s.subclass).toBe('zealot');
  });

  it('follow-up nodes require their oath', () => {
    const s = save({ gold: 10, treeRanks: { 'deep-reserves': 1 } });
    expect(purchaseNode(s, 'vigil-patient-vow')).toBe(false);
    s.treeRanks['vigil-oath'] = 1;
    expect(purchaseNode(s, 'vigil-patient-vow')).toBe(true);
    expect(s.gold).toBe(7);
  });

  it('buying a follow-up node never touches save.subclass', () => {
    const s = save({ gold: 10, subclass: 'vigil', treeRanks: { 'deep-reserves': 1, 'vigil-oath': 1 } });
    expect(purchaseNode(s, 'vigil-measured-devotion')).toBe(true);
    expect(s.subclass).toBe('vigil');
  });
});

describe('nodeStatus', () => {
  it('is undefined for unknown nodes', () => {
    expect(nodeStatus(save(), 'nope')).toBeUndefined();
  });

  it('reports a fresh root node as purchasable when affordable', () => {
    expect(nodeStatus(save({ gold: 5 }), 'deep-reserves')).toEqual({
      ranks: 0,
      maxed: false,
      requirementsMet: true,
      lockedByExclusive: false,
      affordable: true,
      purchasable: true,
    });
  });

  it('reports prereq-gated nodes as not purchasable', () => {
    const status = nodeStatus(save({ rubies: 1 }), 'vigil-oath');
    expect(status?.requirementsMet).toBe(false);
    expect(status?.purchasable).toBe(false);
  });

  it('reports the rival oath as lockedByExclusive after a subclass purchase', () => {
    const s = save({ rubies: 5, treeRanks: { 'deep-reserves': 1, 'vigil-oath': 1 }, subclass: 'vigil' });
    const rival = nodeStatus(s, 'zealot-oath');
    expect(rival?.lockedByExclusive).toBe(true);
    expect(rival?.purchasable).toBe(false);
    const owned = nodeStatus(s, 'vigil-oath');
    expect(owned?.lockedByExclusive).toBe(false);
    expect(owned?.maxed).toBe(true);
  });

  it('reports maxed multi-rank nodes', () => {
    const s = save({ gold: 100, treeRanks: { 'deep-reserves': 5 } });
    const status = nodeStatus(s, 'deep-reserves');
    expect(status?.maxed).toBe(true);
    expect(status?.purchasable).toBe(false);
  });
});

describe('isDungeon2Unlocked', () => {
  it('is false on a fresh save', () => {
    expect(isDungeon2Unlocked(save())).toBe(false);
  });

  it('is true once ash-gate has been cleared', () => {
    expect(isDungeon2Unlocked(save({ clearedDungeons: ['ash-gate'] }))).toBe(true);
  });
});

describe('THE_MAW data sanity', () => {
  it('has a boss with overwhelming hp', () => {
    expect(THE_MAW.boss.hp).toBe(999);
  });

  it('has a named party-wide cast (Extinction) defined', () => {
    expect(THE_MAW.boss.cast?.name).toBe('Extinction');
    expect(THE_MAW.boss.cast?.partyDamage).toBeGreaterThan(0);
    expect(THE_MAW.boss.cast?.castMs).toBe(10_000);
  });

  it('includes a light trash wave so grinding still pays gold/xp', () => {
    expect(THE_MAW.waves).toHaveLength(1);
    expect(THE_MAW.waves[0]?.enemies[0]?.count).toBe(2);
  });
});
