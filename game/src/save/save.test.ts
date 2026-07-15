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
  it('returns a fresh v6 save when nothing is stored', () => {
    const save = loadSave(memoryStore());
    expect(save).toEqual(newSaveData());
    expect(save).toEqual({
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
    });
    expect(save).not.toHaveProperty('gold');
    expect(save).not.toHaveProperty('rubies');
  });

  it('round-trips a full v6 save', () => {
    const store = memoryStore();
    const data: SaveData = {
      version: 6,
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

  it('deletes old development save keys instead of migrating them', () => {
    const store = memoryStore();
    store.setItem('healgame-save-v1', JSON.stringify({ version: 4, xp: 999 }));
    store.setItem('healgame-save-v5', JSON.stringify({ version: 5, xp: 999 }));
    expect(loadSave(store)).toEqual(newSaveData());
    expect(store.getItem('healgame-save-v1')).toBeNull();
    expect(store.getItem('healgame-save-v5')).toBeNull();
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
    storePayload(store, { version: 6, xp: 'nope' });
    expect(loadSave(store)).toEqual(newSaveData());
    expect(store.getItem(SAVE_KEY)).toBeNull();
  });
});
