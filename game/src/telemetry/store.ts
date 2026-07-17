/**
 * Persist playtest telemetry under a key separate from the game save so
 * Restart (wipe save) keeps the log for export.
 */

import type { KeyValueStore } from '../save/save';
import type { PressCounts, TelemetryLog, TelemetryRun } from './types';

export const TELEMETRY_KEY = 'healgame-telemetry-v1';

function defaultStore(): KeyValueStore | null {
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

export function newTelemetryLog(now: Date = new Date()): TelemetryLog {
  return {
    version: 1,
    createdAt: now.toISOString(),
    playMs: 0,
    resetCount: 0,
    runs: [],
  };
}

export function loadTelemetry(store: KeyValueStore | null = defaultStore()): TelemetryLog {
  if (!store) return newTelemetryLog();
  const raw = store.getItem(TELEMETRY_KEY);
  if (!raw) return newTelemetryLog();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isTelemetryLog(parsed)) return parsed;
    store.removeItem(TELEMETRY_KEY);
    return newTelemetryLog();
  } catch {
    store.removeItem(TELEMETRY_KEY);
    return newTelemetryLog();
  }
}

export function saveTelemetry(log: TelemetryLog, store: KeyValueStore | null = defaultStore()): void {
  store?.setItem(TELEMETRY_KEY, JSON.stringify(log));
}

/** Soft-clear the export buffer (does not wipe the game save). */
export function clearTelemetry(store: KeyValueStore | null = defaultStore()): void {
  store?.removeItem(TELEMETRY_KEY);
}

export function appendRun(
  run: TelemetryRun,
  store: KeyValueStore | null = defaultStore(),
): TelemetryLog {
  const log = loadTelemetry(store);
  log.runs.push(run);
  saveTelemetry(log, store);
  return log;
}

export function recordReset(store: KeyValueStore | null = defaultStore()): TelemetryLog {
  const log = loadTelemetry(store);
  log.resetCount += 1;
  saveTelemetry(log, store);
  return log;
}

export function addPlayMs(deltaMs: number, store: KeyValueStore | null = defaultStore()): void {
  if (deltaMs <= 0) return;
  const log = loadTelemetry(store);
  log.playMs += Math.floor(deltaMs);
  saveTelemetry(log, store);
}

export function bumpPress(presses: Record<string, PressCounts>, id: string, source: 'key' | 'click'): void {
  const cur = presses[id] ?? { key: 0, click: 0 };
  if (source === 'key') cur.key += 1;
  else cur.click += 1;
  presses[id] = cur;
}

function isPressCounts(v: unknown): v is PressCounts {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return typeof p.key === 'number' && typeof p.click === 'number';
}

function isTelemetryRun(v: unknown): v is TelemetryRun {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  if (typeof r.encounterId !== 'string') return false;
  if (typeof r.startedAt !== 'string' || typeof r.endedAt !== 'string') return false;
  if (typeof r.durationMs !== 'number' || typeof r.level !== 'number' || typeof r.xp !== 'number') {
    return false;
  }
  if (r.status !== 'victory' && r.status !== 'wipe') return false;
  if (!(r.subclass === null || r.subclass === 'vigil' || r.subclass === 'zealot')) return false;
  if (typeof r.treeRanks !== 'object' || r.treeRanks === null || Array.isArray(r.treeRanks)) {
    return false;
  }
  if (!Object.values(r.treeRanks as Record<string, unknown>).every((n) => typeof n === 'number')) {
    return false;
  }
  if (!Array.isArray(r.actionBar) || !r.actionBar.every((id) => typeof id === 'string')) return false;
  if (!Array.isArray(r.relicIds) || !r.relicIds.every((id) => typeof id === 'string')) return false;
  if (typeof r.presses !== 'object' || r.presses === null || Array.isArray(r.presses)) return false;
  return Object.values(r.presses as Record<string, unknown>).every(isPressCounts);
}

export function isTelemetryLog(value: unknown): value is TelemetryLog {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.version !== 1) return false;
  if (typeof v.createdAt !== 'string' || typeof v.playMs !== 'number' || typeof v.resetCount !== 'number') {
    return false;
  }
  if (!Array.isArray(v.runs)) return false;
  return v.runs.every(isTelemetryRun);
}

/** Parse + validate a JSON string (CLI / pasted exports). */
export function parseTelemetryJson(raw: string): TelemetryLog | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isTelemetryLog(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
