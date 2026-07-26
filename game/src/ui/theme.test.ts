import { describe, expect, it } from 'vitest';
import {
  FONT,
  DEBUG_FONT,
  FONT_SIZE_XS,
  FONT_SIZE_SM,
  FONT_SIZE_MD,
  FONT_SIZE_LG,
  PALETTE,
  PALETTE_NUM,
} from './theme';

describe('theme', () => {
  it('every palette entry is a #rrggbb hex with a matching numeric twin', () => {
    for (const [key, css] of Object.entries(PALETTE)) {
      expect(css).toMatch(/^#[0-9a-f]{6}$/);
      expect(PALETTE_NUM[key as keyof typeof PALETTE]).toBe(parseInt(css.slice(1), 16));
    }
  });

  it('fonts are non-empty family strings', () => {
    expect(FONT.length).toBeGreaterThan(0);
    expect(DEBUG_FONT.length).toBeGreaterThan(0);
  });

  it('primary FONT names the bundled pixel font with a monospace fallback', () => {
    expect(FONT).toContain('HealgameIron');
    expect(FONT).toContain('monospace');
  });

  it('debug font stays plain monospace (not the pixel font)', () => {
    expect(DEBUG_FONT).toBe('monospace');
  });

  it('font sizes are density-snapped px strings, ascending', () => {
    for (const size of [FONT_SIZE_XS, FONT_SIZE_SM, FONT_SIZE_MD, FONT_SIZE_LG]) {
      expect(size).toMatch(/^\d+px$/);
    }
    const nums = [FONT_SIZE_XS, FONT_SIZE_SM, FONT_SIZE_MD, FONT_SIZE_LG].map((s) =>
      parseInt(s, 10),
    );
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
  });
});
