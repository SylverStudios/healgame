import type { DungeonDef } from '../content/types';

/**
 * Dungeon 5 — soft gate after Verdant Rift. Maxed current tree kits wipe to
 * Soul Toll mana pressure; Extinction-scale impossibility stays on The Maw.
 */
export const BLACK_CHOIR_DUNGEON = {
  id: 'black-choir',
  name: 'Black Choir',
  order: 5,
  unlock: { kind: 'dungeonClear', dungeonId: 'verdant-rift' },
  rewards: {
    xpPerEnemy: 1,
  },
  visualKey: 'black-choir',
  waves: [
    { enemies: [{ mobId: 'choir-shade', count: 2 }] },
    { enemies: [{ mobId: 'choir-shade', count: 3 }] },
    { enemies: [{ mobId: 'choir-shade', count: 3, statOverrides: { hp: 12 } }] },
    { enemies: [{ mobId: 'dirge-sovereign', count: 1, statOverrides: { hp: 200 } }] },
  ],
} as const satisfies DungeonDef;
