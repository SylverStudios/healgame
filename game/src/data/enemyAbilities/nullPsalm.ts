import type { EnemyAbilityDef } from '../content/types';

/**
 * Gloam Sanctum boss mechanic: Soul Toll with an earlier first cast and tighter
 * cadence. Full Patient / Fervent crown kits clear; shallow crown (Vowstrike +
 * Wrath + Crown without path depth) that still clears Black Choir wipes here.
 */
export const NULL_PSALM = {
  id: 'null-psalm',
  name: 'Null Psalm',
  kind: 'manaSiphon',
  castMs: 4_000,
  firstCastAtMs: 3_500,
  intervalMs: 11_000,
  partyDamage: 4,
  manaBurn: 10,
  visualKey: 'null-psalm',
  telegraph: 'pulse',
} as const satisfies EnemyAbilityDef;
