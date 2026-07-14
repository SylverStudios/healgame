import type { DungeonDef } from '../content/types';

export const ASH_GATE_DUNGEON = {
  id: 'ash-gate',
  name: 'Ash Gate',
  order: 1,
  unlock: { kind: 'always' },
  rewards: {
    xpPerEnemy: 1,
  },
  visualKey: 'ash-gate',
  waves: [
    { enemies: [{ mobId: 'ash-husk', count: 2 }] },
    { enemies: [{ mobId: 'ash-husk', count: 3 }] },
    { enemies: [{ mobId: 'gate-warden', count: 1 }] },
  ],
} as const satisfies DungeonDef;
