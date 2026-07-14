import type { DungeonDef } from '../content/types';

export const IRON_PASS_DUNGEON = {
  id: 'iron-pass',
  name: 'Iron Pass',
  order: 2,
  unlock: { kind: 'dungeonClear', dungeonId: 'ash-gate' },
  rewards: {
    goldPerEnemy: 1,
    goldEveryKills: 2,
    xpPerEnemy: 1,
    rubyPerFirstClear: 0,
  },
  visualKey: 'iron-pass',
  waves: [
    { enemies: [{ mobId: 'iron-husk', count: 2 }] },
    { enemies: [{ mobId: 'iron-husk', count: 3 }] },
    { enemies: [{ mobId: 'iron-husk', count: 3, statOverrides: { hp: 10 } }] },
    { enemies: [{ mobId: 'iron-husk', count: 4, statOverrides: { hp: 10 } }] },
    { enemies: [{ mobId: 'spire-lancer', count: 1 }] },
  ],
} as const satisfies DungeonDef;
