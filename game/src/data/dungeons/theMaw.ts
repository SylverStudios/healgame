import type { DungeonDef } from '../content/types';

export const THE_MAW_DUNGEON = {
  id: 'the-maw',
  name: 'The Maw',
  order: 3,
  unlock: { kind: 'dungeonClear', dungeonId: 'iron-pass' },
  rewards: {
    goldPerEnemy: 1,
    goldEveryKills: 2,
    xpPerEnemy: 1,
    rubyPerFirstClear: 0,
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
