/**
 * M5 cooldown-choice helpers (pure, no Phaser).
 *
 * Cards mode grants two major CD picks:
 *   - Level 6 → choose one from Set A (still-waters, wrath-ascendant, frenzied-liturgy)
 *   - Level 8 → choose one from Set B (iron-canticle, mercy-reserve, ashen-rite)
 *
 * `chosenCooldownIds` on the save is the persistent record.
 */

import { levelForXp } from '../constants';
import { cooldownById, COOLDOWN_SET_A_IDS, COOLDOWN_SET_B_IDS } from '../cooldowns';

/**
 * Returns which CD set the player should pick next, or null when no pick is
 * pending.
 *
 *   'A'  — level ≥ 6 and zero CDs chosen
 *   'B'  — level ≥ 8 and exactly 1 Set-A CD chosen
 *   null — no pending pick
 */
export function pendingCooldownSet(save: {
  xp: number;
  chosenCooldownIds: readonly string[];
}): 'A' | 'B' | null {
  const level = levelForXp(save.xp);
  const chosen = save.chosenCooldownIds;

  if (level >= 6 && chosen.length === 0) return 'A';

  if (
    level >= 8 &&
    chosen.length === 1 &&
    chosen[0] !== undefined &&
    (COOLDOWN_SET_A_IDS as readonly string[]).includes(chosen[0])
  ) {
    return 'B';
  }

  return null;
}

/**
 * Validates `id` against the pending set, then pushes it into
 * `save.chosenCooldownIds`. Returns false (no mutation) when the id is
 * invalid, already picked, or there is no pending set.
 */
export function applyCooldownChoice(
  save: {
    xp: number;
    chosenCooldownIds: string[];
  },
  id: string,
): boolean {
  const pending = pendingCooldownSet(save);
  if (!pending) return false;

  if (!cooldownById(id)) return false;

  const validIds: readonly string[] =
    pending === 'A' ? COOLDOWN_SET_A_IDS : COOLDOWN_SET_B_IDS;
  if (!validIds.includes(id)) return false;

  save.chosenCooldownIds.push(id);
  return true;
}
