import { describe, expect, it } from 'vitest';
import { buildRunSummary, hasBuildGlyph, runRecordFromSummary } from './runSummary';
import { buildGlyphFromTree } from '../tree';
import { ownedIdsFromLegacyRanks, TALENT_TREE } from '../data/talentTree';
import { xpForLevel } from '../data/constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a summary with sensible defaults so individual tests only override what matters. */
function makeSummary(overrides: {
  status?: 'victory' | 'wipe';
  xp?: number;
  treeRanks?: Record<string, number>;
  preFightXp?: number;
}) {
  return buildRunSummary({
    status: 'victory',
    xp: 0,
    treeRanks: {},
    preFightXp: 0,
    ...overrides,
  });
}

describe('buildRunSummary', () => {
  it('labels victory; wipe has no title text (outcome is already obvious)', () => {
    expect(makeSummary({ status: 'victory', xp: 5 }).outcomeLabel).toBe('VICTORY');
    expect(makeSummary({ status: 'wipe', xp: 5 }).outcomeLabel).toBeNull();
  });

  it('carries xpGained through unchanged', () => {
    expect(makeSummary({ status: 'wipe', xp: 42 }).xpGained).toBe(42);
  });

  it('derives the glyph from treeRanks via the same legacy bridge + buildGlyphFromTree the tree UI uses', () => {
    const treeRanks = { 'deep-reserves': 1, 'vigil-oath': 1, 'vigil-patient-vow': 1 };
    const summary = makeSummary({ status: 'victory', xp: 1, treeRanks });
    const expected = buildGlyphFromTree(TALENT_TREE, new Set(ownedIdsFromLegacyRanks(treeRanks)));
    expect(summary.glyph).toEqual(expected);
    expect(hasBuildGlyph(summary.glyph)).toBe(true);
  });

  it('produces an empty-segment glyph for an empty tree (nothing to draw)', () => {
    const summary = makeSummary({ status: 'wipe', xp: 0 });
    expect(summary.glyph.segments).toEqual([]);
    expect(hasBuildGlyph(summary.glyph)).toBe(false);
  });

  it('is deterministic: same treeRanks input always yields the same glyph id', () => {
    const treeRanks = { 'deep-reserves': 1, 'vigil-oath': 1 };
    const a = makeSummary({ status: 'victory', xp: 1, treeRanks });
    const b = makeSummary({ status: 'wipe', xp: 99, treeRanks });
    expect(a.glyph.id).toBe(b.glyph.id);
  });
});

// ---------------------------------------------------------------------------
// Level-up detection
// ---------------------------------------------------------------------------
// XP thresholds (from constants.ts xpForLevel):
//   level 1 → 0 XP, level 2 → 10 XP, level 3 → 30 XP, level 4 → 60 XP …

describe('buildRunSummary — level-up detection', () => {
  it('no level-up when XP gain does not cross a threshold', () => {
    // Start at level 1 (0 XP), earn 5 XP — stays level 1 (threshold is 10)
    const s = makeSummary({ preFightXp: 0, xp: 5 });
    expect(s.leveledUp).toBe(false);
    expect(s.levelBefore).toBe(1);
    expect(s.levelAfter).toBe(1);
    expect(s.levelUpLabel).toBeNull();
  });

  it('exact threshold crossing triggers a level-up (level 1 → 2)', () => {
    // xpForLevel(2) = 10; earn exactly 10 from 0 XP
    const threshold = xpForLevel(2); // 10
    const s = makeSummary({ preFightXp: 0, xp: threshold });
    expect(s.leveledUp).toBe(true);
    expect(s.levelBefore).toBe(1);
    expect(s.levelAfter).toBe(2);
    expect(s.levelUpLabel).toBe('Level 1 → 2');
  });

  it('level-up from mid-level (level 2 → 3)', () => {
    // xpForLevel(2) = 10, xpForLevel(3) = 30; start at 10 XP, earn 20
    const s = makeSummary({ preFightXp: xpForLevel(2), xp: xpForLevel(3) - xpForLevel(2) });
    expect(s.leveledUp).toBe(true);
    expect(s.levelBefore).toBe(2);
    expect(s.levelAfter).toBe(3);
    expect(s.levelUpLabel).toBe('Level 2 → 3');
  });

  it('multi-level jump in one fight', () => {
    // Start at level 1 (0 XP), earn enough XP to jump straight to level 3
    const s = makeSummary({ preFightXp: 0, xp: xpForLevel(3) }); // 30 XP
    expect(s.leveledUp).toBe(true);
    expect(s.levelBefore).toBe(1);
    expect(s.levelAfter).toBe(3);
    expect(s.levelUpLabel).toBe('Level 1 → 3');
  });

  it('a wipe can still cause a level-up (status does not block the math)', () => {
    const s = makeSummary({ status: 'wipe', preFightXp: 0, xp: xpForLevel(2) });
    expect(s.leveledUp).toBe(true);
    expect(s.levelBefore).toBe(1);
    expect(s.levelAfter).toBe(2);
  });

  it('a victory with XP below the next threshold omits the level-up line', () => {
    // Already at level 2 (10 XP), earn 5 — threshold for level 3 is 30
    const s = makeSummary({ status: 'victory', preFightXp: xpForLevel(2), xp: 5 });
    expect(s.leveledUp).toBe(false);
    expect(s.levelUpLabel).toBeNull();
  });

  it('XP exactly one short of threshold does NOT level up', () => {
    const threshold = xpForLevel(2); // 10
    const s = makeSummary({ preFightXp: 0, xp: threshold - 1 });
    expect(s.leveledUp).toBe(false);
    expect(s.levelUpLabel).toBeNull();
  });
});

describe('runRecordFromSummary', () => {
  it('maps the summary into a RunRecord carrying the same outcome/xp/glyph', () => {
    const treeRanks = { 'deep-reserves': 1, 'vigil-oath': 1, 'vigil-patient-vow': 1 };
    const summary = makeSummary({ status: 'victory', xp: 7, treeRanks });
    const record = runRecordFromSummary(summary, 'ash-gate');
    expect(record).toEqual({
      outcome: 'victory',
      dungeonId: 'ash-gate',
      xpGained: 7,
      glyph: { id: summary.glyph.id, segments: summary.glyph.segments.map((s) => ({ ...s })) },
    });
  });

  it('produces a plain mutable segments array (not the tree module readonly array)', () => {
    const summary = makeSummary({
      status: 'wipe',
      xp: 0,
      treeRanks: { 'deep-reserves': 1, 'vigil-oath': 1, 'vigil-patient-vow': 1 },
    });
    const record = runRecordFromSummary(summary, 'ash-gate');
    expect(record.glyph.segments.length).toBe(summary.glyph.segments.length);
    // Mutating the record's copy must not affect the source glyph.
    if (record.glyph.segments[0]) {
      record.glyph.segments[0].x1 = 999;
      expect(summary.glyph.segments[0]?.x1).not.toBe(999);
    }
  });
});
