/**
 * Combat action hotkeys: Q W E R then Shift+Q/W/E/R for slots 0–7
 * (Alpha 0.2 stretch / handoff §D7). Spells and CDs share one pool in
 * display order — same order as the former 1…N digit mapping.
 */

export const ACTION_HOTKEY_LETTERS = ['Q', 'W', 'E', 'R'] as const;
export const MAX_ACTION_HOTKEYS = ACTION_HOTKEY_LETTERS.length * 2; // 8

/** Compact keycap text for slot index, or null when unbound (>7). */
export function actionHotkeyLabel(index: number): string | null {
  if (index < 0 || index >= MAX_ACTION_HOTKEYS) return null;
  const letter = ACTION_HOTKEY_LETTERS[index % ACTION_HOTKEY_LETTERS.length]!;
  return index < ACTION_HOTKEY_LETTERS.length ? letter : `s${letter}`;
}

/**
 * Slot index for a Q/W/E/R keydown given shift state, or null if the letter
 * is not in the action row.
 */
export function actionHotkeySlot(letter: string, shiftKey: boolean): number | null {
  const upper = letter.toUpperCase();
  const i = (ACTION_HOTKEY_LETTERS as readonly string[]).indexOf(upper);
  if (i < 0) return null;
  return shiftKey ? i + ACTION_HOTKEY_LETTERS.length : i;
}
