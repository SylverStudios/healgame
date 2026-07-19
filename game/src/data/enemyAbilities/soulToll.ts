import type { EnemyAbilityDef } from '../content/types';

/**
 * Black Choir boss mechanic: party spike plus healer mana burn.
 * Tuned so maxed crown kits clear with disciplined healing; mid-tree
 * (oath path without Vowstrike/crown) should wipe — a real tree-depth check.
 */
export const SOUL_TOLL = {
  id: 'soul-toll',
  name: 'Soul Toll',
  kind: 'manaSiphon',
  castMs: 4_000,
  firstCastAtMs: 4_000,
  intervalMs: 12_000,
  partyDamage: 4,
  manaBurn: 10,
  visualKey: 'soul-toll',
  // v0.3 chunk F: a tolling bell reads as rhythmic thumps.
  telegraph: 'pulse',
} as const satisfies EnemyAbilityDef;
