import { describe, expect, it } from 'vitest';
import { clampMusicPct, musicPctToGain } from './music';

describe('clampMusicPct', () => {
  it('rounds to the nearest integer', () => {
    expect(clampMusicPct(49.6)).toBe(50);
    expect(clampMusicPct(49.4)).toBe(49);
  });

  it('clamps below 0 up to 0', () => {
    expect(clampMusicPct(-5)).toBe(0);
  });

  it('clamps above 100 down to 100', () => {
    expect(clampMusicPct(150)).toBe(100);
  });

  it('treats non-finite input as 0', () => {
    expect(clampMusicPct(Number.NaN)).toBe(0);
    expect(clampMusicPct(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('passes through in-range integers unchanged', () => {
    expect(clampMusicPct(0)).toBe(0);
    expect(clampMusicPct(50)).toBe(50);
    expect(clampMusicPct(100)).toBe(100);
  });
});

describe('musicPctToGain', () => {
  it('maps 0..100 to 0..1 gain', () => {
    expect(musicPctToGain(0)).toBe(0);
    expect(musicPctToGain(50)).toBe(0.5);
    expect(musicPctToGain(100)).toBe(1);
  });

  it('clamps out-of-range pct before converting', () => {
    expect(musicPctToGain(-10)).toBe(0);
    expect(musicPctToGain(200)).toBe(1);
  });
});
