/**
 * Pure fill/bg geometry for `Bar`. Kept Phaser-free so unit tests can pin
 * framed-cast inset math without a DOM (see `bar.test.ts`).
 */

/** Per-edge inset (display px) from the outer Bar box into the fill/bg. */
export interface BarFillInset {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export const ZERO_BAR_FILL_INSET: BarFillInset = {
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
};

/**
 * Fill/bg size and origin offsets inside an outer Bar box. `offsetX` /
 * `offsetY` are added to the outer left-edge / vertical-center origin used
 * by `Bar`. Integers only — callers must pass integer outer size and inset.
 */
export function framedFillSize(
  outerWidth: number,
  outerHeight: number,
  inset: BarFillInset = ZERO_BAR_FILL_INSET,
): { width: number; height: number; offsetX: number; offsetY: number } {
  return {
    width: outerWidth - inset.left - inset.right,
    height: outerHeight - inset.top - inset.bottom,
    offsetX: inset.left,
    // Vertical origin is 0.5; shift so unequal top/bottom still centers the
    // fill in the transparent window.
    offsetY: (inset.top - inset.bottom) / 2,
  };
}
