/**
 * Cards-mode chip draft offers (spell-cards-poc-handoff §7.3 + Wave 7a).
 *
 * Fixed authored sets — no RNG. Next slot = ownedChipIds.length.
 * Slot 2 requires player level ≥ SLOT_2_MIN_LEVEL (J24).
 * Heal slot 2 offers depend on chip1 (J25b).
 */

import { chipOffersForSlot, healSlot2Offers } from './chips';
import { CARD_SLOTS, SLOT_2_MIN_LEVEL } from './unlocks';

/**
 * Whether the player may draft / purchase the given chip slot at `level`.
 * Slot 0 always; slot 1 (second chip) requires level ≥ SLOT_2_MIN_LEVEL.
 */
export function canOfferSlot(slotIndex: number, level: number): boolean {
  if (slotIndex === 0) return true;
  if (slotIndex === 1) return level >= SLOT_2_MIN_LEVEL;
  return false;
}

/**
 * Three chip ids for the next empty slot on this spell card, or null when
 * all `CARD_SLOTS` are filled or the next slot is level-gated shut.
 */
export function offersForNextSlot(
  spellId: string,
  ownedChipIds: readonly string[],
  level: number,
): readonly [string, string, string] | null {
  if (ownedChipIds.length >= CARD_SLOTS) return null;
  const slotIndex = ownedChipIds.length as 0 | 1;
  if (!canOfferSlot(slotIndex, level)) return null;
  if (spellId === 'heal' && slotIndex === 1) {
    return healSlot2Offers(ownedChipIds[0]);
  }
  return chipOffersForSlot(spellId, slotIndex);
}
