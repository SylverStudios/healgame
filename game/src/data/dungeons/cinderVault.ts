import type { DungeonDef } from '../content/types';

/** Dungeon 2 — hard but clearable with a maxed current kit (Emberfall DoT). */
export const CINDER_VAULT_DUNGEON = {
  id: 'cinder-vault',
  name: 'Cinder Vault',
  order: 2,
  unlock: { kind: 'dungeonClear', dungeonId: 'ash-gate' },
  rewards: {
    xpPerEnemy: 1,
  },
  visualKey: 'cinder-vault',
  /** Headless playtest curve — regenerate via `npm run content -- playtest`. */
  playtestLevelRange: { god: 5, basic: 6 },
  waves: [
    { enemies: [{ mobId: 'cinder-wraith', count: 2 }] },
    { enemies: [{ mobId: 'cinder-wraith', count: 3 }] },
    { enemies: [{ mobId: 'cinder-wraith', count: 3, statOverrides: { hp: 14 } }] },
    { enemies: [{ mobId: 'cinder-wraith', count: 4, statOverrides: { hp: 14 } }] },
    { enemies: [{ mobId: 'ember-colossus', count: 1 }] },
  ],
} as const satisfies DungeonDef;
