import { describe, expect, it } from 'vitest';
import { FONT, DEBUG_FONT, PALETTE, PALETTE_NUM } from './theme';

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
});
