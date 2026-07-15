import type { DungeonDef } from '../content/types';

/**
 * Dungeon 4 — soft gate after Cinder Vault. Maxed current tree kits wipe to
 * Soul Toll mana pressure; Extinction-scale impossibility stays on The Maw.
 */
export const BLACK_CHOIR_DUNGEON = {
  id: 'black-choir',
  name: 'Black Choir',
  order: 4,
  unlock: { kind: 'dungeonClear', dungeonId: 'cinder-vault' },
  rewards: {
    xpPerEnemy: 1,
  },
  visualKey: 'black-choir',
  waves: [
    { enemies: [{ mobId: 'choir-shade', count: 2 }] },
    { enemies: [{ mobId: 'choir-shade', count: 3 }] },
    { enemies: [{ mobId: 'choir-shade', count: 3, statOverrides: { hp: 12 } }] },
    { enemies: [{ mobId: 'dirge-sovereign', count: 1 }] },
  ],
} as const satisfies DungeonDef;
