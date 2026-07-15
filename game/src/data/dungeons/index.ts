import { ASH_GATE_DUNGEON } from './ashGate';
import { BLACK_CHOIR_DUNGEON } from './blackChoir';
import { CINDER_VAULT_DUNGEON } from './cinderVault';
import { IRON_PASS_DUNGEON } from './ironPass';
import { THE_MAW_DUNGEON } from './theMaw';
import { VERDANT_RIFT_DUNGEON } from './verdantRift';
import type { DungeonDef } from '../content/types';

export { ASH_GATE_DUNGEON } from './ashGate';
export { BLACK_CHOIR_DUNGEON } from './blackChoir';
export { CINDER_VAULT_DUNGEON } from './cinderVault';
export { IRON_PASS_DUNGEON } from './ironPass';
export { THE_MAW_DUNGEON } from './theMaw';
export { VERDANT_RIFT_DUNGEON } from './verdantRift';
export { hubDungeonTargetName } from './hubTarget';

export const DUNGEON_ORDER = [
  'ash-gate',
  'iron-pass',
  'cinder-vault',
  'verdant-rift',
  'black-choir',
  'the-maw',
] as const;

export const DUNGEONS = [
  ASH_GATE_DUNGEON,
  IRON_PASS_DUNGEON,
  CINDER_VAULT_DUNGEON,
  VERDANT_RIFT_DUNGEON,
  BLACK_CHOIR_DUNGEON,
  THE_MAW_DUNGEON,
] as const satisfies readonly DungeonDef[];

export const DUNGEON_REGISTRY: Readonly<Record<string, DungeonDef>> = Object.freeze(
  Object.fromEntries(DUNGEONS.map((dungeon) => [dungeon.id, dungeon])),
);

/** Stable-id lookup. Unknown or retired ids intentionally return undefined. */
export function getDungeonById(id: string): DungeonDef | undefined {
  return Object.prototype.hasOwnProperty.call(DUNGEON_REGISTRY, id) ? DUNGEON_REGISTRY[id] : undefined;
}

/** Dungeons in explicit progression order, independent of module declaration order. */
export const ORDERED_DUNGEONS: readonly DungeonDef[] = Object.freeze(
  DUNGEON_ORDER.map((id) => {
    const dungeon = getDungeonById(id);
    if (dungeon === undefined) {
      throw new Error(`Dungeon order references unknown dungeon "${id}"`);
    }
    return dungeon;
  }),
);

/**
 * Pure unlock check over stable cleared dungeon ids. Unknown dungeon ids are
 * not unlocked; callers can use getDungeonById when they need to distinguish
 * unknown content from a known-but-locked dungeon.
 */
export function isDungeonIdUnlocked(id: string, clearedDungeonIds: readonly string[]): boolean {
  const dungeon = getDungeonById(id);
  if (dungeon === undefined) return false;

  switch (dungeon.unlock.kind) {
    case 'always':
      return true;
    case 'dungeonClear':
      return clearedDungeonIds.includes(dungeon.unlock.dungeonId);
  }
}
