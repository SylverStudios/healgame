import type { EnemyAbilityDef } from '../content/types';

/**
 * Gloam Sanctum trash teach — lesser Null Psalm. Same manaSiphon verb as the
 * Veil Cantor's greater (nullPsalm.ts): a party spike plus healer mana burn at
 * half strength on a longer, readable cast, drilling mana discipline under the
 * psalm before the cantor's full drain.
 *
 * v1 enemy mechanics chunk E4: stub magnitude (~50% intensity); E5 retunes.
 */
export const NULL_PSALM_LESSER = {
  id: 'null-psalm-lesser',
  name: 'Lesser Null Psalm',
  kind: 'manaSiphon',
  castMs: 6_000,
  firstCastAtMs: 3_000,
  intervalMs: 12_000,
  partyDamage: 2,
  manaBurn: 5,
  visualKey: 'null-psalm',
  telegraph: 'pulse',
} as const satisfies EnemyAbilityDef;
