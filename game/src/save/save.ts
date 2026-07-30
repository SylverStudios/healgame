/**
 * Single local save slot. This is a development build: old save keys and
 * unrecognized payloads are discarded instead of migrated.
 *
 * Schema integer is owned by `save-version.json` and bumped by
 * `scripts/bump-save-version.mjs` when the golden fixture fails validation.
 * Policy: rotate-and-wipe on incompat — no soft migration.
 */

import { ACTION_BAR_SLOTS, SPELLS } from '../data/constants';
import saveVersion from './save-version.json';

/** Compatible save-shape integer — single source of truth (`save-version.json`). */
export const SAVE_SCHEMA: number = saveVersion.schema;

/** Radial starter spell ids (mirrored in `data/radial/spells.ts` — keep in sync). */
const RADIAL_STARTER_HEAL_ID = 'heal';
const RADIAL_STARTER_BONK_ID = 'bonk';

export type SubclassId = 'vigil' | 'zealot';

/** Talent / spell progression topology. Default for fresh installs: lattice. */
export type ProgressionMode = 'lattice' | 'radial' | 'cards';

/**
 * Compact lit-path silhouette captured at run end. Structurally identical to
 * the tree module's `BuildGlyph` — duplicated here so `save/` stays leaf-level.
 */
export interface SavedGlyph {
  id: string;
  segments: { x1: number; y1: number; x2: number; y2: number }[];
}

/** One combat run, newest first in `recentRuns` (ring buffer, max {@link MAX_RECENT_RUNS}). */
export interface RunRecord {
  outcome: 'victory' | 'wipe';
  dungeonId: string;
  xpGained: number;
  glyph: SavedGlyph;
}

export const MAX_RECENT_RUNS = 5;

export interface SaveData {
  /** Must equal {@link SAVE_SCHEMA}. */
  version: number;
  /** Lattice (classic), radial, or spell-card progression. */
  progressionMode: ProgressionMode;
  tutorialDone: boolean;
  xp: number;
  /** Spell ids granted outside the tree (tutorial, level milestones, starter Bonk). */
  unlockedSpells: string[];
  /**
   * QWER combat spell slots (length {@link ACTION_BAR_SLOTS}). Empty string =
   * vacant. Duplicates are allowed. Fight kit order follows non-empty slots.
   */
  actionBar: string[];
  /** Allocated talent points: nodeId → ranks owned (≥1). */
  treeRanks: Record<string, number>;
  subclass: SubclassId | null;
  clearedDungeons: string[];
  combatPaceTenths: number;
  /** Permanent relics selected from first-clear reward offers. */
  relicIds: string[];
  /** Stable three-card offer awaiting a choice; empty when no reward is pending. */
  pendingRelicOffers: string[];
  /** Unspent spell-card chip drafts. Lattice/radial keep 0. */
  upgradePoints: number;
  /**
   * spellId → ordered chip ids filling slots (length 0..2).
   * Index 0 = slot-1 pick; index 1 = slot-2 pick. Cards mode only; others `{}`.
   */
  spellChips: Record<string, string[]>;
  /** Master music volume 0..100 (integer). 0 fully stops playback. */
  musicVolumePct: number;
  /** Last few combat runs, newest first (run summary / Hub display). */
  recentRuns: RunRecord[];
}

/** Vacant QWER bar (four empty slots). */
export function emptyActionBar(): string[] {
  return Array.from({ length: ACTION_BAR_SLOTS }, () => '');
}

/** New-game bar: Bonk on Q (lattice). */
export function defaultActionBar(): string[] {
  const bar = emptyActionBar();
  bar[0] = SPELLS.bonk.id;
  return bar;
}

/** Radial new-game bar: Bonk on Q, Heal on W. */
export function defaultRadialActionBar(): string[] {
  const bar = emptyActionBar();
  bar[0] = RADIAL_STARTER_BONK_ID;
  bar[1] = RADIAL_STARTER_HEAL_ID;
  return bar;
}

export function newSaveData(mode: ProgressionMode = 'lattice'): SaveData {
  if (mode === 'radial') {
    return {
      version: SAVE_SCHEMA,
      progressionMode: 'radial',
      tutorialDone: false,
      xp: 0,
      unlockedSpells: [RADIAL_STARTER_HEAL_ID, RADIAL_STARTER_BONK_ID],
      actionBar: defaultRadialActionBar(),
      treeRanks: { heal: 1, bonk: 1 },
      subclass: null,
      clearedDungeons: [],
      combatPaceTenths: 10,
      relicIds: [],
      pendingRelicOffers: [],
      upgradePoints: 0,
      spellChips: {},
      musicVolumePct: 50,
      recentRuns: [],
    };
  }
  if (mode === 'cards') {
    return {
      version: SAVE_SCHEMA,
      progressionMode: 'cards',
      tutorialDone: false,
      xp: 0,
      unlockedSpells: [RADIAL_STARTER_HEAL_ID, RADIAL_STARTER_BONK_ID],
      actionBar: defaultRadialActionBar(),
      treeRanks: {},
      subclass: null,
      clearedDungeons: [],
      combatPaceTenths: 10,
      relicIds: [],
      pendingRelicOffers: [],
      upgradePoints: 1,
      spellChips: {},
      musicVolumePct: 50,
      recentRuns: [],
    };
  }
  return {
    version: SAVE_SCHEMA,
    progressionMode: 'lattice',
    tutorialDone: false,
    xp: 0,
    unlockedSpells: [SPELLS.bonk.id],
    actionBar: defaultActionBar(),
    treeRanks: {},
    subclass: null,
    clearedDungeons: [],
    combatPaceTenths: 10,
    relicIds: [],
    pendingRelicOffers: [],
    upgradePoints: 0,
    spellChips: {},
    musicVolumePct: 50,
    recentRuns: [],
  };
}

export const SAVE_KEY = `healgame-save-v${SAVE_SCHEMA}`;

/** Retired localStorage keys purged on load. Bump script appends the prior key. */
export const LEGACY_SAVE_KEYS = [
  'healgame-save-v1',
  'healgame-save-v5',
  'healgame-save-v6',
  'healgame-save-v7',
  'healgame-save-v8',
  'healgame-save-v9',
] as const;

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
    if (validateSaveData(parsed)) return parsed;
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

/** Place `spellId` in the first empty QWER slot; no-op if already present or bar full. */
export function placeOnActionBar(save: SaveData, spellId: string): void {
  if (save.actionBar.includes(spellId)) return;
  const empty = save.actionBar.findIndex((id) => id === '');
  if (empty >= 0) save.actionBar[empty] = spellId;
}

/** Prepend a run record, trimming the buffer to {@link MAX_RECENT_RUNS}. */
export function pushRecentRun(save: SaveData, run: RunRecord): void {
  save.recentRuns.unshift(run);
  save.recentRuns.length = Math.min(save.recentRuns.length, MAX_RECENT_RUNS);
}

/** Restart: wipe the save. Caller starts a new game from newSaveData(). */
export function resetSave(store: KeyValueStore | null = defaultStore()): void {
  store?.removeItem(SAVE_KEY);
  for (const key of LEGACY_SAVE_KEYS) store?.removeItem(key);
}

/**
 * Wipe storage and write a fresh save in `mode` (Settings mode switch /
 * Hub restart preserving mode).
 */
export function resetSaveToMode(
  mode: ProgressionMode,
  store: KeyValueStore | null = defaultStore(),
): SaveData {
  resetSave(store);
  const fresh = newSaveData(mode);
  saveGame(fresh, store);
  return fresh;
}

function hasBaseShape(v: Record<string, unknown>): boolean {
  return (
    typeof v.tutorialDone === 'boolean' &&
    typeof v.xp === 'number' &&
    Array.isArray(v.unlockedSpells) &&
    Array.isArray(v.actionBar) &&
    v.actionBar.length === ACTION_BAR_SLOTS &&
    v.actionBar.every((id) => typeof id === 'string') &&
    (v.subclass === null || v.subclass === 'vigil' || v.subclass === 'zealot') &&
    Array.isArray(v.clearedDungeons)
  );
}

/** Same validation `loadSave` uses — exported for golden-fixture / save-compat. */
export function validateSaveData(value: unknown): value is SaveData {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.version !== SAVE_SCHEMA || !hasBaseShape(v)) return false;
  if (
    v.progressionMode !== 'lattice' &&
    v.progressionMode !== 'radial' &&
    v.progressionMode !== 'cards'
  ) {
    return false;
  }
  const ranks = v.treeRanks;
  if (typeof ranks !== 'object' || ranks === null || Array.isArray(ranks)) return false;
  if (!Object.values(ranks).every((r) => typeof r === 'number')) return false;
  if (typeof v.combatPaceTenths !== 'number') return false;
  if (typeof v.musicVolumePct !== 'number') return false;
  if (typeof v.upgradePoints !== 'number') return false;
  const chips = v.spellChips;
  if (typeof chips !== 'object' || chips === null || Array.isArray(chips)) return false;
  if (
    !Object.values(chips).every(
      (ids) => Array.isArray(ids) && ids.every((id) => typeof id === 'string'),
    )
  ) {
    return false;
  }
  if (!Array.isArray(v.recentRuns) || !v.recentRuns.every(isRunRecord)) return false;
  return (
    Array.isArray(v.relicIds) &&
    v.relicIds.every((id) => typeof id === 'string') &&
    Array.isArray(v.pendingRelicOffers) &&
    v.pendingRelicOffers.every((id) => typeof id === 'string')
  );
}

function isRunRecord(value: unknown): value is RunRecord {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  if (r.outcome !== 'victory' && r.outcome !== 'wipe') return false;
  if (typeof r.dungeonId !== 'string' || typeof r.xpGained !== 'number') return false;
  const g = r.glyph;
  if (typeof g !== 'object' || g === null) return false;
  const glyph = g as Record<string, unknown>;
  return typeof glyph.id === 'string' && Array.isArray(glyph.segments);
}
