import type { DungeonDef } from '../content/types';

export const THE_MAW_DUNGEON = {
  id: 'the-maw',
  name: 'The Maw',
  order: 6,
  unlock: { kind: 'dungeonClear', dungeonId: 'black-choir' },
  rewards: {
    xpPerEnemy: 1,
  },
  visualKey: 'the-maw',
  waves: [
    {
      enemies: [
        {
          mobId: 'ash-husk',
          count: 2,
          statOverrides: { hp: 4 },
        },
      ],
    },
    { enemies: [{ mobId: 'hollow-king', count: 1 }] },
  ],
} as const satisfies DungeonDef;
