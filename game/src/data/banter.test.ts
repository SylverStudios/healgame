import { describe, expect, it } from 'vitest';
import { detectCloseCall, pickBanterLine } from './banter';

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
    const triggers = ['close-call', 'wipe', 'victory'] as const;
    const speakers = ['healer', 'tank'] as const;
    for (const trigger of triggers) {
      for (const speaker of speakers) {
        const line = pickBanterLine({ trigger, speaker, subclass: null });
        expect(line.length).toBeGreaterThan(0);
      }
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
