import { describe, expect, it } from 'vitest';
import {
  detectCloseCall,
  detectIdleCoach,
  detectLowMana,
  detectOom,
  detectTankCoach,
  IDLE_COACH_MS,
  pickBanterLine,
} from './banter';

describe('pickBanterLine', () => {
  it('is deterministic without an rng — always the first line', () => {
    const a = pickBanterLine({ trigger: 'victory', speaker: 'healer', subclass: 'vigil' });
    const b = pickBanterLine({ trigger: 'victory', speaker: 'healer', subclass: 'vigil' });
    expect(a).toBe(b);
    expect(a).toBe('The vow holds. Rest now.');
  });

  it('branches healer lines by subclass — vigil and zealot differ at the same index', () => {
    const vigil = pickBanterLine({ trigger: 'close-call', speaker: 'healer', subclass: 'vigil' });
    const zealot = pickBanterLine({ trigger: 'close-call', speaker: 'healer', subclass: 'zealot' });
    const neutral = pickBanterLine({ trigger: 'close-call', speaker: 'healer', subclass: null });
    expect(vigil).not.toBe(zealot);
    expect(vigil).not.toBe(neutral);
    expect(zealot).not.toBe(neutral);
  });

  it('null subclass reads neutral/devout, distinct from both sworn oaths', () => {
    const line = pickBanterLine({ trigger: 'victory', speaker: 'healer', subclass: null });
    expect(line).toBe('It is done. We stand.');
  });

  it('tank lines ignore subclass entirely (tank has none)', () => {
    const withVigil = pickBanterLine({ trigger: 'wipe', speaker: 'tank', subclass: 'vigil' });
    const withNull = pickBanterLine({ trigger: 'wipe', speaker: 'tank', subclass: null });
    expect(withVigil).toBe(withNull);
  });

  it('injected rng picks a different line than the deterministic default', () => {
    const first = pickBanterLine({ trigger: 'wipe', speaker: 'tank', subclass: null });
    const other = pickBanterLine({
      trigger: 'wipe',
      speaker: 'tank',
      subclass: null,
      rng: () => 0.99,
    });
    expect(other).not.toBe(first);
  });

  it('rng draws map to distinct in-range indices, clamped at the r=1 edge', () => {
    const lines = new Set<string>();
    for (const r of [0, 0.2, 0.4, 0.6, 0.8]) {
      lines.add(pickBanterLine({ trigger: 'wipe', speaker: 'tank', subclass: null, rng: () => r }));
    }
    expect(lines.size).toBeGreaterThan(1);
    // r exactly 1 must not index out of bounds.
    expect(() =>
      pickBanterLine({ trigger: 'wipe', speaker: 'tank', subclass: null, rng: () => 1 }),
    ).not.toThrow();
  });

  it('every (trigger, speaker) combo returns a non-empty line (total function, no throws)', () => {
    const triggers = [
      'close-call',
      'wipe',
      'victory',
      'idle-coach',
      'tank-coach',
      'low-mana',
      'oom',
    ] as const;
    const speakers = ['healer', 'tank'] as const;
    for (const trigger of triggers) {
      for (const speaker of speakers) {
        const line = pickBanterLine({ trigger, speaker, subclass: null });
        expect(line.length).toBeGreaterThan(0);
      }
    }
  });

  it('idle-coach healer nudges casting — first line is deterministic', () => {
    expect(
      pickBanterLine({ trigger: 'idle-coach', speaker: 'healer', subclass: 'vigil' }),
    ).toBe('The vow waits on your hand.');
  });

  it('tank-coach asks the healer for mercy in-character — no UI verbs', () => {
    const first = pickBanterLine({ trigger: 'tank-coach', speaker: 'tank', subclass: null });
    expect(first).toBe("I'm open — don't let me fall!");

    // Forbidden UI-tutorial verbs (Wave 3b); keep coaching in-world.
    const uiVerb = /\b(click|select|mouse|button|press|player|tab)\b|point at/i;
    // In-character address / heal plea language.
    const inCharacter = /you|your|mercy|heal|open|fall|wall/i;

    const lines = new Set<string>();
    for (let i = 0; i < 5; i++) {
      lines.add(
        pickBanterLine({
          trigger: 'tank-coach',
          speaker: 'tank',
          subclass: null,
          rng: () => i / 5,
        }),
      );
    }
    expect(lines.size).toBe(5);
    for (const line of lines) {
      expect(uiVerb.test(line)).toBe(false);
      expect(inCharacter.test(line)).toBe(true);
    }
  });

  it('idle-coach and tank-coach tables never use UI tutorial verbs', () => {
    const uiVerb = /\b(click|select|mouse|button|press|player|tab)\b|point at/i;
    const coaches = ['idle-coach', 'tank-coach'] as const;
    const speakers = ['healer', 'tank'] as const;
    const subclasses = ['vigil', 'zealot', null] as const;
    for (const trigger of coaches) {
      for (const speaker of speakers) {
        for (const subclass of subclasses) {
          for (let i = 0; i < 8; i++) {
            const line = pickBanterLine({
              trigger,
              speaker,
              subclass,
              rng: () => i / 8,
            });
            expect(uiVerb.test(line), `${trigger}/${speaker}: ${line}`).toBe(false);
          }
        }
      }
    }
  });

  it('low-mana healer warns about pacing / the blue bar', () => {
    expect(
      pickBanterLine({ trigger: 'low-mana', speaker: 'healer', subclass: null }),
    ).toBe('Mana runs low. Pace it.');
  });

  it('oom healer without Bonk on bar uses dry-wait lines', () => {
    const omitted = pickBanterLine({ trigger: 'oom', speaker: 'healer', subclass: 'vigil' });
    const explicitFalse = pickBanterLine({
      trigger: 'oom',
      speaker: 'healer',
      subclass: 'vigil',
      hasBonkOnBar: false,
    });
    expect(omitted).toBe('Dry. Wait for the well.');
    expect(explicitFalse).toBe(omitted);
    expect(omitted.toLowerCase()).not.toContain('bonk');
  });

  it('oom healer with Bonk on bar points at Bonk', () => {
    const line = pickBanterLine({
      trigger: 'oom',
      speaker: 'healer',
      subclass: 'vigil',
      hasBonkOnBar: true,
    });
    expect(line).toBe('Bonk them. Mana will return.');
    expect(line.toLowerCase()).toContain('bonk');
  });

  it('hasBonkOnBar is ignored for non-oom triggers', () => {
    const without = pickBanterLine({
      trigger: 'victory',
      speaker: 'healer',
      subclass: 'vigil',
    });
    const withBonk = pickBanterLine({
      trigger: 'victory',
      speaker: 'healer',
      subclass: 'vigil',
      hasBonkOnBar: true,
    });
    expect(withBonk).toBe(without);
  });

  it('oom bonk vs no-bonk lines differ across subclasses at the same index', () => {
    for (const subclass of ['vigil', 'zealot', null] as const) {
      const dry = pickBanterLine({ trigger: 'oom', speaker: 'healer', subclass });
      const bonk = pickBanterLine({
        trigger: 'oom',
        speaker: 'healer',
        subclass,
        hasBonkOnBar: true,
      });
      expect(bonk).not.toBe(dry);
      expect(bonk.toLowerCase()).toContain('bonk');
    }
  });
});

describe('detectCloseCall', () => {
  const alive = (hp: number, maxHp: number) => ({ alive: true, hp, maxHp });
  const dead = (hp: number, maxHp: number) => ({ alive: false, hp, maxHp });

  it('fires at exactly 25% hp (integer boundary: hp*100 <= maxHp*25)', () => {
    expect(detectCloseCall([alive(25, 100)], false)).toBe(true);
  });

  it('does not fire at 26% hp', () => {
    expect(detectCloseCall([alive(26, 100)], false)).toBe(false);
  });

  it('is integer-safe on maxHp values that do not divide evenly by 4', () => {
    // 1/7 ≈ 14.3% — below 25%, must fire; float rounding must not creep in.
    expect(detectCloseCall([alive(1, 7)], false)).toBe(true);
    // 2/7 ≈ 28.6% — above 25%, must not fire.
    expect(detectCloseCall([alive(2, 7)], false)).toBe(false);
  });

  it('a dying unit (hp 0, still alive) always qualifies', () => {
    expect(detectCloseCall([alive(0, 40)], false)).toBe(true);
  });

  it('ignores a dead ally at low hp — only LIVING allies count', () => {
    expect(detectCloseCall([dead(0, 40)], false)).toBe(false);
  });

  it('ignores healthy allies above the threshold', () => {
    expect(detectCloseCall([alive(80, 100), alive(90, 100)], false)).toBe(false);
  });

  it('fires when ANY living ally (including the healer) dips low, not just non-healers', () => {
    expect(detectCloseCall([alive(90, 100), alive(10, 100)], false)).toBe(true);
  });

  it('latches once-per-fight: never fires again once alreadyFired is true, regardless of hp', () => {
    expect(detectCloseCall([alive(1, 100)], true)).toBe(false);
  });
});

describe('detectIdleCoach', () => {
  it('exports IDLE_COACH_MS as 20_000', () => {
    expect(IDLE_COACH_MS).toBe(20_000);
  });

  it('fires at exactly IDLE_COACH_MS when healer has not acted', () => {
    expect(
      detectIdleCoach({
        elapsedCombatMs: IDLE_COACH_MS,
        healerHasActed: false,
        alreadyFired: false,
      }),
    ).toBe(true);
  });

  it('does not fire before IDLE_COACH_MS', () => {
    expect(
      detectIdleCoach({
        elapsedCombatMs: IDLE_COACH_MS - 1,
        healerHasActed: false,
        alreadyFired: false,
      }),
    ).toBe(false);
  });

  it('does not fire if healer has already acted', () => {
    expect(
      detectIdleCoach({
        elapsedCombatMs: IDLE_COACH_MS,
        healerHasActed: true,
        alreadyFired: false,
      }),
    ).toBe(false);
  });

  it('latches once-per-fight via alreadyFired', () => {
    expect(
      detectIdleCoach({
        elapsedCombatMs: IDLE_COACH_MS * 2,
        healerHasActed: false,
        alreadyFired: true,
      }),
    ).toBe(false);
  });
});

describe('detectTankCoach', () => {
  const tank = (hp: number, maxHp: number, alive = true) => ({ alive, hp, maxHp });

  it('fires at exactly 35% hp (integer boundary: hp*100 <= maxHp*35)', () => {
    expect(
      detectTankCoach({
        tank: tank(35, 100),
        healerHasHealed: false,
        alreadyFired: false,
      }),
    ).toBe(true);
  });

  it('does not fire at 36% hp', () => {
    expect(
      detectTankCoach({
        tank: tank(36, 100),
        healerHasHealed: false,
        alreadyFired: false,
      }),
    ).toBe(false);
  });

  it('is integer-safe on maxHp values that do not divide evenly', () => {
    // 7/20 = 35% exactly — must fire.
    expect(
      detectTankCoach({
        tank: tank(7, 20),
        healerHasHealed: false,
        alreadyFired: false,
      }),
    ).toBe(true);
    // 8/20 = 40% — must not.
    expect(
      detectTankCoach({
        tank: tank(8, 20),
        healerHasHealed: false,
        alreadyFired: false,
      }),
    ).toBe(false);
  });

  it('does not fire if healer has already healed this fight', () => {
    expect(
      detectTankCoach({
        tank: tank(1, 100),
        healerHasHealed: true,
        alreadyFired: false,
      }),
    ).toBe(false);
  });

  it('ignores a dead tank even at 0 hp', () => {
    expect(
      detectTankCoach({
        tank: tank(0, 100, false),
        healerHasHealed: false,
        alreadyFired: false,
      }),
    ).toBe(false);
  });

  it('latches once-per-fight via alreadyFired', () => {
    expect(
      detectTankCoach({
        tank: tank(1, 100),
        healerHasHealed: false,
        alreadyFired: true,
      }),
    ).toBe(false);
  });
});

describe('detectLowMana', () => {
  it('fires at exactly 25% mana when mana > 0', () => {
    expect(detectLowMana({ mana: 25, maxMana: 100, alreadyFired: false })).toBe(true);
  });

  it('does not fire at 26% mana', () => {
    expect(detectLowMana({ mana: 26, maxMana: 100, alreadyFired: false })).toBe(false);
  });

  it('does not fire at 0 mana (oom owns that case)', () => {
    expect(detectLowMana({ mana: 0, maxMana: 100, alreadyFired: false })).toBe(false);
  });

  it('is integer-safe on maxMana that does not divide evenly by 4', () => {
    // 1/7 ≈ 14.3% — below 25%, must fire.
    expect(detectLowMana({ mana: 1, maxMana: 7, alreadyFired: false })).toBe(true);
    // 2/7 ≈ 28.6% — above 25%, must not.
    expect(detectLowMana({ mana: 2, maxMana: 7, alreadyFired: false })).toBe(false);
  });

  it('latches once-per-fight via alreadyFired', () => {
    expect(detectLowMana({ mana: 1, maxMana: 100, alreadyFired: true })).toBe(false);
  });
});

describe('detectOom', () => {
  it('fires at mana 0', () => {
    expect(detectOom({ mana: 0, alreadyFired: false })).toBe(true);
  });

  it('fires when mana is negative (overspend edge)', () => {
    expect(detectOom({ mana: -1, alreadyFired: false })).toBe(true);
  });

  it('does not fire while any mana remains', () => {
    expect(detectOom({ mana: 1, alreadyFired: false })).toBe(false);
  });

  it('latches once-per-fight via alreadyFired', () => {
    expect(detectOom({ mana: 0, alreadyFired: true })).toBe(false);
  });
});
