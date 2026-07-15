import { describe, expect, it } from 'vitest';
import { glyphChar } from './glyph';

describe('glyphChar', () => {
  it('returns the glyph field when present and non-empty', () => {
    expect(glyphChar({ glyph: 'W', name: 'Wrath Ascendant', id: 'wrath-ascendant' })).toBe('W');
  });

  it('returns only the first character of glyph', () => {
    expect(glyphChar({ glyph: 'WA', name: 'Wrath Ascendant' })).toBe('W');
  });

  it('falls back to first letter of name uppercased when glyph is absent', () => {
    expect(glyphChar({ name: 'solemn mend', id: 'solemn-mend' })).toBe('S');
  });

  it('falls back to first letter of id uppercased when no glyph and no name', () => {
    expect(glyphChar({ id: 'wrath-ascendant' })).toBe('W');
  });

  it('returns "?" when source has no usable fields', () => {
    expect(glyphChar({})).toBe('?');
  });

  it('treats empty glyph string as absent', () => {
    expect(glyphChar({ glyph: '', name: 'Mend' })).toBe('M');
  });

  it('treats whitespace-only glyph as absent', () => {
    expect(glyphChar({ glyph: '   ', name: 'Mend' })).toBe('M');
  });

  it('handles lowercase glyph by returning it as-is (first char)', () => {
    expect(glyphChar({ glyph: 'm' })).toBe('m');
  });

  it('name fallback uppercases lowercase first letter', () => {
    expect(glyphChar({ name: 'frenzied liturgy' })).toBe('F');
  });
});
