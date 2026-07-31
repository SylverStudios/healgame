import type { DungeonDef } from '../content/types';

/**
 * Dungeon 6 — post–Black Choir tree-depth check. Denser trash + earlier Null
 * Psalm than Black Choir. Maxed Patient / Fervent crown kits clear; shallow
 * crown (path ranks skipped) and mid-tree wipe. The Maw stays the extinction
 * sandbox after this clear.
 */
export const GLOAM_SANCTUM_DUNGEON = {
  id: 'gloam-sanctum',
  name: 'Gloam Sanctum',
  order: 6,
  unlock: { kind: 'dungeonClear', dungeonId: 'black-choir' },
  rewards: {
    xpPerEnemy: 2,
  },
  visualKey: 'gloam-sanctum',
  /** Uncleared by basic within Lv20 sweep; god scrapes at cap — leave unmeasured. */
  playtestLevelRange: null,
  waves: [
    { enemies: [{ mobId: 'gloam-wretch', count: 2 }] },
    { enemies: [{ mobId: 'gloam-wretch', count: 2 }] },
    { enemies: [{ mobId: 'gloam-wretch', count: 3, statOverrides: { hp: 16 } }] },
    { enemies: [{ mobId: 'veil-cantor', count: 1, statOverrides: { hp: 200 } }] },
  ],
} as const satisfies DungeonDef;
