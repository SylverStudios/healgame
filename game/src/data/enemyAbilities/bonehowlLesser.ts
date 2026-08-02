import type { EnemyAbilityDef } from '../content/types';

/**
 * Ash Gate trash teach — lesser Bonehowl. Same partyAoE verb as the Gate
 * Warden's greater (bonehowl.ts), scaled to a recoverable chunk: half the
 * party damage, a shorter but still readable cast, and a tighter cadence so the
 * pack drills the "heal through the AoE" reaction before the boss exam.
 *
 * v1 enemy mechanics chunk E4: stub magnitude (~50% intensity); E5 retunes.
 */
export const BONEHOWL_LESSER = {
  id: 'bonehowl-lesser',
  name: 'Lesser Bonehowl',
  kind: 'partyAoE',
  castMs: 6_000,
  firstCastAtMs: 1_500,
  intervalMs: 10_000,
  partyDamage: 2,
  visualKey: 'bonehowl',
  telegraph: 'raise',
} as const satisfies EnemyAbilityDef;
