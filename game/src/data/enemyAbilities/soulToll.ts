import type { EnemyAbilityDef } from '../content/types';

/**
 * Black Choir boss mechanic: party spike plus healer mana burn.
 * Tuned so maxed crown kits clear with disciplined healing; still a mana check.
 */
export const SOUL_TOLL = {
  id: 'soul-toll',
  name: 'Soul Toll',
  kind: 'manaSiphon',
  castMs: 4_000,
  firstCastAtMs: 4_000,
  intervalMs: 12_000,
  partyDamage: 4,
  manaBurn: 7,
  visualKey: 'soul-toll',
} as const satisfies EnemyAbilityDef;
