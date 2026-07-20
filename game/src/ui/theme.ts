// Shared UI theme: single source of truth for fonts and palette hexes.
// Scenes and widgets import from here instead of redeclaring local consts.
// Palette is the soot/ember/iron/bone set from art/STYLE.md and
// docs/ui-theme-research.md §Scope note.

/** Primary UI font family. Swapped to the bundled pixel font by the theming phase. */
export const FONT = 'monospace';

/** Debug/diagnostic font (combat log). Intentionally stays monospace. */
export const DEBUG_FONT = 'monospace';

/** CSS-string palette for Phaser text/DOM styles. */
export const PALETTE = {
  bg: '#1a1210',
  panel: '#241a15',
  panelLight: '#3a2a22',
  borderDark: '#0a0605',
  borderLight: '#8a7868',
  text: '#e8d8c8',
  dim: '#a89888',
  gold: '#f2c14e',
  danger: '#e05a4e',
  mana: '#a8c8f0',
  health: '#7ad67a',
} as const;

export type PaletteKey = keyof typeof PALETTE;

/** Numeric palette for Phaser fill/stroke/tint calls (same hexes as PALETTE). */
export const PALETTE_NUM: Record<PaletteKey, number> = Object.fromEntries(
  (Object.entries(PALETTE) as [PaletteKey, string][]).map(([key, css]) => [
    key,
    parseInt(css.slice(1), 16),
  ]),
) as Record<PaletteKey, number>;
