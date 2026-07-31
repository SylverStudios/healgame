import type { EnemyAbilityDef } from '../content/types';

/**
 * Cinder Vault trash teach — lesser Emberfall. Same partyDoT burn verb as the
 * Ember Colossus's greater (emberfall.ts): a longer wind-up into a shorter DoT
 * window (half the ticks) so the pack drills "keep a heal-over-time rolling
 * through the burn" before the boss lays down the full-length scorch.
 *
 * v1 enemy mechanics chunk E4: stub magnitude (~50% intensity); E5 retunes.
 */
export const EMBERFALL_LESSER = {
  id: 'emberfall-lesser',
  name: 'Lesser Emberfall',
  kind: 'partyDoT',
  castMs: 7_000,
  firstCastAtMs: 4_000,
  intervalMs: 14_000,
  durationMs: 1_500,
  tickMs: 500,
  damagePerTick: 1,
  visualKey: 'emberfall',
  telegraph: 'glow',
} as const satisfies EnemyAbilityDef;
