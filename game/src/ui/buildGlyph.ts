/**
 * v0.3 lattice: draws a `BuildGlyph` (pure grid-segment descriptor from
 * `tree/glyph.ts`) as a small silhouette of bright strokes. Consumer of the
 * tree's pinned contract only — no graph logic here, just presentation.
 * See docs/v0.3-handoff.md → "Build glyph".
 *
 * Used by TreeScene (small corner preview, chunk D) and, later, the run
 * summary panel (chunk E) — same renderer, different `opts.x/y/cell`.
 */

import Phaser from 'phaser';
import type { BuildGlyph } from '../tree';

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Pure: shift a set of segments (in arbitrary grid units) so their bounding
 * box is centered on (0, 0). Extracted from `drawBuildGlyph` so the
 * normalization math is testable without Phaser. Empty input returns empty
 * output (nothing to center).
 */
export function normalizeGlyphSegments(segments: readonly Segment[]): Segment[] {
  if (segments.length === 0) return [];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const seg of segments) {
    minX = Math.min(minX, seg.x1, seg.x2);
    maxX = Math.max(maxX, seg.x1, seg.x2);
    minY = Math.min(minY, seg.y1, seg.y2);
    maxY = Math.max(maxY, seg.y1, seg.y2);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return segments.map((seg) => ({
    x1: seg.x1 - cx,
    y1: seg.y1 - cy,
    x2: seg.x2 - cx,
    y2: seg.y2 - cy,
  }));
}

export interface DrawBuildGlyphOptions {
  x: number;
  y: number;
  /** Pixel size of one grid unit (segment coordinates are in grid col/row units). */
  cell: number;
  color?: number;
  alpha?: number;
}

const DEFAULT_COLOR = 0xf2c14e;
const DEFAULT_ALPHA = 1;

/** Draws glyph segments as bright strokes; returns the container so callers can position/scale. */
export function drawBuildGlyph(
  scene: Phaser.Scene,
  glyph: BuildGlyph,
  opts: DrawBuildGlyphOptions,
): Phaser.GameObjects.Container {
  const container = scene.add.container(opts.x, opts.y);
  const color = opts.color ?? DEFAULT_COLOR;
  const alpha = opts.alpha ?? DEFAULT_ALPHA;
  const lineWidth = Math.max(2, Math.round(opts.cell * 0.22));

  const normalized = normalizeGlyphSegments(glyph.segments);
  if (normalized.length === 0) return container;

  const graphics = scene.add.graphics();
  graphics.lineStyle(lineWidth, color, alpha);
  for (const seg of normalized) {
    graphics.lineBetween(seg.x1 * opts.cell, seg.y1 * opts.cell, seg.x2 * opts.cell, seg.y2 * opts.cell);
  }
  container.add(graphics);

  return container;
}
