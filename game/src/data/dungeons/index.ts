import { ASH_GATE_DUNGEON } from './ashGate';
import { IRON_PASS_DUNGEON } from './ironPass';
import { THE_MAW_DUNGEON } from './theMaw';
import type { DungeonDef } from '../content/types';

export { ASH_GATE_DUNGEON } from './ashGate';
export { IRON_PASS_DUNGEON } from './ironPass';
export { THE_MAW_DUNGEON } from './theMaw';

export const DUNGEON_ORDER = ['ash-gate', 'iron-pass', 'the-maw'] as const;

export const DUNGEONS = [
  ASH_GATE_DUNGEON,
  IRON_PASS_DUNGEON,
  THE_MAW_DUNGEON,
] as const satisfies readonly DungeonDef[];

export const DUNGEON_REGISTRY: Readonly<Record<string, DungeonDef>> = Object.freeze(
  Object.fromEntries(DUNGEONS.map((dungeon) => [dungeon.id, dungeon])),
);
