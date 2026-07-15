import type { DungeonDef } from '../content/types';

/**
 * Dungeon 4 — proof add via catalog + balance harness. Harder than Cinder
 * Vault, still clearable with maxed current kits; unlocks Black Choir.
 */
export const VERDANT_RIFT_DUNGEON = {
  id: 'verdant-rift',
  name: 'Verdant Rift',
  order: 4,
  unlock: { kind: 'dungeonClear', dungeonId: 'cinder-vault' },
  rewards: {
    xpPerEnemy: 1,
  },
  visualKey: 'verdant-rift',
  waves: [
    { enemies: [{ mobId: 'thorn-husk', count: 2 }] },
    { enemies: [{ mobId: 'thorn-husk', count: 3 }] },
    { enemies: [{ mobId: 'thorn-husk', count: 3, statOverrides: { hp: 12 } }] },
    { enemies: [{ mobId: 'thorn-husk', count: 4, statOverrides: { hp: 12 } }] },
    { enemies: [{ mobId: 'thorn-matriarch', count: 1 }] },
  ],
} as const satisfies DungeonDef;
