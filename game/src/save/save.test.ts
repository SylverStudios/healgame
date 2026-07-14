import { describe, expect, it } from 'vitest';
import {
  loadSave,
  newSaveData,
  resetSave,
  SAVE_KEY,
  saveGame,
  type KeyValueStore,
  type SaveData,
} from './save';

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
  it('returns a fresh v5 save when nothing is stored', () => {
    const save = loadSave(memoryStore());
    expect(save).toEqual(newSaveData());
    expect(save).toEqual({
      version: 5,
      tutorialDone: false,
      xp: 0,
      unlockedSpells: [],
      treeRanks: {},
      subclass: null,
      clearedDungeons: [],
      combatPaceTenths: 10,
      relicIds: [],
      pendingRelicOffers: [],
    });
    expect(save).not.toHaveProperty('gold');
    expect(save).not.toHaveProperty('rubies');
  });

  it('round-trips a full v5 save', () => {
    const store = memoryStore();
    const data: SaveData = {
      version: 5,
      tutorialDone: true,
      xp: 42,
      unlockedSpells: ['solemn-mend', 'zealous-mending'],
      treeRanks: { 'deep-reserves': 3, 'vigil-oath': 1 },
      subclass: 'vigil',
      clearedDungeons: ['ash-gate'],
      combatPaceTenths: 15,
      relicIds: ['ember-ledger', 'triage-bell'],
      pendingRelicOffers: ['still-reservoir', 'vital-ember', 'bastion-plate'],
    };
    saveGame(data, store);
    expect(loadSave(store)).toEqual(data);
  });

  it('deletes the old development save key instead of migrating it', () => {
    const store = memoryStore();
    store.setItem('healgame-save-v1', JSON.stringify({ version: 4, xp: 999 }));
    expect(loadSave(store)).toEqual(newSaveData());
    expect(store.getItem('healgame-save-v1')).toBeNull();
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

  it('falls back to a fresh save on corrupt or unknown data', () => {
    const store = memoryStore();
    store.setItem(SAVE_KEY, '{not json');
    expect(loadSave(store)).toEqual(newSaveData());
    store.setItem(SAVE_KEY, JSON.stringify({ version: 99 }));
    expect(loadSave(store)).toEqual(newSaveData());
    storePayload(store, { ...newSaveData(), version: 4 });
    expect(loadSave(store)).toEqual(newSaveData());
    storePayload(store, { ...newSaveData(), pendingRelicOffers: 'nope' });
    expect(loadSave(store)).toEqual(newSaveData());
  });

  it('works without any storage (SSR/tests)', () => {
    expect(loadSave(null)).toEqual(newSaveData());
    expect(() => saveGame(newSaveData(), null)).not.toThrow();
    expect(() => resetSave(null)).not.toThrow();
  });
});
