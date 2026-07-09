import { describe, expect, it } from 'vitest';
import { applyCombatResult, buildLoadout, purchaseNode } from './progression';
import { newSaveData, type SaveData } from '../save/save';
import { SPELLS, XP_LEVEL_2_THRESHOLD } from '../data/constants';
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

  it('auto-grants zealous-mending when xp jumps past the threshold in one combat', () => {
    const s = save({ xp: 0, unlockedSpells: ['solemn-mend'] });
    const notices = applyCombatResult(s, result({ xp: XP_LEVEL_2_THRESHOLD + 5 }));
    expect(s.unlockedSpells).toContain(SPELLS.zealousMending.id);
    expect(notices.some((n) => n.kind === 'levelUp')).toBe(true);
  });

  it('does not re-grant or re-notify when the spell is somehow already unlocked', () => {
    const s = save({
      xp: XP_LEVEL_2_THRESHOLD - 1,
      unlockedSpells: ['solemn-mend', SPELLS.zealousMending.id],
    });
    const notices = applyCombatResult(s, result({ xp: 1 }));
    expect(s.unlockedSpells.filter((id) => id === SPELLS.zealousMending.id)).toHaveLength(1);
    expect(notices.some((n) => n.kind === 'levelUp')).toBe(false);
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

  it('does not grant a second ruby on a replay victory of an already-cleared dungeon', () => {
    const s = save({ rubies: 1, clearedDungeons: ['ash-gate'] });
    const notices = applyCombatResult(s, result({ status: 'victory', encounterId: 'ash-gate' }));
    expect(s.rubies).toBe(1);
    expect(s.clearedDungeons).toEqual(['ash-gate']);
    expect(notices).toEqual([]);
  });

  it('does not grant a ruby on a wipe', () => {
    const s = save();
    const notices = applyCombatResult(s, result({ status: 'wipe', encounterId: 'ash-gate' }));
    expect(s.rubies).toBe(0);
    expect(s.clearedDungeons).toEqual([]);
    expect(notices).toEqual([]);
  });

  it('can emit both a level-up and a first-clear notice from the same combat', () => {
    const s = save({ xp: XP_LEVEL_2_THRESHOLD - 1, unlockedSpells: ['solemn-mend'] });
    const notices = applyCombatResult(s, result({ status: 'victory', xp: 1, encounterId: 'ash-gate' }));
    expect(notices).toHaveLength(2);
    expect(notices.map((n) => n.kind)).toEqual(['levelUp', 'firstClear']);
  });
});

describe('buildLoadout', () => {
  it('reflects the tutorial spell only on a fresh save', () => {
    const s = save({ unlockedSpells: ['solemn-mend'] });
    expect(buildLoadout(s)).toEqual({ spellIds: ['solemn-mend'], bonusMaxMana: 0 });
  });

  it('includes the xp-unlocked spell once granted', () => {
    const s = save({ unlockedSpells: ['solemn-mend', 'zealous-mending'] });
    expect(buildLoadout(s).spellIds).toEqual(['solemn-mend', 'zealous-mending']);
  });

  it('sums bonusMaxMana from purchased tree nodes', () => {
    const s = save({ unlockedSpells: ['solemn-mend'], treeNodes: ['max-mana-1'] });
    expect(buildLoadout(s).bonusMaxMana).toBe(5);
  });

  it('ignores unknown tree node ids', () => {
    const s = save({ treeNodes: ['not-a-real-node'] });
    expect(buildLoadout(s).bonusMaxMana).toBe(0);
  });
});

describe('purchaseNode', () => {
  it('succeeds and deducts gold when affordable and not owned', () => {
    const s = save({ gold: 5 });
    expect(purchaseNode(s, 'max-mana-1')).toBe(true);
    expect(s.gold).toBe(0);
    expect(s.treeNodes).toEqual(['max-mana-1']);
  });

  it('fails on insufficient gold, without mutating the save', () => {
    const s = save({ gold: 4 });
    expect(purchaseNode(s, 'max-mana-1')).toBe(false);
    expect(s.gold).toBe(4);
    expect(s.treeNodes).toEqual([]);
  });

  it('fails on double-buy, without deducting gold twice', () => {
    const s = save({ gold: 10, treeNodes: ['max-mana-1'] });
    expect(purchaseNode(s, 'max-mana-1')).toBe(false);
    expect(s.gold).toBe(10);
    expect(s.treeNodes).toEqual(['max-mana-1']);
  });

  it('fails on an unknown node id', () => {
    const s = save({ gold: 100 });
    expect(purchaseNode(s, 'not-a-real-node')).toBe(false);
    expect(s.gold).toBe(100);
  });
});
