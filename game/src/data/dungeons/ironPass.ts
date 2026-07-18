import type { DungeonDef } from '../content/types';

export const IRON_PASS_DUNGEON = {
  id: 'iron-pass',
  name: 'Iron Pass',
  order: 2,
  unlock: { kind: 'dungeonClear', dungeonId: 'ash-gate' },
  rewards: {
    xpPerEnemy: 2,
  },
  visualKey: 'iron-pass',
  waves: [
    { enemies: [{ mobId: 'iron-husk', count: 2 }] },
    { enemies: [{ mobId: 'iron-husk', count: 3 }] },
    { enemies: [{ mobId: 'iron-husk', count: 3, statOverrides: { hp: 14 } }] },
    { enemies: [{ mobId: 'iron-husk', count: 4, statOverrides: { hp: 14 } }] },
    { enemies: [{ mobId: 'spire-lancer', count: 1 }] },
  ],
} as const satisfies DungeonDef;
