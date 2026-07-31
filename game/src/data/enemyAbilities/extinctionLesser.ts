import type { EnemyAbilityDef } from '../content/types';

/**
 * The Maw trash teach — lesser Extinction. Unique lesson (not a reuse of
 * bonehowl-lesser) for the extinction verb of the Hollow King's greater
 * (extinction.ts): a big, long telegraph that resolves into only a low party
 * hit, so the sandbox teaches the "everyone survives the wind-up" read before
 * the boss's true apocalyptic Extinction.
 *
 * v1 enemy mechanics chunk E4: stub magnitude (big telegraph, ~40% damage);
 * E5 retunes (and may bump the Maw husks' survivability so the cast lands).
 */
export const EXTINCTION_LESSER = {
  id: 'extinction-lesser',
  name: 'Lesser Extinction',
  kind: 'partyAoE',
  castMs: 8_000,
  firstCastAtMs: 4_000,
  intervalMs: 12_000,
  partyDamage: 4,
  visualKey: 'extinction',
  telegraph: 'pulse',
} as const satisfies EnemyAbilityDef;
