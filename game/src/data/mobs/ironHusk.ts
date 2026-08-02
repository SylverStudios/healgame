import type { MobDef } from '../content/types';

export const IRON_HUSK = {
  id: 'iron-husk',
  name: 'Iron Husk',
  tags: ['trash'],
  hp: 13,
  // E5: base auto trimmed 2 -> 1 (floor +2 at order 2 = 3 total). The E4 trash
  // casts drained the efficiency crown's mana in the trash phase so it could no
  // longer scrape the Spire Lancer boss; the lighter husk swing restores the
  // "efficiency scrapes, crown clears clean" boss-entry economy.
  autoDamage: 1,
  swingIntervalMs: 3_000,
  abilityIds: ['tunnel-vision-lesser'],
  visualKey: 'iron-husk',
} as const satisfies MobDef;
