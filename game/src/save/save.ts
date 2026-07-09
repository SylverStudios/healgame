/**
 * Single local save slot (poc-spec §8). Everything that matters persists:
 * currencies, XP, tree, subclass, dungeon unlocks, tutorial flags.
 * Restart = wipe save and begin a new game.
 */

export type SubclassId = 'vigil' | 'zealot';

export interface SaveData {
  version: 1;
  tutorialDone: boolean;
  gold: number;
  xp: number;
  rubies: number;
  /** Spell ids the player has unlocked (e.g. 'solemn-mend', 'zealous-mending'). */
  unlockedSpells: string[];
  /** Purchased spell-tree node ids. */
  treeNodes: string[];
  /** Chosen subclass; null until the ruby is spent. No respec. */
  subclass: SubclassId | null;
  /** Dungeon ids cleared at least once (first clear pays the ruby). */
  clearedDungeons: string[];
}

export function newSaveData(): SaveData {
  return {
    version: 1,
    tutorialDone: false,
    gold: 0,
    xp: 0,
    rubies: 0,
    unlockedSpells: [],
    treeNodes: [],
    subclass: null,
    clearedDungeons: [],
  };
}

const SAVE_KEY = 'healgame-save-v1';

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
    if (!isSaveData(parsed)) return newSaveData();
    return parsed;
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

function isSaveData(value: unknown): value is SaveData {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    typeof v.tutorialDone === 'boolean' &&
    typeof v.gold === 'number' &&
    typeof v.xp === 'number' &&
    typeof v.rubies === 'number' &&
    Array.isArray(v.unlockedSpells) &&
    Array.isArray(v.treeNodes) &&
    (v.subclass === null || v.subclass === 'vigil' || v.subclass === 'zealot') &&
    Array.isArray(v.clearedDungeons)
  );
}
