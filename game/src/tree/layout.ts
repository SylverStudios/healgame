/**
 * Pure layout for a TreeView — no Phaser. Two strategies:
 *
 *  - `layoutSpots` places rows by graph depth (longest path from a root via
 *    `edges`), auto-centering each row. Optional per-spot overrides win when
 *    provided (keeps journey click targets stable for a known config).
 *  - `layoutFromGrid` (v0.3 lattice) maps a spot's authored `SpotDef.grid`
 *    (integer col/row — see `data/talentTree.ts`) directly to pixels via
 *    fixed spacing constants. No graph walk, no auto-centering: the config
 *    author placed every spot explicitly, so this is a pure linear transform,
 *    trivially testable without Phaser.
 */

import type { TreeView } from './types';

export interface SpotPosition {
  x: number;
  y: number;
}

/** Integer grid coordinate for one spot (column = progression depth, row = lane). */
export interface GridPosition {
  col: number;
  row: number;
}

export interface GridSpacing {
  /** Pixel x for grid col 0. */
  left: number;
  /** Pixel y for grid row 0 (rows may be negative — spurs above the baseline). */
  top: number;
  /** Pixel distance between adjacent columns. */
  colWidth: number;
  /** Pixel distance between adjacent rows. */
  rowHeight: number;
}

/**
 * Linear grid→pixel transform: `x = left + col * colWidth`,
 * `y = top + row * rowHeight`. Pure — no graph walk, no Phaser. Spots without
 * a `grid` entry in the input map are simply absent from the result (caller
 * decides how to handle, e.g. skip rendering).
 */
export function layoutFromGrid(
  grid: Readonly<Record<string, GridPosition>>,
  spacing: GridSpacing,
): Map<string, SpotPosition> {
  const positions = new Map<string, SpotPosition>();
  for (const [spotId, pos] of Object.entries(grid)) {
    positions.set(spotId, {
      x: spacing.left + pos.col * spacing.colWidth,
      y: spacing.top + pos.row * spacing.rowHeight,
    });
  }
  return positions;
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
