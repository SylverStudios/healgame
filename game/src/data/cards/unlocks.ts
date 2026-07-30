/**
 * Cards-mode free unlock table (spell-cards-poc-handoff §3 / §7.1).
 *
 * Unlocks are free — they never spend upgrade points. +1 upgrade point per
 * level is handled separately by `applyCardsLevelUps`.
 */

export const CARD_SLOTS = 2;

export interface CardUnlock {
  id: string;
  kind: 'spell' | 'cooldown';
  minLevel: number;
}

/** Authoritative free unlocks — encode handoff §3 exactly. */
export const CARD_UNLOCKS: readonly CardUnlock[] = [
  { id: 'heal', kind: 'spell', minLevel: 1 },
  { id: 'bonk', kind: 'spell', minLevel: 1 },
  { id: 'mend', kind: 'spell', minLevel: 2 },
  { id: 'vowstrike', kind: 'spell', minLevel: 5 },
  { id: 'still-waters', kind: 'cooldown', minLevel: 6 },
  { id: 'wrath-ascendant', kind: 'cooldown', minLevel: 7 },
  { id: 'frenzied-liturgy', kind: 'cooldown', minLevel: 8 },
];

/** All unlocks with minLevel ≤ level (cumulative library at that level). */
export function unlocksAtOrBelowLevel(level: number): CardUnlock[] {
  const safe = Math.max(0, Math.floor(level));
  return CARD_UNLOCKS.filter((u) => u.minLevel <= safe);
}

/** Spell ids owned when the player is at `level` (cumulative). */
export function spellIdsAtLevel(level: number): string[] {
  return unlocksAtOrBelowLevel(level)
    .filter((u) => u.kind === 'spell')
    .map((u) => u.id);
}

/** Cooldown ids owned when the player is at `level` (cumulative). */
export function cooldownIdsAtLevel(level: number): string[] {
  return unlocksAtOrBelowLevel(level)
    .filter((u) => u.kind === 'cooldown')
    .map((u) => u.id);
}
