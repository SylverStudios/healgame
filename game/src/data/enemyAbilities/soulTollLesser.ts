import type { EnemyAbilityDef } from '../content/types';

/**
 * Black Choir trash teach — lesser Soul Toll. Same manaSiphon verb as the Dirge
 * Sovereign's greater (soulToll.ts): a party spike plus healer mana burn, both
 * at half strength and on a longer, readable cast, so the pack teaches "watch
 * your mana under the toll" before the sovereign's full drain.
 *
 * v1 enemy mechanics chunk E4: stub magnitude (~50% intensity); E5 retunes.
 */
export const SOUL_TOLL_LESSER = {
  id: 'soul-toll-lesser',
  name: 'Lesser Soul Toll',
  kind: 'manaSiphon',
  castMs: 6_000,
  firstCastAtMs: 3_000,
  intervalMs: 12_000,
  partyDamage: 2,
  manaBurn: 5,
  visualKey: 'soul-toll',
  telegraph: 'pulse',
} as const satisfies EnemyAbilityDef;
