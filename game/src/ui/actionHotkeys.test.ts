import { describe, expect, it } from 'vitest';
import {
  ACTION_HOTKEY_LETTERS,
  MAX_ACTION_HOTKEYS,
  actionHotkeyLabel,
  actionHotkeySlot,
} from './actionHotkeys';

describe('actionHotkeys', () => {
  it('maps slots 0–7 to QWER then sQ…sR', () => {
    expect(MAX_ACTION_HOTKEYS).toBe(8);
    expect(ACTION_HOTKEY_LETTERS).toEqual(['Q', 'W', 'E', 'R']);
    expect([...Array(8)].map((_, i) => actionHotkeyLabel(i))).toEqual([
      'Q',
      'W',
      'E',
      'R',
      'sQ',
      'sW',
      'sE',
      'sR',
    ]);
  });

  it('leaves slots beyond 7 unbound', () => {
    expect(actionHotkeyLabel(8)).toBeNull();
    expect(actionHotkeyLabel(-1)).toBeNull();
  });

  it('resolves letter + shift to the shared-pool slot', () => {
    expect(actionHotkeySlot('q', false)).toBe(0);
    expect(actionHotkeySlot('R', false)).toBe(3);
    expect(actionHotkeySlot('q', true)).toBe(4);
    expect(actionHotkeySlot('R', true)).toBe(7);
    expect(actionHotkeySlot('A', false)).toBeNull();
  });
});
