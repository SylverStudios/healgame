import type { EnemyAbilityDef } from '../content/types';

/**
 * Cinder Vault trash teach — lesser Emberfall. Same partyDoT burn verb as the
 * Ember Colossus's greater (emberfall.ts): a longer wind-up into a shorter DoT
 * window (half the ticks) so the pack drills "keep a heal-over-time rolling
 * through the burn" before the boss lays down the full-length scorch.
 *
 * v1 enemy mechanics chunk E5: retuned from the E4 stub. With 2–4 wraiths
 * laying burns at once the overlapping DoT ticks wiped the efficiency crown in
 * the boss phase (throughput death-spiral, not mana), so the burn is cut to a
 * single tick and the cadence spaced out. The long readable cast still teaches
 * "keep a heal-over-time rolling"; concurrency across the pack supplies the
 * threat. The Ember Colossus greater remains the full-length scorch.
 */
export const EMBERFALL_LESSER = {
  id: 'emberfall-lesser',
  name: 'Lesser Emberfall',
  kind: 'partyDoT',
  castMs: 7_000,
  firstCastAtMs: 5_000,
  intervalMs: 16_000,
  durationMs: 500,
  tickMs: 500,
  damagePerTick: 1,
  visualKey: 'emberfall',
  telegraph: 'glow',
} as const satisfies EnemyAbilityDef;
