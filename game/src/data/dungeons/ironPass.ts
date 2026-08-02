import type { DungeonDef } from '../content/types';

export const IRON_PASS_DUNGEON = {
  id: 'iron-pass',
  name: 'Iron Pass',
  order: 3,
  unlock: { kind: 'dungeonClear', dungeonId: 'cinder-vault' },
  rewards: {
    xpPerEnemy: 1,
  },
  visualKey: 'iron-pass',
  /** Headless playtest curve — regenerate via `npm run content -- playtest`. */
  playtestLevelRange: { god: 6, basic: 8 },
  waves: [
    { enemies: [{ mobId: 'iron-husk', count: 2 }] },
    { enemies: [{ mobId: 'iron-husk', count: 3 }] },
    { enemies: [{ mobId: 'iron-husk', count: 3, statOverrides: { hp: 14 } }] },
    { enemies: [{ mobId: 'iron-husk', count: 4, statOverrides: { hp: 14 } }] },
    { enemies: [{ mobId: 'spire-lancer', count: 1 }] },
  ],
} as const satisfies DungeonDef;
