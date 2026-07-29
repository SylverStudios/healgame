import { describe, expect, it } from 'vitest';
import {
  loadSave,
  newSaveData,
  resetSave,
  resetSaveToMode,
  SAVE_KEY,
  saveGame,
  type KeyValueStore,
  type SaveData,
} from './save';
import { SPELLS } from '../data/constants';
import { RADIAL_BONK, RADIAL_HEAL } from '../data/radial/spells';

function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function storePayload(store: KeyValueStore, payload: Record<string, unknown>): void {
  store.setItem(SAVE_KEY, JSON.stringify(payload));
}

describe('save', () => {
  it('returns a fresh v9 lattice save when nothing is stored', () => {
    const save = loadSave(memoryStore());
    expect(save).toEqual(newSaveData());
    expect(save).toEqual({
      version: 9,
      progressionMode: 'lattice',
      tutorialDone: false,
      xp: 0,
      unlockedSpells: [SPELLS.bonk.id],
      actionBar: [SPELLS.bonk.id, '', '', ''],
      treeRanks: {},
      subclass: null,
      clearedDungeons: [],
      combatPaceTenths: 10,
      relicIds: [],
      pendingRelicOffers: [],
      musicVolumePct: 50,
      recentRuns: [],
    });
    expect(save).not.toHaveProperty('gold');
    expect(save).not.toHaveProperty('rubies');
  });

  it('radial newSaveData prepurchases Heal + Bonk on bar', () => {
    const save = newSaveData('radial');
    expect(save.progressionMode).toBe('radial');
    expect(save.unlockedSpells).toEqual([RADIAL_HEAL.id, RADIAL_BONK.id]);
    expect(save.actionBar).toEqual([RADIAL_HEAL.id, RADIAL_BONK.id, '', '']);
    expect(save.treeRanks).toEqual({ heal: 1, bonk: 1 });
  });

  it('round-trips a full v9 save', () => {
    const store = memoryStore();
    const data: SaveData = {
      version: 9,
      progressionMode: 'lattice',
      tutorialDone: true,
      xp: 42,
      unlockedSpells: [SPELLS.bonk.id, 'solemn-mend', 'zealous-mending'],
      actionBar: [SPELLS.bonk.id, 'solemn-mend', '', ''],
      treeRanks: { 'deep-reserves': 3, 'vigil-oath': 1 },
      subclass: 'vigil',
      clearedDungeons: ['ash-gate'],
      combatPaceTenths: 15,
      relicIds: ['ember-ledger', 'triage-bell'],
      pendingRelicOffers: ['still-reservoir', 'vital-ember', 'bastion-plate'],
      musicVolumePct: 30,
      recentRuns: [
        {
          outcome: 'victory',
          dungeonId: 'ash-gate',
          xpGained: 12,
          glyph: { id: 'g1', segments: [{ x1: 0, y1: 0, x2: 1, y2: 0 }] },
        },
      ],
    };
    saveGame(data, store);
    expect(loadSave(store)).toEqual(data);
  });

  it('deletes old development save keys instead of migrating them', () => {
    const store = memoryStore();
    store.setItem('healgame-save-v1', JSON.stringify({ version: 4, xp: 999 }));
    store.setItem('healgame-save-v5', JSON.stringify({ version: 5, xp: 999 }));
    store.setItem('healgame-save-v6', JSON.stringify({ version: 6, xp: 999 }));
    store.setItem('healgame-save-v7', JSON.stringify({ version: 7, xp: 999 }));
    store.setItem('healgame-save-v8', JSON.stringify({ version: 8, xp: 999 }));
    expect(loadSave(store)).toEqual(newSaveData());
    expect(store.getItem('healgame-save-v1')).toBeNull();
    expect(store.getItem('healgame-save-v5')).toBeNull();
    expect(store.getItem('healgame-save-v6')).toBeNull();
    expect(store.getItem('healgame-save-v7')).toBeNull();
    expect(store.getItem('healgame-save-v8')).toBeNull();
  });

  it('resetSave wipes everything (restart, no respec)', () => {
    const store = memoryStore();
    const data = newSaveData();
    data.xp = 20;
    data.tutorialDone = true;
    saveGame(data, store);
    resetSave(store);
    expect(loadSave(store)).toEqual(newSaveData());
  });

  it('resetSaveToMode wipes and restarts in the chosen mode', () => {
    const store = memoryStore();
    saveGame(newSaveData('lattice'), store);
    const radial = resetSaveToMode('radial', store);
    expect(radial.progressionMode).toBe('radial');
    expect(loadSave(store).progressionMode).toBe('radial');
    expect(loadSave(store).unlockedSpells).toContain(RADIAL_HEAL.id);
  });

  it('discards unrecognized payloads', () => {
    const store = memoryStore();
    storePayload(store, { version: 9, xp: 'nope' });
    expect(loadSave(store)).toEqual(newSaveData());
  });
});
