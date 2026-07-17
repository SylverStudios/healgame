import { describe, expect, it } from 'vitest';
import type { KeyValueStore } from '../save/save';
import {
  appendRun,
  bumpPress,
  clearTelemetry,
  dungeonRollup,
  formatPlayMs,
  formatTelemetryGlance,
  formatTelemetrySummary,
  loadTelemetry,
  mailtoHref,
  newTelemetryLog,
  parseTelemetryJson,
  recordReset,
  saveTelemetry,
  spellPressTotals,
  talentPickCounts,
  TELEMETRY_KEY,
} from './index';
import type { TelemetryRun } from './types';
import { abandonActiveRun, beginRun, finalizeRun, recordPress } from './session';
import { SPELLS } from '../data/constants';
import { newSaveData } from '../save/save';

function memoryStore(seed: Record<string, string> = {}): KeyValueStore {
  const data = { ...seed };
  return {
    getItem: (k) => (k in data ? data[k]! : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

function sampleRun(partial: Partial<TelemetryRun> = {}): TelemetryRun {
  return {
    encounterId: 'ash-gate',
    startedAt: '2026-07-17T12:00:00.000Z',
    endedAt: '2026-07-17T12:01:00.000Z',
    durationMs: 60_000,
    status: 'victory',
    level: 2,
    xp: 10,
    subclass: 'vigil',
    treeRanks: { 'vigil-oath': 1 },
    actionBar: [SPELLS.bonk.id, SPELLS.solemnMend.id, '', ''],
    relicIds: [],
    presses: {
      [SPELLS.bonk.id]: { key: 10, click: 2 },
      [SPELLS.solemnMend.id]: { key: 5, click: 0 },
    },
    ...partial,
  };
}

describe('telemetry store', () => {
  it('round-trips a log and rejects garbage', () => {
    const store = memoryStore();
    const log = newTelemetryLog(new Date('2026-07-17T00:00:00.000Z'));
    log.runs.push(sampleRun());
    saveTelemetry(log, store);
    expect(loadTelemetry(store).runs).toHaveLength(1);
    expect(loadTelemetry(store).runs[0]?.encounterId).toBe('ash-gate');

    store.setItem(TELEMETRY_KEY, '{not-json');
    expect(loadTelemetry(store).runs).toEqual([]);
  });

  it('appendRun / recordReset mutate the same key', () => {
    const store = memoryStore();
    appendRun(sampleRun(), store);
    appendRun(sampleRun({ encounterId: 'iron-pass', status: 'wipe' }), store);
    recordReset(store);
    const log = loadTelemetry(store);
    expect(log.runs).toHaveLength(2);
    expect(log.resetCount).toBe(1);
    clearTelemetry(store);
    expect(loadTelemetry(store).runs).toEqual([]);
  });

  it('bumpPress tallies key vs click separately', () => {
    const presses: Record<string, { key: number; click: number }> = {};
    bumpPress(presses, 'bonk', 'key');
    bumpPress(presses, 'bonk', 'key');
    bumpPress(presses, 'bonk', 'click');
    expect(presses.bonk).toEqual({ key: 2, click: 1 });
  });
});

describe('active run session', () => {
  it('records presses and finalizes one run', () => {
    abandonActiveRun();
    const save = newSaveData();
    save.xp = 10;
    save.subclass = 'zealot';
    save.treeRanks = { 'zealot-oath': 1 };
    beginRun('cinder-vault', save, new Date('2026-07-17T15:00:00.000Z'));
    recordPress(SPELLS.bonk.id, 'key');
    recordPress(SPELLS.bonk.id, 'click');
    recordPress('still-waters', 'key');

    const store = memoryStore();
    // finalizeRun uses default localStorage; stub via append path by testing session shape:
    const run = finalizeRun('wipe', 12_345, new Date('2026-07-17T15:02:00.000Z'));
    expect(run).not.toBeNull();
    expect(run!.encounterId).toBe('cinder-vault');
    expect(run!.status).toBe('wipe');
    expect(run!.level).toBe(2);
    expect(run!.subclass).toBe('zealot');
    expect(run!.presses.bonk).toEqual({ key: 1, click: 1 });
    expect(run!.presses['still-waters']).toEqual({ key: 1, click: 0 });
    expect(run!.durationMs).toBe(12_345);
    // Clean default store pollution from finalizeRun → appendRun
    clearTelemetry();
    void store;
  });
});

describe('summary + mailto', () => {
  it('formats playtime and rollups', () => {
    expect(formatPlayMs(3661000)).toBe('1h 1m 1s');
    const runs = [
      sampleRun(),
      sampleRun({ encounterId: 'ash-gate', status: 'wipe', treeRanks: {} }),
      sampleRun({
        encounterId: 'iron-pass',
        treeRanks: { 'vigil-oath': 1, 'shared-mend-potency': 1 },
        presses: { bonk: { key: 1, click: 0 } },
      }),
    ];
    expect(dungeonRollup(runs)['ash-gate']).toEqual({
      attempts: 2,
      wins: 1,
      totalDurationMs: 120_000,
    });
    // sampleRun default bonk 12 × 2 ash-gate runs + 1 iron-pass = 25
    expect(spellPressTotals(runs).bonk).toBe(25);
    expect(talentPickCounts(runs)['vigil-oath']).toBe(2);

    const log = newTelemetryLog();
    log.playMs = 90_000;
    log.resetCount = 1;
    log.runs = runs;
    const summary = formatTelemetrySummary(log);
    expect(summary).toContain('resets: 1');
    expect(summary).toContain('ash-gate: 1/2 wins');
    expect(summary).toContain('bonk: 25');

    const glance = formatTelemetryGlance(log);
    expect(glance).toContain('=== healgame telemetry glance ===');
    expect(glance).toContain('ash-gate');
    expect(glance).toContain('Presses (key / click / total)');
    expect(glance).toContain('vigil-oath');
  });

  it('builds a mailto href with feedback subject and write space', () => {
    const log = newTelemetryLog();
    log.runs = [sampleRun()];
    const href = mailtoHref(log, true);
    expect(href.startsWith('mailto:')).toBe(true);
    expect(href).toContain('subject=healgame%20feedback');
    expect(href).toContain('body=');
    expect(href).toContain(encodeURIComponent('(type your feedback here)'));
    expect(href).toContain('mailto:sylverstudiosdev@gmail.com?');
  });

  it('parseTelemetryJson accepts a valid export and rejects junk', () => {
    const log = newTelemetryLog(new Date('2026-07-17T00:00:00.000Z'));
    log.runs = [sampleRun()];
    expect(parseTelemetryJson(JSON.stringify(log))?.runs).toHaveLength(1);
    expect(parseTelemetryJson('{"version":1}')).toBeNull();
  });
});
