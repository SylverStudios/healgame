/**
 * Roll-ups for mailto bodies, CLI glance reports, and quick human reading.
 */

import type { PressCounts, TelemetryLog, TelemetryRun } from './types';

export function formatPlayMs(ms: number): string {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export interface DungeonRollupRow {
  attempts: number;
  wins: number;
  totalDurationMs: number;
}

/** Aggregate dungeon attempt counts, wins, and fight duration. */
export function dungeonRollup(runs: readonly TelemetryRun[]): Record<string, DungeonRollupRow> {
  const out: Record<string, DungeonRollupRow> = {};
  for (const run of runs) {
    const row = out[run.encounterId] ?? { attempts: 0, wins: 0, totalDurationMs: 0 };
    row.attempts += 1;
    if (run.status === 'victory') row.wins += 1;
    row.totalDurationMs += run.durationMs;
    out[run.encounterId] = row;
  }
  return out;
}

/** Sum presses across all runs (key + click). */
export function spellPressTotals(runs: readonly TelemetryRun[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const run of runs) {
    for (const [id, counts] of Object.entries(run.presses)) {
      out[id] = (out[id] ?? 0) + counts.key + counts.click;
    }
  }
  return out;
}

/** Sum key/click presses separately across all runs. */
export function spellPressBreakdown(runs: readonly TelemetryRun[]): Record<string, PressCounts> {
  const out: Record<string, PressCounts> = {};
  for (const run of runs) {
    for (const [id, counts] of Object.entries(run.presses)) {
      const cur = out[id] ?? { key: 0, click: 0 };
      cur.key += counts.key;
      cur.click += counts.click;
      out[id] = cur;
    }
  }
  return out;
}

/** How often each talent node appears with rank ≥1 across runs. */
export function talentPickCounts(runs: readonly TelemetryRun[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const run of runs) {
    for (const [nodeId, ranks] of Object.entries(run.treeRanks)) {
      if (ranks >= 1) out[nodeId] = (out[nodeId] ?? 0) + 1;
    }
  }
  return out;
}

export function subclassCounts(runs: readonly TelemetryRun[]): Record<string, number> {
  const out: Record<string, number> = { none: 0, vigil: 0, zealot: 0 };
  for (const run of runs) {
    const key = run.subclass ?? 'none';
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

function pct(n: number, d: number): string {
  if (d <= 0) return '—';
  return `${Math.round((100 * n) / d)}%`;
}

function pad(label: string, width: number): string {
  return label.length >= width ? label : `${label}${' '.repeat(width - label.length)}`;
}

export function formatTelemetryJson(log: TelemetryLog): string {
  return JSON.stringify(log, null, 2);
}

/** Short human summary for feedback emails / mailto bodies. */
export function formatTelemetrySummary(log: TelemetryLog): string {
  const lines: string[] = [
    `playtime: ${formatPlayMs(log.playMs)}`,
    `resets: ${log.resetCount}`,
    `runs: ${log.runs.length}`,
    `log since: ${log.createdAt}`,
  ];

  const dungeons = dungeonRollup(log.runs);
  const dungeonIds = Object.keys(dungeons).sort();
  if (dungeonIds.length > 0) {
    lines.push('dungeons:');
    for (const id of dungeonIds) {
      const row = dungeons[id]!;
      lines.push(`  ${id}: ${row.wins}/${row.attempts} wins`);
    }
  }

  const spells = spellPressTotals(log.runs);
  const spellIds = Object.keys(spells).sort((a, b) => (spells[b] ?? 0) - (spells[a] ?? 0));
  if (spellIds.length > 0) {
    lines.push('presses (all runs):');
    for (const id of spellIds) {
      lines.push(`  ${id}: ${spells[id]}`);
    }
  }

  const talents = talentPickCounts(log.runs);
  const talentIds = Object.keys(talents).sort((a, b) => (talents[b] ?? 0) - (talents[a] ?? 0));
  if (talentIds.length > 0) {
    lines.push('talents present on runs:');
    for (const id of talentIds) {
      lines.push(`  ${id}: ${talents[id]} runs`);
    }
  }

  return lines.join('\n');
}

/**
 * Deterministic glance report for a saved telemetry JSON file — enough to
 * spot hard/easy dungeons and unused kit before handing the dump to an agent.
 */
export function formatTelemetryGlance(log: TelemetryLog): string {
  const runs = log.runs;
  const lines: string[] = [
    '=== healgame telemetry glance ===',
    `log since:  ${log.createdAt}`,
    `playtime:   ${formatPlayMs(log.playMs)}`,
    `resets:     ${log.resetCount}`,
    `runs:       ${runs.length}`,
  ];

  lines.push('');
  lines.push('Dungeons (wins/attempts, win rate, avg fight)');
  const dungeons = dungeonRollup(runs);
  const dungeonIds = Object.keys(dungeons).sort();
  if (dungeonIds.length === 0) {
    lines.push('  (none)');
  } else {
    for (const id of dungeonIds) {
      const row = dungeons[id]!;
      const avg = row.attempts > 0 ? row.totalDurationMs / row.attempts : 0;
      lines.push(
        `  ${pad(id, 14)} ${row.wins}/${row.attempts}  (${pct(row.wins, row.attempts)})  avg ${formatPlayMs(avg)}`,
      );
    }
  }

  lines.push('');
  lines.push('Subclass on runs');
  const subs = subclassCounts(runs);
  for (const key of ['vigil', 'zealot', 'none'] as const) {
    lines.push(`  ${pad(key, 8)} ${subs[key] ?? 0}`);
  }

  lines.push('');
  lines.push('Presses (key / click / total)');
  const presses = spellPressBreakdown(runs);
  const pressIds = Object.keys(presses).sort(
    (a, b) => presses[b]!.key + presses[b]!.click - (presses[a]!.key + presses[a]!.click),
  );
  if (pressIds.length === 0) {
    lines.push('  (none)');
  } else {
    for (const id of pressIds) {
      const p = presses[id]!;
      const total = p.key + p.click;
      lines.push(`  ${pad(id, 22)} ${p.key} / ${p.click} / ${total}`);
    }
  }

  lines.push('');
  lines.push(`Talents present on runs (of ${runs.length})`);
  const talents = talentPickCounts(runs);
  const talentIds = Object.keys(talents).sort((a, b) => (talents[b] ?? 0) - (talents[a] ?? 0));
  if (talentIds.length === 0) {
    lines.push('  (none)');
  } else {
    for (const id of talentIds) {
      const n = talents[id]!;
      lines.push(`  ${pad(id, 28)} ${n}/${runs.length}  (${pct(n, runs.length)})`);
    }
  }

  return lines.join('\n');
}
