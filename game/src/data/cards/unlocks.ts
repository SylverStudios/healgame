/**
 * Cards-mode free unlock table (spell-cards-poc-handoff §3 / §7.1).
 *
 * Unlocks are free — they never spend upgrade points. J26: upgrade points are
 * granted by dungeon victories (`applyCombatResult`), not by level.
 *
 * M5: Major cooldowns are no longer auto-granted from this table. They are
 * chosen by the player at L6 (Set A) and L8 (Set B) via the Hub CD picker.
 * `chosenCooldownIds` on the save is the authoritative source.
 */

export const CARD_SLOTS = 2;

/** J24: second chip slot unlocks at this player level. */
export const SLOT_2_MIN_LEVEL = 5;

export interface CardUnlock {
  id: string;
  kind: 'spell' | 'cooldown';
  minLevel: number;
}

/** Authoritative free unlocks — spells only. CDs are chosen via Hub picker (M5). */
export const CARD_UNLOCKS: readonly CardUnlock[] = [
  { id: 'heal', kind: 'spell', minLevel: 1 },
  { id: 'bonk', kind: 'spell', minLevel: 1 },
  { id: 'mend', kind: 'spell', minLevel: 2 },
  { id: 'vowstrike', kind: 'spell', minLevel: 5 },
];

/**
 * Hub level-up ribbon copy for cards mode. J26: level-ups grant party HP +
 * free unlocks (no upgrade points); the "unlucky/lucky" tags are now pure
 * flavor and never imply a point grant.
 * M5: L6/L8 also prompt a CD choice (Hub will interrupt with the picker).
 */
export function cardsLevelUpWelcome(level: number): string {
  if (level === 6) return 'Welcome to level 6 — choose a major cooldown';
  if (level === 4) return 'Welcome to unlucky level 4';
  if (level === 8) return 'Welcome to lucky level 8 — choose your second cooldown';
  return `Welcome to level ${level}`;
}

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

/**
 * @deprecated M5: cooldowns are no longer auto-granted by level; they are
 * chosen by the player via the Hub CD picker. Always returns `[]`.
 * Use `save.chosenCooldownIds` (validated via `cooldownById`) instead.
 */
export function cooldownIdsAtLevel(_level: number): string[] {
  return [];
}
