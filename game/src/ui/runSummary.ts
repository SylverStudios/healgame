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
import { levelForXp } from '../data/constants';
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
  /** Whether this fight caused at least one level gain. */
  leveledUp: boolean;
  /** Player level computed from XP before this fight. */
  levelBefore: number;
  /** Player level computed from XP after this fight. */
  levelAfter: number;
  /**
   * Human-readable level-up status. `"Level N → M"` when leveled (covers
   * multi-level jumps); `null` when the fight didn't cross a threshold
   * (overlay omits the line).
   */
  levelUpLabel: string | null;
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
  /**
   * Player's total XP at the start of this fight (before rewards). Defaults
   * to 0 when omitted so existing callers that have not yet been updated
   * continue to type-check; level-up fields will be inaccurate until the
   * caller is updated to pass the real pre-fight XP.
   */
  preFightXp?: number;
}): RunSummaryViewModel {
  const owned = new Set(ownedIdsFromLegacyRanks(args.treeRanks));
  const glyph = buildGlyphFromTree(TALENT_TREE, owned);

  const preFightXp = args.preFightXp ?? 0;
  const levelBefore = levelForXp(preFightXp);
  const levelAfter = levelForXp(preFightXp + args.xp);
  const leveledUp = levelAfter > levelBefore;
  const levelUpLabel = leveledUp ? `Level ${levelBefore} → ${levelAfter}` : null;

  return {
    outcome: args.status,
    outcomeLabel: args.status === 'victory' ? 'VICTORY' : null,
    xpGained: args.xp,
    glyph,
    leveledUp,
    levelBefore,
    levelAfter,
    levelUpLabel,
  };
}

/**
 * Pure: compact damage-tally line for the result overlay.
 * Calls `resolveName` for each entry; skips entries with amount 0.
 * Returns an empty string when the array is empty or all amounts are 0.
 */
export function formatPartyDamage(
  partyDamage: ReadonlyArray<{ unitId: string; amount: number }>,
  resolveName: (unitId: string) => string,
): string {
  const parts = partyDamage
    .filter(({ amount }) => amount > 0)
    .map(({ unitId, amount }) => `${resolveName(unitId)} ${amount}`);
  return parts.join('  ');
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
