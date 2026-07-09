/**
 * Single local save slot (poc-spec §8, phase-2-handoff "Save v2"). Everything
 * that matters persists: currencies, XP, tree ranks, subclass, dungeon
 * unlocks, tutorial flags. Restart = wipe save and begin a new game.
 *
 * v2: `treeNodes: string[]` became `treeRanks: Record<nodeId, ranks>`; the
 * subclass is now set by purchasing a subclass tree node. The storage key
 * intentionally stays 'healgame-save-v1' — loadSave migrates v1 payloads.
 */

export type SubclassId = 'vigil' | 'zealot';

export interface SaveData {
  version: 2;
  tutorialDone: boolean;
  gold: number;
  xp: number;
  rubies: number;
  /** Spell ids the player has unlocked (e.g. 'solemn-mend', 'zealous-mending'). */
  unlockedSpells: string[];
  /** Purchased spell-tree ranks: nodeId → ranks owned (≥1). */
  treeRanks: Record<string, number>;
  /** Chosen subclass; null until a subclass oath node is bought. No respec. */
  subclass: SubclassId | null;
  /** Dungeon ids cleared at least once (first clear pays the ruby). */
  clearedDungeons: string[];
}

/** The v1 shape, kept only so loadSave can migrate old payloads. */
interface SaveDataV1 {
  version: 1;
  tutorialDone: boolean;
  gold: number;
  xp: number;
  rubies: number;
  unlockedSpells: string[];
  treeNodes: string[];
  subclass: SubclassId | null;
  clearedDungeons: string[];
}

export function newSaveData(): SaveData {
  return {
    version: 2,
    tutorialDone: false,
    gold: 0,
    xp: 0,
    rubies: 0,
    unlockedSpells: [],
    treeRanks: {},
    subclass: null,
    clearedDungeons: [],
  };
}

const SAVE_KEY = 'healgame-save-v1';

/** Gold refunded per retired v1 node (they cost 5g and no longer exist). */
const RETIRED_NODE_REFUND_GOLD = 5;
const RETIRED_V1_NODES = ['vigil-deep-focus', 'zealot-battle-fervor'];

/**
 * v1 → v2 (phase-2-handoff rules): 'max-mana-1' becomes deep-reserves rank 1;
 * retired branch nodes refund 5 gold each; an already-chosen subclass maps to
 * owning that subclass oath node at rank 1 with no extra ruby charge.
 */
function migrateV1(v1: SaveDataV1): SaveData {
  const treeRanks: Record<string, number> = {};
  let gold = v1.gold;

  if (v1.treeNodes.includes('max-mana-1')) treeRanks['deep-reserves'] = 1;
  for (const retired of RETIRED_V1_NODES) {
    if (v1.treeNodes.includes(retired)) gold += RETIRED_NODE_REFUND_GOLD;
  }
  if (v1.subclass !== null) treeRanks[`${v1.subclass}-oath`] = 1;

  return {
    version: 2,
    tutorialDone: v1.tutorialDone,
    gold,
    xp: v1.xp,
    rubies: v1.rubies,
    unlockedSpells: [...v1.unlockedSpells],
    treeRanks,
    subclass: v1.subclass,
    clearedDungeons: [...v1.clearedDungeons],
  };
}

/** Minimal storage interface so tests can inject an in-memory store. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStore(): KeyValueStore | null {
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

export function loadSave(store: KeyValueStore | null = defaultStore()): SaveData {
  if (!store) return newSaveData();
  const raw = store.getItem(SAVE_KEY);
  if (!raw) return newSaveData();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isSaveData(parsed)) return parsed;
    if (isSaveDataV1(parsed)) {
      const migrated = migrateV1(parsed);
      saveGame(migrated, store);
      return migrated;
    }
    return newSaveData();
  } catch {
    return newSaveData();
  }
}

export function saveGame(data: SaveData, store: KeyValueStore | null = defaultStore()): void {
  store?.setItem(SAVE_KEY, JSON.stringify(data));
}

/** Restart: wipe the save. Caller starts a new game from newSaveData(). */
export function resetSave(store: KeyValueStore | null = defaultStore()): void {
  store?.removeItem(SAVE_KEY);
}

function hasBaseShape(v: Record<string, unknown>): boolean {
  return (
    typeof v.tutorialDone === 'boolean' &&
    typeof v.gold === 'number' &&
    typeof v.xp === 'number' &&
    typeof v.rubies === 'number' &&
    Array.isArray(v.unlockedSpells) &&
    (v.subclass === null || v.subclass === 'vigil' || v.subclass === 'zealot') &&
    Array.isArray(v.clearedDungeons)
  );
}

function isSaveData(value: unknown): value is SaveData {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.version !== 2 || !hasBaseShape(v)) return false;
  const ranks = v.treeRanks;
  if (typeof ranks !== 'object' || ranks === null || Array.isArray(ranks)) return false;
  return Object.values(ranks).every((r) => typeof r === 'number');
}

function isSaveDataV1(value: unknown): value is SaveDataV1 {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.version === 1 && hasBaseShape(v) && Array.isArray(v.treeNodes);
}
