import type { EnemyAbilityDef } from '../content/types';

/**
 * Gloam Sanctum trash teach — lesser Null Psalm. Same manaSiphon verb as the
 * Veil Cantor's greater (nullPsalm.ts): a party spike plus healer mana burn at
 * half strength on a longer, readable cast, drilling mana discipline under the
 * psalm before the cantor's full drain.
 *
 * v1 enemy mechanics chunk E5: retuned from the E4 stub. Gloam's full crown
 * kits clear at exactly the ≥2-survivor line and every mana-starved kit sits
 * just below it, so the trash psalm must teach without tipping the clear. The
 * burn/spike are cut toward the floor and the first cast is delayed with a long
 * interval (later + rarer than the Black Choir toll, matching Gloam's denser
 * packs) so roughly one gentle psalm lands per pack. Full crown kits clear;
 * shallow crown / mid-tree / efficiency still wipe; the Veil Cantor's greater
 * is the real drain.
 */
export const NULL_PSALM_LESSER = {
  id: 'null-psalm-lesser',
  name: 'Lesser Null Psalm',
  kind: 'manaSiphon',
  castMs: 6_000,
  firstCastAtMs: 6_000,
  intervalMs: 20_000,
  partyDamage: 1,
  manaBurn: 2,
  visualKey: 'null-psalm',
  telegraph: 'pulse',
} as const satisfies EnemyAbilityDef;
