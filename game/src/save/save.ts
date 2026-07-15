/**
 * Single local save slot. This is a development build: old save keys and
 * unrecognized payloads are discarded instead of migrated.
 *
 * Alpha 0.2 rotates to v6 (tree topology / level-mana era). Prior v5 keys are
 * purged on load — no migration.
 */

export type SubclassId = 'vigil' | 'zealot';

export interface SaveData {
  version: 6;
  tutorialDone: boolean;
  xp: number;
  /** Spell ids granted outside the tree (tutorial and level milestones). */
  unlockedSpells: string[];
  /** Allocated talent points: nodeId → ranks owned (≥1). */
  treeRanks: Record<string, number>;
  subclass: SubclassId | null;
  clearedDungeons: string[];
  combatPaceTenths: number;
  /** Permanent relics selected from first-clear reward offers. */
  relicIds: string[];
  /** Stable three-card offer awaiting a choice; empty when no reward is pending. */
  pendingRelicOffers: string[];
}

export function newSaveData(): SaveData {
  return {
    version: 6,
    tutorialDone: false,
    xp: 0,
    unlockedSpells: [],
    treeRanks: {},
    subclass: null,
    clearedDungeons: [],
    combatPaceTenths: 10,
    relicIds: [],
    pendingRelicOffers: [],
  };
}

export const SAVE_KEY = 'healgame-save-v6';
const LEGACY_SAVE_KEYS = ['healgame-save-v1', 'healgame-save-v5'] as const;

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
  for (const key of LEGACY_SAVE_KEYS) store.removeItem(key);
  const raw = store.getItem(SAVE_KEY);
  if (!raw) return newSaveData();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isSaveData(parsed)) return parsed;
    store.removeItem(SAVE_KEY);
    return newSaveData();
  } catch {
    store.removeItem(SAVE_KEY);
    return newSaveData();
  }
}

export function saveGame(data: SaveData, store: KeyValueStore | null = defaultStore()): void {
  store?.setItem(SAVE_KEY, JSON.stringify(data));
}

/** Restart: wipe the save. Caller starts a new game from newSaveData(). */
export function resetSave(store: KeyValueStore | null = defaultStore()): void {
  store?.removeItem(SAVE_KEY);
  for (const key of LEGACY_SAVE_KEYS) store?.removeItem(key);
}

function hasBaseShape(v: Record<string, unknown>): boolean {
  return (
    typeof v.tutorialDone === 'boolean' &&
    typeof v.xp === 'number' &&
    Array.isArray(v.unlockedSpells) &&
    (v.subclass === null || v.subclass === 'vigil' || v.subclass === 'zealot') &&
    Array.isArray(v.clearedDungeons)
  );
}

function isSaveData(value: unknown): value is SaveData {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.version !== 6 || !hasBaseShape(v)) return false;
  const ranks = v.treeRanks;
  if (typeof ranks !== 'object' || ranks === null || Array.isArray(ranks)) return false;
  if (!Object.values(ranks).every((r) => typeof r === 'number')) return false;
  if (typeof v.combatPaceTenths !== 'number') return false;
  return (
    Array.isArray(v.relicIds) &&
    v.relicIds.every((id) => typeof id === 'string') &&
    Array.isArray(v.pendingRelicOffers) &&
    v.pendingRelicOffers.every((id) => typeof id === 'string')
  );
}
