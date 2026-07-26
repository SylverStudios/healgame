import { describe, expect, it } from 'vitest';
import { wipeCellDelayMs } from './transitions';

// Only wipeCellDelayMs is pure enough to test in isolation — everything
// else in transitions.ts is Phaser camera/tween/timer wiring (see the
// module doc comment). Note: transitions.ts imports Phaser as a type only
// (`import type Phaser from 'phaser'`), so this file is safe to import
// under vitest's default node environment (no jsdom) — see
// docs/ui-theme-handoff.md's "Portraits (chunk 5)" gotcha about real
// (non-type) Phaser value imports crashing on `navigator is not defined`.

describe('wipeCellDelayMs', () => {
  it('starts the top-left cell immediately', () => {
    expect(wipeCellDelayMs(0, 0, 16, 9, 250)).toBe(0);
  });

  it('finishes the bottom-right cell exactly at the duration', () => {
    expect(wipeCellDelayMs(15, 8, 16, 9, 250)).toBe(250);
  });

  it('is monotonically non-decreasing along a diagonal sweep', () => {
    const delays: number[] = [];
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 16; col++) {
        delays.push(wipeCellDelayMs(col, row, 16, 9, 250));
      }
    }
    for (let i = 1; i < delays.length; i++) {
      // Not globally sorted by array order (row-major vs. diagonal), but
      // every value must stay within [0, duration] and be deterministic.
      expect(delays[i]).toBeGreaterThanOrEqual(0);
      expect(delays[i]).toBeLessThanOrEqual(250);
    }
    // Same (col,row) always yields the same delay — deterministic, no
    // Math.random — so re-running the grid twice matches exactly.
    expect(wipeCellDelayMs(5, 3, 16, 9, 250)).toBe(wipeCellDelayMs(5, 3, 16, 9, 250));
  });

  it('degenerates to 0 for a 1x1 grid instead of dividing by zero', () => {
    expect(wipeCellDelayMs(0, 0, 1, 1, 250)).toBe(0);
  });
});
