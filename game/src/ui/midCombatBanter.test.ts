import { describe, expect, it } from 'vitest';
import { freshMidCombatBanterLatches, pickMidCombatBanter } from './midCombatBanter';
import { IDLE_COACH_MS } from '../data/banter';

function party(opts: {
  tankHp?: number;
  tankMaxHp?: number;
  tankAlive?: boolean;
  healerMana?: number;
  healerMaxMana?: number;
  allyHp?: number;
}): Parameters<typeof pickMidCombatBanter>[0]['party'] {
  const tankMax = opts.tankMaxHp ?? 100;
  const tankHp = opts.tankHp ?? tankMax;
  const allyMax = 100;
  const allyHp = opts.allyHp ?? allyMax;
  const maxMana = opts.healerMaxMana ?? 100;
  const mana = opts.healerMana ?? maxMana;
  return [
    {
      id: 'tank',
      role: 'tank',
      alive: opts.tankAlive ?? true,
      hp: tankHp,
      maxHp: tankMax,
      mana: 0,
      maxMana: 0,
    },
    {
      id: 'dps1',
      role: 'dps',
      alive: true,
      hp: allyHp,
      maxHp: allyMax,
      mana: 0,
      maxMana: 0,
    },
    {
      id: 'healer',
      role: 'healer',
      alive: true,
      hp: 100,
      maxHp: 100,
      mana,
      maxMana,
    },
  ];
}

describe('pickMidCombatBanter', () => {
  it('prefers tank-coach over close-call when healer has never healed', () => {
    const pick = pickMidCombatBanter({
      party: party({ tankHp: 35, allyHp: 20 }),
      latches: freshMidCombatBanterLatches(),
      elapsedCombatMs: 0,
      healerHasActed: true,
      healerHasHealed: false,
    });
    expect(pick?.trigger).toBe('tank-coach');
    expect(pick?.speaker).toBe('tank');
    expect(pick?.latches.tankCoachFired).toBe(true);
    expect(pick?.latches.closeCallFired).toBe(false);
  });

  it('fires close-call when tank-coach is not eligible', () => {
    const pick = pickMidCombatBanter({
      party: party({ tankHp: 100, allyHp: 20 }),
      latches: freshMidCombatBanterLatches(),
      elapsedCombatMs: 0,
      healerHasActed: true,
      healerHasHealed: true,
    });
    expect(pick?.trigger).toBe('close-call');
    expect(pick?.latches.closeCallFired).toBe(true);
  });

  it('fires idle-coach after IDLE_COACH_MS with no healer action', () => {
    const pick = pickMidCombatBanter({
      party: party({}),
      latches: freshMidCombatBanterLatches(),
      elapsedCombatMs: IDLE_COACH_MS,
      healerHasActed: false,
      healerHasHealed: false,
    });
    expect(pick?.trigger).toBe('idle-coach');
    expect(pick?.speaker).toBe('healer');
  });

  it('prefers oom over low-mana and close-call', () => {
    const pick = pickMidCombatBanter({
      party: party({ healerMana: 0, allyHp: 20 }),
      latches: freshMidCombatBanterLatches(),
      elapsedCombatMs: 0,
      healerHasActed: true,
      healerHasHealed: true,
    });
    expect(pick?.trigger).toBe('oom');
  });

  it('fires low-mana when mana is low but not empty', () => {
    const pick = pickMidCombatBanter({
      party: party({ healerMana: 25 }),
      latches: freshMidCombatBanterLatches(),
      elapsedCombatMs: 0,
      healerHasActed: true,
      healerHasHealed: true,
    });
    expect(pick?.trigger).toBe('low-mana');
  });

  it('returns null when nothing triggers', () => {
    const pick = pickMidCombatBanter({
      party: party({}),
      latches: freshMidCombatBanterLatches(),
      elapsedCombatMs: 0,
      healerHasActed: true,
      healerHasHealed: true,
    });
    expect(pick).toBeNull();
  });
});
