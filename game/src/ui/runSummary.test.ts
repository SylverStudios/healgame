import { describe, expect, it } from 'vitest';
import { buildRunSummary, runRecordFromSummary } from './runSummary';
import { buildGlyphFromTree } from '../tree';
import { ownedIdsFromLegacyRanks, TALENT_TREE } from '../data/talentTree';

describe('buildRunSummary', () => {
  it('labels victory and wipe outcomes', () => {
    expect(buildRunSummary({ status: 'victory', xp: 5, treeRanks: {} }).outcomeLabel).toBe('VICTORY');
    expect(buildRunSummary({ status: 'wipe', xp: 5, treeRanks: {} }).outcomeLabel).toBe('WIPED');
  });

  it('carries xpGained through unchanged', () => {
    expect(buildRunSummary({ status: 'wipe', xp: 42, treeRanks: {} }).xpGained).toBe(42);
  });

  it('derives the glyph from treeRanks via the same legacy bridge + buildGlyphFromTree the tree UI uses', () => {
    const treeRanks = { 'deep-reserves': 1, 'vigil-oath': 1, 'vigil-patient-vow': 1 };
    const summary = buildRunSummary({ status: 'victory', xp: 1, treeRanks });
    const expected = buildGlyphFromTree(TALENT_TREE, new Set(ownedIdsFromLegacyRanks(treeRanks)));
    expect(summary.glyph).toEqual(expected);
  });

  it('produces an empty-segment glyph for an empty tree', () => {
    const summary = buildRunSummary({ status: 'wipe', xp: 0, treeRanks: {} });
    expect(summary.glyph.segments).toEqual([]);
  });

  it('is deterministic: same treeRanks input always yields the same glyph id', () => {
    const treeRanks = { 'deep-reserves': 1, 'vigil-oath': 1 };
    const a = buildRunSummary({ status: 'victory', xp: 1, treeRanks });
    const b = buildRunSummary({ status: 'wipe', xp: 99, treeRanks });
    expect(a.glyph.id).toBe(b.glyph.id);
  });
});

describe('runRecordFromSummary', () => {
  it('maps the summary into a RunRecord carrying the same outcome/xp/glyph', () => {
    const treeRanks = { 'deep-reserves': 1, 'vigil-oath': 1, 'vigil-patient-vow': 1 };
    const summary = buildRunSummary({ status: 'victory', xp: 7, treeRanks });
    const record = runRecordFromSummary(summary, 'ash-gate');
    expect(record).toEqual({
      outcome: 'victory',
      dungeonId: 'ash-gate',
      xpGained: 7,
      glyph: { id: summary.glyph.id, segments: summary.glyph.segments.map((s) => ({ ...s })) },
    });
  });

  it('produces a plain mutable segments array (not the tree module readonly array)', () => {
    const summary = buildRunSummary({
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
