import type { EnemyAbilityDef } from '../content/types';

/**
 * Black Choir trash teach — lesser Soul Toll. Same manaSiphon verb as the Dirge
 * Sovereign's greater (soulToll.ts): a party spike plus healer mana burn, both
 * at half strength and on a longer, readable cast, so the pack teaches "watch
 * your mana under the toll" before the sovereign's full drain.
 *
 * v1 enemy mechanics chunk E5: retuned from the E4 stub. Black Choir's gates
 * are razor-thin (every crown kit ends the boss near 0 mana), so a few stacked
 * shade tolls dragged the mana-starved shallow crown into an OOM death-spiral it
 * is supposed to survive. Fix is cadence as much as magnitude: the burn/spike
 * are cut toward the floor AND the first cast is delayed with a long interval so
 * roughly one readable toll lands per pack — enough to teach "watch your mana",
 * not enough to tip the clear. Mid-tree kits still wipe; the Dirge Sovereign's
 * greater remains the real drain.
 */
export const SOUL_TOLL_LESSER = {
  id: 'soul-toll-lesser',
  name: 'Lesser Soul Toll',
  kind: 'manaSiphon',
  castMs: 6_000,
  firstCastAtMs: 5_000,
  intervalMs: 18_000,
  partyDamage: 1,
  manaBurn: 2,
  visualKey: 'soul-toll',
  telegraph: 'pulse',
} as const satisfies EnemyAbilityDef;
