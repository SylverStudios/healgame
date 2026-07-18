import type { DungeonDef } from '../content/types';

/**
 * Dungeon 5 — first fight that wants the Alpha 0.2 crown kit. Maxed crown
 * builds clear under Soul Toll mana pressure; oath-path kits without
 * Vowstrike/crown wipe. Extinction-scale impossibility stays on The Maw.
 */
export const BLACK_CHOIR_DUNGEON = {
  id: 'black-choir',
  name: 'Black Choir',
  order: 5,
  unlock: { kind: 'dungeonClear', dungeonId: 'verdant-rift' },
  rewards: {
    xpPerEnemy: 3,
  },
  visualKey: 'black-choir',
  waves: [
    { enemies: [{ mobId: 'choir-shade', count: 2 }] },
    { enemies: [{ mobId: 'choir-shade', count: 3 }] },
    { enemies: [{ mobId: 'choir-shade', count: 3, statOverrides: { hp: 14 } }] },
    { enemies: [{ mobId: 'dirge-sovereign', count: 1, statOverrides: { hp: 225 } }] },
  ],
} as const satisfies DungeonDef;
