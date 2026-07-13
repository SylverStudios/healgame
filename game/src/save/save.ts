/**
 * Single local save slot (poc-spec §8, phase-2-handoff "Save v2"). Everything
 * that matters persists: currencies, XP, tree ranks, subclass, dungeon
 * unlocks, tutorial flags. Restart = wipe save and begin a new game.
 *
 * v2: `treeNodes: string[]` became `treeRanks: Record<nodeId, ranks>`; the
 * subclass is now set by purchasing a subclass tree node. The storage key
 * intentionally stays 'healgame-save-v1' — loadSave migrates v1 payloads.
 *
 * v3: `combatPaceTenths` — selected combat pace multiplier (10 = 1×, 15 = 1.5×).
 *
 * v4 (alpha-0.1-handoff §D7): `relicId` — the player's one locked-in relic
 * pick (`data/relics.ts`), chosen once via `RelicScene` after the first-ever
 * Ash Gate clear and never offered again; `relicPickPending` — transient flag
 * set by `applyCombatResult` on that first clear, cleared the instant the
 * pick is made. Restart wipes both (fresh save = null/false).
 */

export type SubclassId = 'vigil' | 'zealot';

export interface SaveData {
  version: 4;
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
  /** Selected combat pace multiplier in tenths (10 = 1×, 15 = 1.5×). */
  combatPaceTenths: number;
  /** Chosen relic id (data/relics.ts), or null before the pick / after a restart. */
  relicId: string | null;
  /** True right after the first-ever Ash Gate clear until RelicScene resolves the pick. */
  relicPickPending: boolean;
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

/** v2 shape — migrated to v3 on load. */
interface SaveDataV2 {
  version: 2;
  tutorialDone: boolean;
  gold: number;
  xp: number;
  rubies: number;
  unlockedSpells: string[];
  treeRanks: Record<string, number>;
  subclass: SubclassId | null;
  clearedDungeons: string[];
}

/** v3 shape — migrated to v4 on load (adds relicId/relicPickPending). */
interface SaveDataV3 {
  version: 3;
  tutorialDone: boolean;
  gold: number;
  xp: number;
  rubies: number;
  unlockedSpells: string[];
  treeRanks: Record<string, number>;
  subclass: SubclassId | null;
  clearedDungeons: string[];
  combatPaceTenths: number;
}

export function newSaveData(): SaveData {
  return {
    version: 4,
    tutorialDone: false,
    gold: 0,
    xp: 0,
    rubies: 0,
    unlockedSpells: [],
    treeRanks: {},
    subclass: null,
    clearedDungeons: [],
    combatPaceTenths: 10,
    relicId: null,
    relicPickPending: false,
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

  return migrateV3(
    migrateV2({
      version: 2,
      tutorialDone: v1.tutorialDone,
      gold,
      xp: v1.xp,
      rubies: v1.rubies,
      unlockedSpells: [...v1.unlockedSpells],
      treeRanks,
      subclass: v1.subclass,
      clearedDungeons: [...v1.clearedDungeons],
    }),
  );
}

/** v2 → v3: add default combat pace (1×). */
function migrateV2(v2: SaveDataV2): SaveDataV3 {
  return {
    version: 3,
    tutorialDone: v2.tutorialDone,
    gold: v2.gold,
    xp: v2.xp,
    rubies: v2.rubies,
    unlockedSpells: [...v2.unlockedSpells],
    treeRanks: { ...v2.treeRanks },
    subclass: v2.subclass,
    clearedDungeons: [...v2.clearedDungeons],
    combatPaceTenths: 10,
  };
}

/** v3 → v4 (alpha-0.1-handoff §D7): add the relic pick fields, both unset. */
function migrateV3(v3: SaveDataV3): SaveData {
  return {
    version: 4,
    tutorialDone: v3.tutorialDone,
    gold: v3.gold,
    xp: v3.xp,
    rubies: v3.rubies,
    unlockedSpells: [...v3.unlockedSpells],
    treeRanks: { ...v3.treeRanks },
    subclass: v3.subclass,
    clearedDungeons: [...v3.clearedDungeons],
    combatPaceTenths: v3.combatPaceTenths,
    relicId: null,
    relicPickPending: false,
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
    if (isSaveDataV3(parsed)) {
      const migrated = migrateV3(parsed);
      saveGame(migrated, store);
      return migrated;
    }
    if (isSaveDataV2(parsed)) {
      const migrated = migrateV3(migrateV2(parsed));
      saveGame(migrated, store);
      return migrated;
    }
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
  if (v.version !== 4 || !hasBaseShape(v)) return false;
  const ranks = v.treeRanks;
  if (typeof ranks !== 'object' || ranks === null || Array.isArray(ranks)) return false;
  if (!Object.values(ranks).every((r) => typeof r === 'number')) return false;
  if (typeof v.combatPaceTenths !== 'number') return false;
  if (v.relicId !== null && typeof v.relicId !== 'string') return false;
  return typeof v.relicPickPending === 'boolean';
}

function isSaveDataV3(value: unknown): value is SaveDataV3 {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.version !== 3 || !hasBaseShape(v)) return false;
  const ranks = v.treeRanks;
  if (typeof ranks !== 'object' || ranks === null || Array.isArray(ranks)) return false;
  if (!Object.values(ranks).every((r) => typeof r === 'number')) return false;
  return typeof v.combatPaceTenths === 'number';
}

function isSaveDataV2(value: unknown): value is SaveDataV2 {
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
