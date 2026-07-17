/**
 * In-memory active-run buffer for the current combat. Finalized into the
 * persisted telemetry log when combat ends.
 */

import { levelForXp } from '../data/constants';
import type { SaveData } from '../save/save';
import { appendRun, bumpPress } from './store';
import type { ActiveRun, PressSource, TelemetryRun } from './types';

let active: ActiveRun | null = null;

export function beginRun(encounterId: string, save: SaveData, now: Date = new Date()): ActiveRun {
  active = {
    encounterId,
    startedAt: now.toISOString(),
    level: levelForXp(save.xp),
    xp: save.xp,
    subclass: save.subclass,
    treeRanks: { ...save.treeRanks },
    actionBar: [...save.actionBar],
    relicIds: [...save.relicIds],
    presses: {},
  };
  return active;
}

export function recordPress(id: string, source: PressSource): void {
  if (!active) return;
  bumpPress(active.presses, id, source);
}

export function getActiveRun(): ActiveRun | null {
  return active;
}

export function finalizeRun(
  status: 'victory' | 'wipe',
  durationMs: number,
  now: Date = new Date(),
): TelemetryRun | null {
  if (!active) return null;
  const run: TelemetryRun = {
    encounterId: active.encounterId,
    startedAt: active.startedAt,
    endedAt: now.toISOString(),
    durationMs: Math.max(0, Math.floor(durationMs)),
    status,
    level: active.level,
    xp: active.xp,
    subclass: active.subclass,
    treeRanks: active.treeRanks,
    actionBar: active.actionBar,
    relicIds: active.relicIds,
    presses: active.presses,
  };
  active = null;
  appendRun(run);
  return run;
}

/** Drop an unfinished buffer (e.g. tests). Does not write a run. */
export function abandonActiveRun(): void {
  active = null;
}
