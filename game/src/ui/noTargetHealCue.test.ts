import { describe, expect, it } from 'vitest';
import { NO_TARGET_HEAL_LINE } from '../data/banter';
import {
  isAllyTargetHealSpell,
  NO_TARGET_HEAL_COOLDOWN_MS,
  NO_TARGET_HEAL_EMPHASIS,
  noTargetHealSegments,
  shouldFireNoTargetHealCue,
} from './noTargetHealCue';

const HEAL = { damage: 0, heal: 4 };
const DAMAGE = { damage: 1, heal: 0 };

describe('isAllyTargetHealSpell', () => {
  it('treats damage>0 as enemy auto-target (not a heal cue)', () => {
    expect(isAllyTargetHealSpell(DAMAGE)).toBe(false);
  });

  it('treats damage-less spells as ally-target heals', () => {
    expect(isAllyTargetHealSpell(HEAL)).toBe(true);
    expect(isAllyTargetHealSpell({})).toBe(true);
  });
});

describe('shouldFireNoTargetHealCue', () => {
  it('fires for a heal with null ally target when not rate-limited', () => {
    expect(
      shouldFireNoTargetHealCue({
        spell: HEAL,
        allyTargetId: null,
        nowMs: 1000,
        lastFiredAtMs: null,
      }),
    ).toBe(true);
  });

  it('does not fire for damage / Bonk', () => {
    expect(
      shouldFireNoTargetHealCue({
        spell: DAMAGE,
        allyTargetId: null,
        nowMs: 1000,
        lastFiredAtMs: null,
      }),
    ).toBe(false);
  });

  it('does not fire when an ally target is already selected', () => {
    expect(
      shouldFireNoTargetHealCue({
        spell: HEAL,
        allyTargetId: 'tank',
        nowMs: 1000,
        lastFiredAtMs: null,
      }),
    ).toBe(false);
  });

  it('does not fire for an unknown spell', () => {
    expect(
      shouldFireNoTargetHealCue({
        spell: undefined,
        allyTargetId: null,
        nowMs: 1000,
        lastFiredAtMs: null,
      }),
    ).toBe(false);
  });

  it('rate-limits within the cooldown window', () => {
    expect(
      shouldFireNoTargetHealCue({
        spell: HEAL,
        allyTargetId: null,
        nowMs: 2500,
        lastFiredAtMs: 0,
      }),
    ).toBe(false);
    expect(
      shouldFireNoTargetHealCue({
        spell: HEAL,
        allyTargetId: null,
        nowMs: NO_TARGET_HEAL_COOLDOWN_MS,
        lastFiredAtMs: 0,
      }),
    ).toBe(true);
  });
});

describe('noTargetHealSegments', () => {
  it('marks WHO as the emphasized segment of the locked line', () => {
    const segments = noTargetHealSegments();
    expect(segments.map((s) => s.text).join('')).toBe(NO_TARGET_HEAL_LINE);
    const who = segments.find((s) => s.emphasize);
    expect(who?.text).toBe(NO_TARGET_HEAL_EMPHASIS);
    expect(segments.filter((s) => s.emphasize)).toHaveLength(1);
  });
});
