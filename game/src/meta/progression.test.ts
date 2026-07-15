import { describe, expect, it } from 'vitest';
import {
  allocatedTalentPoints,
  applyCombatResult,
  availableTalentPoints,
  buildLoadout,
  isDungeonUnlocked,
  isIronPassUnlocked,
  isMawUnlocked,
  manaBonusesForLevel,
} from './progression';
import { newSaveData, type SaveData } from '../save/save';
import { LEVEL_MANA, levelForXp, SPELLS, XP_LEVEL_2_THRESHOLD, xpForLevel } from '../data/constants';
import { IRON_PASS, THE_MAW } from '../data/encounters';
import type { CombatResult } from '../scenes/CombatScene';

function save(overrides: Partial<SaveData> = {}): SaveData {
  return { ...newSaveData(), ...overrides };
}

function result(overrides: Partial<CombatResult> = {}): CombatResult {
  return { encounterId: 'ash-gate', status: 'wipe', xp: 0, ...overrides };
}

describe('applyCombatResult', () => {
  it('accrues xp on a wipe', () => {
    const s = save();
    const notices = applyCombatResult(s, result({ status: 'wipe', xp: 2 }));
    expect(s.xp).toBe(2);
    expect(notices).toEqual([]);
  });

  it('accrues xp on a victory', () => {
    const s = save();
    applyCombatResult(s, result({ status: 'victory', xp: 3 }), () => 0);
    expect(s.xp).toBe(3);
  });

  it('grants one talent point and Zealous Mending when reaching level 2', () => {
    const s = save({ xp: XP_LEVEL_2_THRESHOLD - 1, unlockedSpells: ['solemn-mend'] });
    const notices = applyCombatResult(s, result({ xp: 1 }));
    expect(availableTalentPoints(s)).toBe(2);
    expect(s.unlockedSpells).toContain(SPELLS.zealousMending.id);
    expect(s.unlockedSpells.filter((id) => id === SPELLS.zealousMending.id)).toHaveLength(1);
    expect(notices).toEqual([
      { kind: 'levelUp', text: 'LEVEL 2 — +1 Talent Point' },
      { kind: 'spellLearned', text: `${SPELLS.zealousMending.name} learned!` },
    ]);
  });

  it('does not grant the spell or another talent point below the threshold', () => {
    const s = save({ xp: 0, unlockedSpells: ['solemn-mend'] });
    const notices = applyCombatResult(s, result({ xp: 1 }));
    expect(availableTalentPoints(s)).toBe(1);
    expect(s.unlockedSpells).not.toContain(SPELLS.zealousMending.id);
    expect(notices).toEqual([]);
  });

  it.each(['ash-gate', 'iron-pass', 'cinder-vault', 'verdant-rift', 'black-choir', 'the-maw'])(
    'queues three deterministic relic offers on the first %s clear',
    (encounterId) => {
      const priorById: Record<string, string[]> = {
        'ash-gate': [],
        'iron-pass': ['ash-gate'],
        'cinder-vault': ['ash-gate', 'iron-pass'],
        'verdant-rift': ['ash-gate', 'iron-pass', 'cinder-vault'],
        'black-choir': ['ash-gate', 'iron-pass', 'cinder-vault', 'verdant-rift'],
        'the-maw': ['ash-gate', 'iron-pass', 'cinder-vault', 'verdant-rift', 'black-choir'],
      };
      const priorClears = priorById[encounterId] ?? [];
      const expectedClears = [...priorClears, encounterId];
      const s = save({ clearedDungeons: priorClears });
      const notices = applyCombatResult(
        s,
        result({ status: 'victory', encounterId }),
        () => 0,
      );
      expect(s.clearedDungeons).toEqual(expectedClears);
      expect(s.pendingRelicOffers).toEqual([
        'ember-ledger',
        'triage-bell',
        'still-reservoir',
      ]);
      expect(notices).toEqual([{ kind: 'firstClear', text: 'FIRST CLEAR — CHOOSE A RELIC' }]);
    },
  );

  it('excludes owned relics from first-clear offers', () => {
    const s = save({ relicIds: ['ember-ledger'] });
    applyCombatResult(s, result({ status: 'victory' }), () => 0);
    expect(s.pendingRelicOffers).toEqual([
      'triage-bell',
      'still-reservoir',
      'vital-ember',
    ]);
  });

  it('does not replace pending offers on a replay victory', () => {
    const pendingRelicOffers = ['vital-ember', 'bastion-plate', 'iron-ward'];
    const s = save({ clearedDungeons: ['ash-gate'], pendingRelicOffers });
    const notices = applyCombatResult(s, result({ status: 'victory' }), () => 0);
    expect(s.pendingRelicOffers).toEqual(pendingRelicOffers);
    expect(notices).toEqual([]);
  });

  it('does not queue relic offers on a wipe', () => {
    const s = save();
    applyCombatResult(s, result({ status: 'wipe' }), () => 0);
    expect(s.pendingRelicOffers).toEqual([]);
    expect(s.clearedDungeons).toEqual([]);
  });

  it('does not reward or record an unknown dungeon id', () => {
    const s = save();
    const notices = applyCombatResult(
      s,
      result({ status: 'victory', encounterId: 'unknown-dungeon' }),
      () => 0,
    );
    expect(s.clearedDungeons).toEqual([]);
    expect(s.pendingRelicOffers).toEqual([]);
    expect(notices).toEqual([]);
  });
});

describe('XP levels and talent capacity', () => {
  it('uses an increasing 10/20/30 XP curve and gives level 6 six total points', () => {
    expect([2, 3, 4, 5, 6].map(xpForLevel)).toEqual([10, 30, 60, 100, 150]);
    expect(levelForXp(149)).toBe(5);
    const s = save({ xp: 150, treeRanks: { 'deep-reserves': 4 } });
    expect(allocatedTalentPoints(s)).toBe(4);
    expect(availableTalentPoints(s)).toBe(2);
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

  it('scales bonusMaxMana with deep-reserves ranks (max 3 in Alpha 0.2)', () => {
    expect(buildLoadout(save({ treeRanks: { 'deep-reserves': 1 } })).bonusMaxMana).toBe(6);
    expect(buildLoadout(save({ treeRanks: { 'deep-reserves': 3 } })).bonusMaxMana).toBe(18);
  });

  it('emits synergies scaled by ranks', () => {
    const s = save({ treeRanks: { 'zealot-oath': 1, 'zealot-fervent-chain': 2 }, subclass: 'zealot' });
    expect(buildLoadout(s).synergies).toEqual([
      { triggerSpellId: 'zealous-mending', buffedSpellId: 'zealous-flare', bonusHeal: 4 },
    ]);
  });

  it('emits full-health bonuses from Steady Hands (Alpha 0.1 §D4, replaces retired Desperate Zeal)', () => {
    const s = save({ treeRanks: { 'zealot-oath': 1, 'zealot-steady-hands': 1 }, subclass: 'zealot' });
    expect(buildLoadout(s).fullHealthBonuses).toEqual([
      { spellId: 'zealous-mending', hpPctAtLeast: 80, bonusHeal: 2 },
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
    expect(SPELLS.solemnVigil.mana).toBe(5);
  });

  it('ignores unknown tree node ids and unknown spell ids', () => {
    const s = save({ unlockedSpells: ['not-a-spell'], treeRanks: { 'not-a-node': 3 } });
    const loadout = buildLoadout(s);
    expect(loadout.spells).toEqual([]);
    expect(loadout.bonusMaxMana).toBe(0);
  });
});

describe('talent points', () => {
  it('counts allocated ranks across all tree nodes', () => {
    expect(
      allocatedTalentPoints(
        save({ treeRanks: { 'deep-reserves': 3, 'vigil-oath': 1, 'vigil-patient-vow': 2 } }),
      ),
    ).toBe(6);
  });

  it('ignores negative ranks and floors fractional ranks defensively', () => {
    expect(allocatedTalentPoints(save({ treeRanks: { negative: -2, fractional: 2.9 } }))).toBe(2);
  });

  it('grants one available point per level', () => {
    expect(availableTalentPoints(save({ xp: 0 }))).toBe(1);
    expect(availableTalentPoints(save({ xp: XP_LEVEL_2_THRESHOLD }))).toBe(2);
    expect(availableTalentPoints(save({ xp: 30 }))).toBe(3);
  });

  it('subtracts allocated ranks and never returns a negative balance', () => {
    expect(
      availableTalentPoints(
        save({ xp: 30, treeRanks: { 'deep-reserves': 2, 'vigil-oath': 1 } }),
      ),
    ).toBe(0);
    expect(availableTalentPoints(save({ xp: 0, treeRanks: { 'deep-reserves': 3 } }))).toBe(0);
  });
});

describe('isIronPassUnlocked', () => {
  it('is false on a fresh save', () => {
    expect(isIronPassUnlocked(save())).toBe(false);
  });

  it('is true once ash-gate has been cleared', () => {
    expect(isIronPassUnlocked(save({ clearedDungeons: ['ash-gate'] }))).toBe(true);
  });
});

describe('isMawUnlocked', () => {
  it('is false on a fresh save', () => {
    expect(isMawUnlocked(save())).toBe(false);
  });

  it('is still false after only ash-gate has been cleared', () => {
    expect(isMawUnlocked(save({ clearedDungeons: ['ash-gate'] }))).toBe(false);
  });

  it('is still false after Iron Pass alone — mid-tier dungeons gate The Maw', () => {
    expect(isMawUnlocked(save({ clearedDungeons: ['ash-gate', 'iron-pass'] }))).toBe(false);
  });

  it('is true once black-choir has been cleared', () => {
    expect(
      isMawUnlocked(
        save({
          clearedDungeons: ['ash-gate', 'iron-pass', 'cinder-vault', 'verdant-rift', 'black-choir'],
        }),
      ),
    ).toBe(true);
  });
});

describe('IRON_PASS data sanity', () => {
  it('has four trash waves with the bot-tuned counts/hp (chunk 9a — see combat/balance.test.ts)', () => {
    expect(IRON_PASS.waves).toHaveLength(4);
    const shapes = IRON_PASS.waves.map((w) => ({
      count: w.enemies[0]?.count,
      hp: w.enemies[0]?.hp,
    }));
    expect(shapes).toEqual([
      { count: 2, hp: 9 },
      { count: 3, hp: 9 },
      { count: 3, hp: 10 },
      { count: 4, hp: 10 },
    ]);
  });

  it('has a boss cast of kind tunnelVision with the drafted cadence', () => {
    const cast = IRON_PASS.boss.cast;
    expect(cast?.name).toBe('Tunnel Vision');
    if (!cast || cast.kind !== 'tunnelVision') throw new Error('Tunnel Vision must be a tunnelVision cast');
    expect(cast.telegraphMs).toBe(3000);
    expect(cast.firstCastAtMs).toBe(8000);
    expect(cast.intervalMs).toBe(30_000);
    expect(cast.channelMs).toBe(10_000);
    expect(cast.tickMs).toBe(1000);
    expect(cast.damagePerTick).toBe(2);
  });
});

describe('isDungeonUnlocked', () => {
  it('uses each dungeon unlock config', () => {
    const fresh = save();
    expect(isDungeonUnlocked(fresh, 'ash-gate')).toBe(true);
    expect(isDungeonUnlocked(fresh, 'iron-pass')).toBe(false);
    expect(isDungeonUnlocked(fresh, 'cinder-vault')).toBe(false);
    expect(isDungeonUnlocked(fresh, 'verdant-rift')).toBe(false);
    expect(isDungeonUnlocked(fresh, 'black-choir')).toBe(false);
    expect(isDungeonUnlocked(fresh, 'the-maw')).toBe(false);
    expect(isDungeonUnlocked(save({ clearedDungeons: ['ash-gate'] }), 'iron-pass')).toBe(true);
    expect(isDungeonUnlocked(save({ clearedDungeons: ['ash-gate'] }), 'the-maw')).toBe(false);
    expect(
      isDungeonUnlocked(save({ clearedDungeons: ['ash-gate', 'iron-pass'] }), 'cinder-vault'),
    ).toBe(true);
    expect(
      isDungeonUnlocked(save({ clearedDungeons: ['ash-gate', 'iron-pass', 'cinder-vault'] }), 'verdant-rift'),
    ).toBe(true);
    expect(
      isDungeonUnlocked(save({ clearedDungeons: ['ash-gate', 'iron-pass'] }), 'the-maw'),
    ).toBe(false);
    expect(
      isDungeonUnlocked(
        save({ clearedDungeons: ['ash-gate', 'iron-pass', 'cinder-vault', 'verdant-rift', 'black-choir'] }),
        'the-maw',
      ),
    ).toBe(true);
  });

  it('is false for an unknown dungeon id even if that id appears cleared', () => {
    expect(isDungeonUnlocked(save({ clearedDungeons: ['unknown-dungeon'] }), 'unknown-dungeon')).toBe(false);
    expect(isDungeonUnlocked(save({ clearedDungeons: ['toString'] }), 'toString')).toBe(false);
  });
});

describe('manaBonusesForLevel (Alpha 0.2 §D2)', () => {
  it.each([
    [1, 0, null],
    [2, 3, 1],
    [3, 6, 1],
    [4, 9, 1],
    [5, 12, 2],
    [8, 21, 3],
    [11, 30, 4],
  ] as const)('level %i → bonusMaxMana %i, regen amount %s', (level, bonusMaxMana, regenAmount) => {
    const bonuses = manaBonusesForLevel(level);
    expect(bonuses.bonusMaxMana).toBe(bonusMaxMana);
    if (regenAmount === null) {
      expect(bonuses.manaRegen).toBeNull();
    } else {
      expect(bonuses.manaRegen).toEqual({
        amount: regenAmount,
        intervalMs: LEVEL_MANA.regenIntervalMs,
      });
    }
  });

  it('floors non-integer levels and clamps below 1', () => {
    expect(manaBonusesForLevel(2.9)).toEqual(manaBonusesForLevel(2));
    expect(manaBonusesForLevel(0)).toEqual(manaBonusesForLevel(1));
    expect(manaBonusesForLevel(-5)).toEqual(manaBonusesForLevel(1));
  });
});

describe('THE_MAW data sanity', () => {
  it('has a boss with overwhelming hp', () => {
    expect(THE_MAW.boss.hp).toBe(9999);
  });

  it('has a named party-wide cast (Extinction) defined', () => {
    const cast = THE_MAW.boss.cast;
    expect(cast?.name).toBe('Extinction');
    if (!cast || cast.kind === 'tunnelVision' || cast.kind === 'partyDoT' || cast.kind === 'manaSiphon') {
      throw new Error('Extinction must be a party-AoE cast');
    }
    expect(cast.partyDamage).toBeGreaterThan(0);
    expect(cast.castMs).toBe(10_000);
  });

  it('includes a light trash wave so grinding still pays xp', () => {
    expect(THE_MAW.waves).toHaveLength(1);
    expect(THE_MAW.waves[0]?.enemies[0]?.count).toBe(2);
  });
});
