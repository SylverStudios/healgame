/**
 * Layout/timing constants for CombatScene's wipe/victory result overlay
 * (locked: docs/v0.3-handoff.md "Wipe / victory summary") — split out of
 * CombatScene.ts purely to keep that file under the max-lines lint cap; the
 * overlay-building logic itself (showResultOverlay) stays in CombatScene
 * since it reaches into scene-private state (tweens, engine, save, sprites).
 *
 * Short slide-in transition (~0.5-1.0s total) over the dimmed-but-visible
 * party, then outcome + XP + build glyph reveal in sequence, Return last
 * (~1s in, safely inside journey's 2s poll cadence).
 */

export const OVERLAY_DEPTH = 1000;
export const OVERLAY_ALPHA = 0.85;
export const OVERLAY_FADE_MS = 300;

export const PANEL_WIDTH = 420;
export const PANEL_HEIGHT = 260;
export const PANEL_SLIDE_OFFSET = 50;
export const PANEL_SLIDE_DELAY_MS = 120;
export const PANEL_SLIDE_MS = 500;
export const TITLE_DELAY_MS = 520;
export const TITLE_REVEAL_MS = 220;
export const XP_DELAY_MS = 660;
export const XP_REVEAL_MS = 220;
export const GLYPH_DELAY_MS = 780;
export const GLYPH_REVEAL_MS = 240;
export const GLYPH_CELL = 20;
export const GLYPH_COLOR = 0xfff2df;
export const RETURN_DELAY_MS = 940;
export const RETURN_REVEAL_MS = 220;
