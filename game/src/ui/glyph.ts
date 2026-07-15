/**
 * Placeholder glyph resolution for tree nodes and combat spell/CD buttons.
 * Temp art exception (Alpha 0.2 §D8): single character only.
 * Hover tooltips retain full name + numbers — this is visual scaffolding only.
 */

/**
 * Resolve a placeholder glyph character for a button or tree node.
 *
 * Preference order:
 *   1. `source.glyph` if non-empty (trimmed)
 *   2. First letter of `source.name` uppercased
 *   3. First letter of `source.id` uppercased
 *   4. `'?'`
 */
export function glyphChar(source: { glyph?: string; name?: string; id?: string }): string {
  if (source.glyph) {
    const trimmed = source.glyph.trim();
    if (trimmed.length > 0) return trimmed[0]!;
  }
  const label = source.name ?? source.id ?? '';
  if (label.length > 0) return label[0]!.toUpperCase();
  return '?';
}
