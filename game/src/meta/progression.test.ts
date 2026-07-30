import { describe, expect, it } from 'vitest';
import {
  allocatedTalentPoints,
  applyCombatResult,
  availableTalentPoints,
  buildLoadout,
  currentChallengeDungeon,
  isDungeonUnlocked,
  isIronPassUnlocked,
  isMawUnlocked,
  manaBonusesForLevel,
  takeHubCombatResult,
  unspentTalentPointsForHub,
  type HubCombatSceneData,
} from './progression';
import { newSaveData, type SaveData } from '../save/save';
import {
  LEVEL_MANA,
  levelForXp,
  SPELLS,
  XP_LEVEL_2_THRESHOLD,
  xpForLevel,
} from '../data/constants';
import { IRON_PASS, THE_MAW } from '../data/encounters';
import type { CombatResult } from '../scenes/CombatScene';

function save(overrides: Partial<SaveData> = {}): SaveData {
  // Empty actionBar → loadoutFromSave keeps all owned spells (bar not under test).
  return { ...newSaveData(), actionBar: ['', '', '', ''], ...overrides };
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

  it.each([
    'ash-gate',
    'iron-pass',
    'cinder-vault',
    'verdant-rift',
    'black-choir',
    'gloam-sanctum',
    'the-maw',
  ])('queues three deterministic relic offers on the first %s clear', (encounterId) => {
    const priorById: Record<string, string[]> = {
      'ash-gate': [],
      'iron-pass': ['ash-gate'],
      'cinder-vault': ['ash-gate', 'iron-pass'],
      'verdant-rift': ['ash-gate', 'iron-pass', 'cinder-vault'],
      'black-choir': ['ash-gate', 'iron-pass', 'cinder-vault', 'verdant-rift'],
      'gloam-sanctum': ['ash-gate', 'iron-pass', 'cinder-vault', 'verdant-rift', 'black-choir'],
      'the-maw': [
        'ash-gate',
        'iron-pass',
        'cinder-vault',
        'verdant-rift',
        'black-choir',
        'gloam-sanctum',
      ],
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
  });

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

  it('cards first-clear grants upgrade point and skips relic offers', () => {
    const s = save({ progressionMode: 'cards', upgradePoints: 0 });
    const notices = applyCombatResult(s, result({ status: 'victory' }), () => 0);
    expect(s.clearedDungeons).toEqual(['ash-gate']);
    expect(s.pendingRelicOffers).toEqual([]);
    expect(s.upgradePoints).toBe(1);
    expect(notices).toEqual([
      { kind: 'firstClear', text: 'FIRST CLEAR — +1 Upgrade Point · open Spells' },
    ]);
  });

  it('cards level 2 grants Mend + upgrade point (not lattice Zealous Mending)', () => {
    const s = save({
      progressionMode: 'cards',
      xp: XP_LEVEL_2_THRESHOLD - 1,
      unlockedSpells: ['heal', 'bonk'],
      actionBar: ['heal', 'bonk', '', ''],
      upgradePoints: 0,
    });
    const notices = applyCombatResult(s, result({ xp: 1 }));
    expect(s.upgradePoints).toBe(1);
    expect(s.unlockedSpells).toContain('mend');
    expect(s.actionBar).toContain('mend');
    expect(s.unlockedSpells).not.toContain(SPELLS.zealousMending.id);
    expect(notices).toEqual([
      { kind: 'levelUp', text: 'Welcome to level 2' },
      { kind: 'spellLearned', text: 'Mend learned!' },
    ]);
  });

  it('cards level 5 grants Vowstrike beside Bonk', () => {
    const s = save({
      progressionMode: 'cards',
      xp: xpForLevel(5) - 1,
      unlockedSpells: ['heal', 'bonk', 'mend'],
      actionBar: ['heal', 'bonk', 'mend', ''],
      upgradePoints: 2, // after lv2–3 (+1 each), skipped unlucky 4
    });
    const notices = applyCombatResult(s, result({ xp: 1 }));
    expect(levelForXp(s.xp)).toBe(5);
    expect(s.upgradePoints).toBe(3);
    expect(s.unlockedSpells).toContain('vowstrike');
    expect(s.unlockedSpells).toContain('bonk');
    expect(s.actionBar).toContain('vowstrike');
    expect(notices).toEqual([
      { kind: 'levelUp', text: 'Welcome to level 5' },
      { kind: 'spellLearned', text: 'Vowstrike learned!' },
    ]);
  });

  it('cards level 4 is unlucky — welcome copy, no upgrade point', () => {
    const s = save({
      progressionMode: 'cards',
      xp: xpForLevel(4) - 1,
      unlockedSpells: ['heal', 'bonk', 'mend'],
      actionBar: ['heal', 'bonk', 'mend', ''],
      upgradePoints: 2,
    });
    const notices = applyCombatResult(s, result({ xp: 1 }));
    expect(levelForXp(s.xp)).toBe(4);
    expect(s.upgradePoints).toBe(2);
    expect(notices).toEqual([{ kind: 'levelUp', text: 'Welcome to unlucky level 4' }]);
  });

  it('cards level 8 is lucky — welcome copy, +2 upgrade points + Liturgy', () => {
    const s = save({
      progressionMode: 'cards',
      xp: xpForLevel(8) - 1,
      unlockedSpells: ['heal', 'bonk', 'mend', 'vowstrike'],
      actionBar: ['heal', 'bonk', 'mend', 'vowstrike'],
      upgradePoints: 5,
    });
    const notices = applyCombatResult(s, result({ xp: 1 }));
    expect(levelForXp(s.xp)).toBe(8);
    expect(s.upgradePoints).toBe(7);
    expect(buildLoadout(s).cooldowns.map((c) => c.id)).toContain('frenzied-liturgy');
    expect(notices).toEqual([
      { kind: 'levelUp', text: 'Welcome to lucky level 8' },
      { kind: 'spellLearned', text: 'Frenzied Liturgy learned!' },
    ]);
  });

  it('cards level 6 unlocks Still Waters via loadout (no unlockedSpells entry)', () => {
    const s = save({
      progressionMode: 'cards',
      xp: xpForLevel(6) - 1,
      unlockedSpells: ['heal', 'bonk', 'mend', 'vowstrike'],
      actionBar: ['heal', 'bonk', 'mend', 'vowstrike'],
      upgradePoints: 3,
    });
    const notices = applyCombatResult(s, result({ xp: 1 }));
    expect(levelForXp(s.xp)).toBe(6);
    expect(s.upgradePoints).toBe(4);
    expect(s.unlockedSpells).not.toContain('still-waters');
    expect(buildLoadout(s).cooldowns.map((c) => c.id)).toContain('still-waters');
    expect(notices).toEqual([
      { kind: 'levelUp', text: 'Welcome to level 6' },
      { kind: 'spellLearned', text: 'Still Waters learned!' },
    ]);
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

describe('takeHubCombatResult (Wave 0 — sticky Phaser scene data)', () => {
  /**
   * Phaser Systems.start only replaces settings.data when the next start()
   * passes a truthy data object. Tree→Hub used to call start(Hub) with no
   * data, so Hub re-received the post-combat combatResult and re-banked XP:
   * leave tree → suddenly leveled / another talent point. This helper is the
   * pure settle step Hub must use (and write back) so Tree and Hub agree.
   */
  it('re-applying the same combatResult without consuming disagrees Hub vs Tree points', () => {
    // Fresh save, one wipe worth enough XP to hit level 2 then level 3 on a
    // second bank of the same payload (10 → L2, +10 → still L2, needs the
    // double-apply from L2 threshold to L3: start at 0, grant 30 once → L3;
    // grant 30 again → L4). Use 30 so one sticky re-apply changes points.
    const s = save({ xp: 0, unlockedSpells: ['solemn-mend'] });
    const combatResult = result({ xp: 30 });

    applyCombatResult(s, combatResult);
    const treePointsAfterCombat = availableTalentPoints(s);
    expect(levelForXp(s.xp)).toBe(3);
    expect(treePointsAfterCombat).toBe(3);

    // Sticky Hub re-entry (pre-fix): same combatResult fed again.
    applyCombatResult(s, combatResult);
    const hubPointsAfterTreeReturn = availableTalentPoints(s);
    expect(levelForXp(s.xp)).toBe(4);
    expect(hubPointsAfterTreeReturn).toBe(4);
    // Tree opened on the post-combat save; Hub after leave shows a new point.
    expect(hubPointsAfterTreeReturn).not.toBe(treePointsAfterCombat);
  });

  it('consumes combatResult so a Tree→Hub round-trip keeps Hub/Tree talent points aligned', () => {
    const s = save({ xp: 0, unlockedSpells: ['solemn-mend'] });
    let sceneData: HubCombatSceneData = { combatResult: result({ xp: 30 }) };

    const first = takeHubCombatResult(s, sceneData);
    sceneData = first.sceneData;
    expect(first.notices.some((n) => n.kind === 'levelUp')).toBe(true);
    expect(sceneData.combatResult).toBeUndefined();

    const pointsWhenTreeCanOpen = availableTalentPoints(s);
    expect(levelForXp(s.xp)).toBe(3);
    expect(pointsWhenTreeCanOpen).toBe(3);

    // Tree loads the same save — must match Hub at the moment Tree is openable.
    expect(availableTalentPoints({ xp: s.xp, treeRanks: s.treeRanks })).toBe(pointsWhenTreeCanOpen);

    // Leave Tree → Hub with consumed (empty) scene data, even if Phaser would
    // have sticky-replayed the old payload without this consume write-back.
    const second = takeHubCombatResult(s, sceneData);
    expect(second.notices).toEqual([]);
    expect(s.xp).toBe(30);
    expect(availableTalentPoints(s)).toBe(pointsWhenTreeCanOpen);
    expect(levelForXp(s.xp)).toBe(3);
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

describe('unspentTalentPointsForHub', () => {
  it('lattice matches availableTalentPoints', () => {
    expect(unspentTalentPointsForHub(save({ xp: 0 }))).toBe(1);
    expect(unspentTalentPointsForHub(save({ xp: 0, treeRanks: { 'deep-reserves': 1 } }))).toBe(0);
    expect(
      unspentTalentPointsForHub(
        save({ xp: 30, treeRanks: { 'deep-reserves': 2, 'vigil-oath': 1 } }),
      ),
    ).toBe(0);
  });

  it('radial free starters do not consume CTA points', () => {
    const fresh = newSaveData('radial');
    // Lattice-style sum would treat heal+bonk as spent → 0; Hub must still show 1.
    expect(availableTalentPoints(fresh)).toBe(0);
    expect(unspentTalentPointsForHub(fresh)).toBe(1);
  });

  it('radial after spending Mend shows 0 unspent at level 1', () => {
    const s = newSaveData('radial');
    s.treeRanks = { heal: 1, bonk: 1, mend: 1 };
    expect(unspentTalentPointsForHub(s)).toBe(0);
  });

  it('radial level-up grants another CTA point on top of free starters', () => {
    const s = newSaveData('radial');
    s.xp = XP_LEVEL_2_THRESHOLD;
    expect(unspentTalentPointsForHub(s)).toBe(2);
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

  it('is still false after Black Choir alone — Gloam Sanctum gates The Maw', () => {
    expect(
      isMawUnlocked(
        save({
          clearedDungeons: ['ash-gate', 'iron-pass', 'cinder-vault', 'verdant-rift', 'black-choir'],
        }),
      ),
    ).toBe(false);
  });

  it('is true once gloam-sanctum has been cleared', () => {
    expect(
      isMawUnlocked(
        save({
          clearedDungeons: [
            'ash-gate',
            'iron-pass',
            'cinder-vault',
            'verdant-rift',
            'black-choir',
            'gloam-sanctum',
          ],
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
      { count: 2, hp: 13 },
      { count: 3, hp: 13 },
      { count: 3, hp: 14 },
      { count: 4, hp: 14 },
    ]);
  });

  it('has a boss cast of kind tunnelVision with the PR3 tuned cadence', () => {
    const cast = IRON_PASS.boss.cast;
    expect(cast?.name).toBe('Tunnel Vision');
    if (!cast || cast.kind !== 'tunnelVision') throw new Error('Tunnel Vision must be a tunnelVision cast');
    expect(cast.telegraphMs).toBe(5000);
    expect(cast.firstCastAtMs).toBe(5000);
    expect(cast.intervalMs).toBe(16_000);
    expect(cast.channelMs).toBe(11_000);
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
    expect(isDungeonUnlocked(fresh, 'gloam-sanctum')).toBe(false);
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
        'gloam-sanctum',
      ),
    ).toBe(true);
    expect(
      isDungeonUnlocked(
        save({ clearedDungeons: ['ash-gate', 'iron-pass', 'cinder-vault', 'verdant-rift', 'black-choir'] }),
        'the-maw',
      ),
    ).toBe(false);
    expect(
      isDungeonUnlocked(
        save({
          clearedDungeons: [
            'ash-gate',
            'iron-pass',
            'cinder-vault',
            'verdant-rift',
            'black-choir',
            'gloam-sanctum',
          ],
        }),
        'the-maw',
      ),
    ).toBe(true);
  });

  it('is false for an unknown dungeon id even if that id appears cleared', () => {
    expect(isDungeonUnlocked(save({ clearedDungeons: ['unknown-dungeon'] }), 'unknown-dungeon')).toBe(false);
    expect(isDungeonUnlocked(save({ clearedDungeons: ['toString'] }), 'toString')).toBe(false);
  });
});

describe('currentChallengeDungeon', () => {
  it('is Ash Gate on a fresh save', () => {
    expect(currentChallengeDungeon(save())?.id).toBe('ash-gate');
  });

  it('advances to the next unlocked uncleared dungeon', () => {
    expect(currentChallengeDungeon(save({ clearedDungeons: ['ash-gate'] }))?.id).toBe('iron-pass');
    expect(
      currentChallengeDungeon(save({ clearedDungeons: ['ash-gate', 'iron-pass'] }))?.id,
    ).toBe('cinder-vault');
  });

  it('is null when the full progression is cleared', () => {
    expect(
      currentChallengeDungeon(
        save({
          clearedDungeons: [
            'ash-gate',
            'iron-pass',
            'cinder-vault',
            'verdant-rift',
            'black-choir',
            'gloam-sanctum',
            'the-maw',
          ],
        }),
      ),
    ).toBeNull();
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
