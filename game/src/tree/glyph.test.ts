/**
 * buildGlyphFromTree — pure lattice → silhouette reduction. See pinned
 * contract: docs/v0.3-handoff.md → "Build glyph".
 */

import { describe, expect, it } from 'vitest';
import { buildGlyphFromTree } from './glyph';
import type { TreeConfig } from './types';

// Small diamond lattice with grid coords, deliberately including one spot
// (`nogrid`) that omits `grid` to prove missing-grid edges are skipped.
const CONFIG: TreeConfig = {
  nodes: [
    { id: 'root', content: null, cost: { currency: 'gold', amount: 0 } },
    {
      id: 'left',
      content: null,
      cost: { currency: 'gold', amount: 0 },
      requires: { mode: 'all', nodes: ['root'] },
    },
    {
      id: 'right',
      content: null,
      cost: { currency: 'gold', amount: 0 },
      requires: { mode: 'all', nodes: ['root'] },
    },
    {
      id: 'join',
      content: null,
      cost: { currency: 'gold', amount: 0 },
      requires: { mode: 'any', nodes: ['left', 'right'] },
    },
    {
      id: 'noGridNode',
      content: null,
      cost: { currency: 'gold', amount: 0 },
      requires: { mode: 'all', nodes: ['join'] },
    },
  ],
  spots: [
    { id: 'root', chain: ['root'], grid: { col: 0, row: 0 } },
    { id: 'left', chain: ['left'], grid: { col: 1, row: -1 } },
    { id: 'right', chain: ['right'], grid: { col: 1, row: 1 } },
    { id: 'join', chain: ['join'], grid: { col: 2, row: 0 } },
    { id: 'nogrid', chain: ['noGridNode'] }, // grid omitted on purpose
  ],
};

describe('buildGlyphFromTree', () => {
  it('produces no segments for an empty owned set, with a stable id', () => {
    const a = buildGlyphFromTree(CONFIG, new Set());
    const b = buildGlyphFromTree(CONFIG, new Set());
    expect(a.segments).toEqual([]);
    expect(a.id).toBe(b.id);
  });

  it('produces one segment per traversed edge, in grid coordinates', () => {
    const glyph = buildGlyphFromTree(CONFIG, new Set(['root', 'left']));
    expect(glyph.segments).toEqual([{ x1: 0, y1: 0, x2: 1, y2: -1 }]);
  });

  it('includes both convergent edges into an any-mode join once both sides are owned', () => {
    const glyph = buildGlyphFromTree(CONFIG, new Set(['root', 'left', 'right', 'join']));
    expect(glyph.segments).toEqual(
      expect.arrayContaining([
        { x1: 0, y1: 0, x2: 1, y2: -1 }, // root -> left
        { x1: 0, y1: 0, x2: 1, y2: 1 }, // root -> right
        { x1: 1, y1: -1, x2: 2, y2: 0 }, // left -> join
        { x1: 1, y1: 1, x2: 2, y2: 0 }, // right -> join
      ]),
    );
    expect(glyph.segments).toHaveLength(4);
  });

  it('only one side of an any-mode join produces a segment when the other is unowned', () => {
    const glyph = buildGlyphFromTree(CONFIG, new Set(['root', 'left', 'join']));
    expect(glyph.segments).toEqual(
      expect.arrayContaining([
        { x1: 0, y1: 0, x2: 1, y2: -1 },
        { x1: 1, y1: -1, x2: 2, y2: 0 },
      ]),
    );
    expect(glyph.segments).toHaveLength(2);
  });

  it('skips an edge whose destination spot has no grid coordinates', () => {
    const glyph = buildGlyphFromTree(
      CONFIG,
      new Set(['root', 'left', 'right', 'join', 'noGridNode']),
    );
    expect(glyph.segments.every((s) => s.x2 !== undefined)).toBe(true);
    expect(glyph.segments).toHaveLength(4); // the join->nogrid edge is silently dropped
  });

  it('is deterministic: same owned set (any Set insertion order) → identical id and segment order', () => {
    const ownedA = new Set(['root', 'left', 'right', 'join']);
    const ownedB = new Set(['join', 'right', 'left', 'root']); // reversed insertion order
    const a = buildGlyphFromTree(CONFIG, ownedA);
    const b = buildGlyphFromTree(CONFIG, ownedB);
    expect(a).toEqual(b);
  });

  it('id changes when the owned edge set changes', () => {
    const a = buildGlyphFromTree(CONFIG, new Set(['root', 'left']));
    const b = buildGlyphFromTree(CONFIG, new Set(['root', 'right']));
    expect(a.id).not.toBe(b.id);
  });

  it('an unowned prerequisite (e.g. via a forsaken-path consolation) does not count as traversed', () => {
    // "join" owned without "left" or "right" — shouldn't happen via real
    // purchase flow, but the reducer should still refuse to draw a phantom
    // edge for a route that was never actually walked.
    const glyph = buildGlyphFromTree(CONFIG, new Set(['join']));
    expect(glyph.segments).toEqual([]);
  });
});
