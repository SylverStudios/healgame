/**
 * Pure layout for a TreeView — no Phaser. Places spots in rows by graph depth
 * (longest path from a root via `edges`). Optional per-spot overrides win when
 * provided (keeps journey click targets stable for a known config).
 */

import type { TreeView } from './types';

export interface SpotPosition {
  x: number;
  y: number;
}

export interface LayoutOptions {
  /** Canvas width used to center each row. */
  width: number;
  /** Y of the first (root) row. */
  top?: number;
  /** Vertical distance between depth rows. */
  rowGap?: number;
  /** Horizontal inset from canvas edges when auto-placing a row. */
  sidePad?: number;
  /** Spot id → fixed position; skips auto-placement for those spots. */
  overrides?: Readonly<Record<string, SpotPosition>>;
}

/**
 * Compute screen positions for every spot in the view.
 * Depth = longest path from a root along `treeView.edges`.
 */
export function layoutSpots(treeView: TreeView, options: LayoutOptions): Map<string, SpotPosition> {
  const top = options.top ?? 130;
  const rowGap = options.rowGap ?? 130;
  const sidePad = options.sidePad ?? 100;
  const overrides = options.overrides ?? {};

  const depth = new Map<string, number>();
  for (const spot of treeView.spots) {
    if (spot.parentSpotIds.length === 0) depth.set(spot.id, 0);
  }

  // Relax along edges until stable (handles multi-parent diamonds).
  let changed = true;
  let guard = 0;
  while (changed && guard++ < treeView.spots.length + 2) {
    changed = false;
    for (const edge of treeView.edges) {
      const fromDepth = depth.get(edge.fromSpotId);
      if (fromDepth === undefined) continue;
      const next = fromDepth + 1;
      const cur = depth.get(edge.toSpotId);
      if (cur === undefined || next > cur) {
        depth.set(edge.toSpotId, next);
        changed = true;
      }
    }
  }

  for (const spot of treeView.spots) {
    if (!depth.has(spot.id)) depth.set(spot.id, 0);
  }

  const byDepth = new Map<number, string[]>();
  for (const spot of treeView.spots) {
    const d = depth.get(spot.id) ?? 0;
    const row = byDepth.get(d) ?? [];
    row.push(spot.id);
    byDepth.set(d, row);
  }

  const orderIndex = new Map(treeView.spots.map((s, i) => [s.id, i]));
  for (const row of byDepth.values()) {
    row.sort((a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0));
  }

  const positions = new Map<string, SpotPosition>();
  const depths = [...byDepth.keys()].sort((a, b) => a - b);
  for (const d of depths) {
    const row = byDepth.get(d)!;
    const y = top + d * rowGap;
    const n = row.length;
    for (let i = 0; i < n; i++) {
      const id = row[i]!;
      const override = overrides[id];
      if (override) {
        positions.set(id, { x: override.x, y: override.y });
        continue;
      }
      const usable = Math.max(0, options.width - sidePad * 2);
      const x = n === 1 ? options.width / 2 : sidePad + (usable * i) / Math.max(1, n - 1);
      positions.set(id, { x, y });
    }
  }

  return positions;
}
