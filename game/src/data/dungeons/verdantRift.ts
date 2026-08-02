import type { DungeonDef } from '../content/types';

/**
 * Dungeon 4 — proof add via catalog + balance harness. Harder than Iron
 * Pass, still clearable with maxed current kits; unlocks Black Choir.
 */
export const VERDANT_RIFT_DUNGEON = {
  id: 'verdant-rift',
  name: 'Verdant Rift',
  order: 4,
  unlock: { kind: 'dungeonClear', dungeonId: 'iron-pass' },
  rewards: {
    xpPerEnemy: 2,
  },
  visualKey: 'verdant-rift',
  /** Headless playtest curve — regenerate via `npm run content -- playtest`. */
  playtestLevelRange: { god: 5, basic: 6 },
  waves: [
    { enemies: [{ mobId: 'thorn-husk', count: 2 }] },
    { enemies: [{ mobId: 'thorn-husk', count: 3 }] },
    { enemies: [{ mobId: 'thorn-husk', count: 3, statOverrides: { hp: 14 } }] },
    { enemies: [{ mobId: 'thorn-husk', count: 3, statOverrides: { hp: 14 } }] },
    { enemies: [{ mobId: 'thorn-matriarch', count: 1 }] },
  ],
} as const satisfies DungeonDef;
