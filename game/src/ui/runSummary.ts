/**
 * v0.3 chunk E: pure view-model for the wipe/victory run summary panel — no
 * Phaser. CombatScene calls `buildRunSummary` with the same `save.treeRanks`
 * it already loaded to render the panel; Hub calls it again from the
 * returned `CombatResult` + its own `save.treeRanks` to build the persisted
 * `RunRecord`. Same inputs (treeRanks is unchanged between combat end and
 * the Hub applying the result), so both computations agree and the glyph
 * stored is exactly the glyph shown. See docs/v0.3-handoff.md →
 * "Wipe / victory summary".
 */

import { buildGlyphFromTree, type BuildGlyph } from '../tree';
import { ownedIdsFromLegacyRanks, TALENT_TREE } from '../data/talentTree';
import type { RunRecord, SavedGlyph } from '../save/save';

export interface RunSummaryViewModel {
  outcome: 'victory' | 'wipe';
  /**
   * Display label for the panel title. Victory shows 'VICTORY'; wipe is null —
   * the wipe outcome is already obvious from the transition, so no title text.
   */
  outcomeLabel: string | null;
  /** engine.rewards.xp at combat end — accrues per kill, survives wipes. */
  xpGained: number;
  glyph: BuildGlyph;
}

/** True when the lit path has at least one edge to draw (any owned tree progress). */
export function hasBuildGlyph(glyph: Pick<BuildGlyph, 'segments'>): boolean {
  return glyph.segments.length > 0;
}

/** Pure: assembles the outcome/xp/glyph shown on the wipe/victory panel. */
export function buildRunSummary(args: {
  status: 'victory' | 'wipe';
  xp: number;
  treeRanks: Record<string, number>;
}): RunSummaryViewModel {
  const owned = new Set(ownedIdsFromLegacyRanks(args.treeRanks));
  const glyph = buildGlyphFromTree(TALENT_TREE, owned);
  return {
    outcome: args.status,
    outcomeLabel: args.status === 'victory' ? 'VICTORY' : null,
    xpGained: args.xp,
    glyph,
  };
}

/** Pure: the persisted record for `pushRecentRun` — same glyph as the summary shown. */
export function runRecordFromSummary(summary: RunSummaryViewModel, dungeonId: string): RunRecord {
  const glyph: SavedGlyph = {
    id: summary.glyph.id,
    segments: summary.glyph.segments.map((seg) => ({ ...seg })),
  };
  return {
    outcome: summary.outcome,
    dungeonId,
    xpGained: summary.xpGained,
    glyph,
  };
}
