/**
 * Cards-mode chip draft offers (spell-cards-poc-handoff §7.3).
 *
 * Fixed authored sets — no RNG. Next slot = ownedChipIds.length.
 */

import { chipOffersForSlot } from './chips';
import { CARD_SLOTS } from './unlocks';

/**
 * Three chip ids for the next empty slot on this spell card, or null when
 * all `CARD_SLOTS` are filled.
 */
export function offersForNextSlot(
  spellId: string,
  ownedChipIds: readonly string[],
): readonly [string, string, string] | null {
  if (ownedChipIds.length >= CARD_SLOTS) return null;
  const slotIndex = ownedChipIds.length as 0 | 1;
  return chipOffersForSlot(spellId, slotIndex);
}
