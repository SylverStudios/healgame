import type { DungeonDef } from '../content/types';

/** Dungeon 3 — hard but clearable with a maxed current kit (Emberfall DoT). */
export const CINDER_VAULT_DUNGEON = {
  id: 'cinder-vault',
  name: 'Cinder Vault',
  order: 3,
  unlock: { kind: 'dungeonClear', dungeonId: 'iron-pass' },
  rewards: {
    xpPerEnemy: 1,
  },
  visualKey: 'cinder-vault',
  waves: [
    { enemies: [{ mobId: 'cinder-wraith', count: 2 }] },
    { enemies: [{ mobId: 'cinder-wraith', count: 3 }] },
    { enemies: [{ mobId: 'cinder-wraith', count: 3, statOverrides: { hp: 14 } }] },
    { enemies: [{ mobId: 'cinder-wraith', count: 4, statOverrides: { hp: 14 } }] },
    { enemies: [{ mobId: 'ember-colossus', count: 1 }] },
  ],
} as const satisfies DungeonDef;
