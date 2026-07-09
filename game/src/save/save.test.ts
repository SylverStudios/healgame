import { describe, expect, it } from 'vitest';
import {
  loadSave,
  newSaveData,
  resetSave,
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

describe('save', () => {
  it('returns a fresh save when nothing is stored', () => {
    const save = loadSave(memoryStore());
    expect(save).toEqual(newSaveData());
    expect(save.tutorialDone).toBe(false);
    expect(save.subclass).toBeNull();
  });

  it('round-trips a full save', () => {
    const store = memoryStore();
    const data: SaveData = {
      version: 1,
      tutorialDone: true,
      gold: 7,
      xp: 12,
      rubies: 1,
      unlockedSpells: ['solemn-mend', 'zealous-mending'],
      treeNodes: ['max-mana-1'],
      subclass: 'vigil',
      clearedDungeons: ['ash-gate'],
    };
    saveGame(data, store);
    expect(loadSave(store)).toEqual(data);
  });

  it('resetSave wipes everything (restart, no respec)', () => {
    const store = memoryStore();
    const data = newSaveData();
    data.gold = 5;
    data.tutorialDone = true;
    saveGame(data, store);
    resetSave(store);
    expect(loadSave(store)).toEqual(newSaveData());
  });

  it('falls back to a fresh save on corrupt data', () => {
    const store = memoryStore();
    store.setItem('healgame-save-v1', '{not json');
    expect(loadSave(store)).toEqual(newSaveData());
    store.setItem('healgame-save-v1', JSON.stringify({ version: 99 }));
    expect(loadSave(store)).toEqual(newSaveData());
  });

  it('works without any storage (SSR/tests)', () => {
    expect(loadSave(null)).toEqual(newSaveData());
    expect(() => saveGame(newSaveData(), null)).not.toThrow();
    expect(() => resetSave(null)).not.toThrow();
  });
});
