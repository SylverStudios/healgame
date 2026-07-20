// Shared UI theme: single source of truth for fonts and palette hexes.
// Scenes and widgets import from here instead of redeclaring local consts.
// Palette is the soot/ember/iron/bone set from art/STYLE.md and
// docs/ui-theme-research.md §Scope note.

/**
 * Primary UI font family: the bundled "HealgameIron" pixel font (8px-native
 * glyphs, weathered-iron dark-fantasy design; see artifacts/pixellab-2/).
 * `monospace` is the fallback while the @font-face load is in flight or if
 * it fails — {@link fontsReady} below is awaited (with a timeout) by
 * BootScene before the first text-rendering scene starts, so the fallback
 * should rarely be visible.
 */
export const FONT = 'HealgameIron, monospace';

/** Debug/diagnostic font (combat log). Intentionally stays monospace. */
export const DEBUG_FONT = 'monospace';

/** Never let a font hiccup block boot — BootScene awaits {@link fontsReady}
 *  for at most this long before starting the first text-rendering scene. */
const FONT_LOAD_TIMEOUT_MS = 2000;

function timeoutAfter(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Kicks off loading the bundled HealgameIron pixel font (both weights —
 * buttons use `fontStyle: 'bold'`) via the native FontFace/document.fonts API
 * the moment this module is evaluated — i.e. as early as the JS module graph
 * links, well before `BootScene.preload()` starts fetching sprite/audio
 * assets, so the two loads run in parallel instead of serially.
 *
 * Canvas 2D text (what every Phaser GameObjects.Text ultimately draws
 * through) does NOT respect CSS `font-display` — a `fillText()` call with an
 * unloaded custom font silently falls back and never repaints once the font
 * arrives. So this promise must be awaited before the first scene that
 * creates Text runs (`BootScene.create()` awaits it before `scene.start()`).
 * Races a safety timeout: if the font never resolves (missing file,
 * unsupported browser), boot proceeds anyway with the CSS fallback baked
 * into the FONT constant above.
 *
 * Guarded for non-browser environments (`document` is undefined under
 * vitest's default node environment) so importing this module in tests is
 * side-effect-free.
 */
export const fontsReady: Promise<void> =
  typeof document !== 'undefined' && 'fonts' in document
    ? Promise.race([
        Promise.all([
          document.fonts.load('16px HealgameIron'),
          document.fonts.load('bold 16px HealgameIron'),
        ]).then(() => undefined),
        timeoutAfter(FONT_LOAD_TIMEOUT_MS),
      ])
    : Promise.resolve();

/**
 * Font sizes for the 16px-native pixel font. SM (16px) is 1:1 native and LG
 * (32px) is a clean 2×; MD (24px) is 1.5× — slightly uneven pixels, visually
 * fine. XS is a 12px downscale for the tight HUD spots (HP numbers, spell
 * cost rows) whose layout budgets ~10px lines — softer than native but
 * legible, unlike a strict 8px half-scale. Prefer these over ad hoc px
 * strings; deviate only where a snap would break layout (documented inline
 * at the call site).
 */
export const FONT_SIZE_XS = '12px';
export const FONT_SIZE_SM = '16px';
export const FONT_SIZE_MD = '24px';
export const FONT_SIZE_LG = '32px';

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
