/**
 * v0.3 lattice: pure build-glyph derivation — no Phaser, no wall clock, no
 * Math.random. Reduces a `TreeConfig` + a player's owned node ids down to a
 * compact, serializable silhouette of the lit path for UI (run summary /
 * history) to draw. See pinned contract: docs/v0.3-handoff.md → "Build
 * glyph".
 *
 * An edge is "owned/traversed" when:
 *   1. it exists in the lattice (the destination spot's first chain node
 *      `requires` the specific source node — same definition `compile()`
 *      uses to derive `TreeView.edges`), AND
 *   2. both the specific source node and the destination's first chain node
 *      are owned.
 *
 * (2) is deliberately node-level, not spot-level: a spot can hold an owned
 * node without its *first* chain node being owned (e.g. a forsaken-path
 * consolation entry reached after the natural first entry became
 * exclusive-locked forever) — that shouldn't be drawn as if the primary
 * route was walked.
 */

import type { TreeConfig } from './types';

/** Compact descriptor of the lit path — serializable, UI-agnostic. */
export type BuildGlyph = {
  /** Stable id for telemetry / equality (hash of the owned edge set). */
  id: string;
  /** Grid points / segments for silhouette draw (orthogonal lattice). */
  segments: ReadonlyArray<{ x1: number; y1: number; x2: number; y2: number }>;
};

/** Deterministic 32-bit FNV-1a hash, rendered as 8 lowercase hex chars. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildGlyphFromTree(
  config: TreeConfig,
  ownedNodeIds: ReadonlySet<string>,
): BuildGlyph {
  const nodesById = new Map(config.nodes.map((n) => [n.id, n]));
  const spotOfNode = new Map<string, string>();
  for (const spot of config.spots) {
    for (const nodeId of spot.chain) spotOfNode.set(nodeId, spot.id);
  }
  const gridBySpot = new Map(config.spots.map((s) => [s.id, s.grid]));

  const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const edgeKeys: string[] = [];

  // Deterministic order: iterate spots (destination) in config-declared
  // order, then requires.nodes in declared order — same traversal shape as
  // tree.ts's edge derivation, so results are stable across calls for a
  // fixed config regardless of `ownedNodeIds`'s (unordered) Set iteration.
  for (const spot of config.spots) {
    const firstId = spot.chain[0];
    if (firstId === undefined) continue;
    const firstNode = nodesById.get(firstId);
    if (!firstNode?.requires) continue;

    for (const reqId of firstNode.requires.nodes) {
      const fromSpotId = spotOfNode.get(reqId);
      if (fromSpotId === undefined || fromSpotId === spot.id) continue;

      const owned = ownedNodeIds.has(reqId) && ownedNodeIds.has(firstId);
      if (!owned) continue;

      const fromGrid = gridBySpot.get(fromSpotId);
      const toGrid = gridBySpot.get(spot.id);
      if (!fromGrid || !toGrid) continue;

      segments.push({ x1: fromGrid.col, y1: fromGrid.row, x2: toGrid.col, y2: toGrid.row });
      edgeKeys.push(`${fromSpotId}>${spot.id}`);
    }
  }

  const id = fnv1a([...edgeKeys].sort().join('|'));
  return { id, segments };
}
