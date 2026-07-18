import { describe, expect, it } from 'vitest';
import { normalizeGlyphSegments } from './buildGlyph';

describe('normalizeGlyphSegments', () => {
  it('returns empty for empty input', () => {
    expect(normalizeGlyphSegments([])).toEqual([]);
  });

  it('centers a single segment on its own midpoint', () => {
    const out = normalizeGlyphSegments([{ x1: 0, y1: 0, x2: 4, y2: 0 }]);
    expect(out).toEqual([{ x1: -2, y1: 0, x2: 2, y2: 0 }]);
  });

  it('centers on the bounding box, not the mean of all endpoints', () => {
    // Segments span x:[0,6], y:[0,2] — bbox center is (3,1), not any endpoint average.
    const out = normalizeGlyphSegments([
      { x1: 0, y1: 0, x2: 2, y2: 0 },
      { x1: 2, y1: 0, x2: 6, y2: 2 },
    ]);
    expect(out).toEqual([
      { x1: -3, y1: -1, x2: -1, y2: -1 },
      { x1: -1, y1: -1, x2: 3, y2: 1 },
    ]);
  });

  it('centers regardless of which grid region the build occupies', () => {
    // Same shape, translated far from the origin — normalized output is identical.
    const near = normalizeGlyphSegments([{ x1: 0, y1: 0, x2: 2, y2: 2 }]);
    const far = normalizeGlyphSegments([{ x1: 100, y1: 200, x2: 102, y2: 202 }]);
    expect(far).toEqual(near);
  });

  it('handles a degenerate single point (zero-length segment)', () => {
    const out = normalizeGlyphSegments([{ x1: 5, y1: 5, x2: 5, y2: 5 }]);
    expect(out).toEqual([{ x1: 0, y1: 0, x2: 0, y2: 0 }]);
  });
});
