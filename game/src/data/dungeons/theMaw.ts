import type { DungeonDef } from '../content/types';

export const THE_MAW_DUNGEON = {
  id: 'the-maw',
  name: 'The Maw',
  order: 2,
  unlock: { kind: 'dungeonClear', dungeonId: 'ash-gate' },
  rewards: {
    goldPerEnemy: 1,
    xpPerEnemy: 1,
    rubyPerFirstClear: 1,
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
