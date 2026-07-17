/**
 * Playtest telemetry — compact, balance-focused log kept in its own
 * localStorage key so Restart (wipe save) does not erase it.
 */

import type { SubclassId } from '../save/save';

export type PressSource = 'key' | 'click';

/** Per-ability press counts for one dungeon run (includes GCD/busy misses). */
export interface PressCounts {
  key: number;
  click: number;
}

export interface TelemetryRun {
  encounterId: string;
  startedAt: string;
  endedAt: string;
  /** Simulated fight duration (pace-scaled), ms. */
  durationMs: number;
  status: 'victory' | 'wipe';
  level: number;
  xp: number;
  subclass: SubclassId | null;
  treeRanks: Record<string, number>;
  actionBar: string[];
  relicIds: string[];
  /** Spell / cooldown id → key vs click presses during the fight. */
  presses: Record<string, PressCounts>;
}

export interface TelemetryLog {
  version: 1;
  /** First time this browser created a telemetry log. */
  createdAt: string;
  /** Accumulated visible playtime while the tab was focused, ms. */
  playMs: number;
  /** Confirmed Restart (wipe save) clicks. */
  resetCount: number;
  runs: TelemetryRun[];
}

/** In-progress run buffer (not persisted until combat ends). */
export interface ActiveRun {
  encounterId: string;
  startedAt: string;
  level: number;
  xp: number;
  subclass: SubclassId | null;
  treeRanks: Record<string, number>;
  actionBar: string[];
  relicIds: string[];
  presses: Record<string, PressCounts>;
}
