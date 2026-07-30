import { describe, expect, it, vi } from 'vitest';
import {
  RETURN_BUTTON_WIDTH,
  RETURN_KEYCAP_LABEL,
  createOnceAction,
  resultReturnKeycapPosition,
} from './resultPanel';

describe('RETURN_KEYCAP_LABEL', () => {
  it('uses the readable Space abbreviation', () => {
    expect(RETURN_KEYCAP_LABEL).toBe('Spc');
  });
});

describe('createOnceAction', () => {
  it('invokes the action only once across repeated calls', () => {
    const action = vi.fn();
    const once = createOnceAction(action);
    once();
    once();
    once();
    expect(action).toHaveBeenCalledTimes(1);
  });
});

describe('resultReturnKeycapPosition', () => {
  it('places the keycap on the left inset of the Return button', () => {
    const pos = resultReturnKeycapPosition(480, 375);
    // inset 6 + half of 22×14 chip → 6 + 11 = 17 from left edge
    expect(pos).toEqual({
      x: 480 - RETURN_BUTTON_WIDTH / 2 + 17,
      y: 375,
    });
  });
});
