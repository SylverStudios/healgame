import type { EnemyAbilityDef } from '../content/types';

/**
 * Black Choir boss mechanic: party spike plus healer mana burn.
 * Tuned so current maxed tree kits wipe; future talent points can reopen it.
 */
export const SOUL_TOLL = {
  id: 'soul-toll',
  name: 'Soul Toll',
  kind: 'manaSiphon',
  castMs: 4_000,
  firstCastAtMs: 3_000,
  intervalMs: 9_000,
  partyDamage: 5,
  manaBurn: 10,
  visualKey: 'soul-toll',
} as const satisfies EnemyAbilityDef;
