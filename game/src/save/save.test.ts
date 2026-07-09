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

/** A well-formed v1 payload as Phase 1 wrote it. */
function v1Payload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 1,
    tutorialDone: true,
    gold: 7,
    xp: 12,
    rubies: 1,
    unlockedSpells: ['solemn-mend', 'zealous-mending'],
    treeNodes: [],
    subclass: null,
    clearedDungeons: ['ash-gate'],
    ...overrides,
  });
}

describe('save', () => {
  it('returns a fresh save when nothing is stored', () => {
    const save = loadSave(memoryStore());
    expect(save).toEqual(newSaveData());
    expect(save.version).toBe(2);
    expect(save.tutorialDone).toBe(false);
    expect(save.subclass).toBeNull();
  });

  it('round-trips a full v2 save', () => {
    const store = memoryStore();
    const data: SaveData = {
      version: 2,
      tutorialDone: true,
      gold: 7,
      xp: 12,
      rubies: 0,
      unlockedSpells: ['solemn-mend', 'zealous-mending'],
      treeRanks: { 'deep-reserves': 3, 'vigil-oath': 1 },
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

  it('falls back to a fresh save on corrupt or unknown data', () => {
    const store = memoryStore();
    store.setItem('healgame-save-v1', '{not json');
    expect(loadSave(store)).toEqual(newSaveData());
    store.setItem('healgame-save-v1', JSON.stringify({ version: 99 }));
    expect(loadSave(store)).toEqual(newSaveData());
    store.setItem('healgame-save-v1', JSON.stringify({ version: 2, treeRanks: 'nope' }));
    expect(loadSave(store)).toEqual(newSaveData());
  });

  it('works without any storage (SSR/tests)', () => {
    expect(loadSave(null)).toEqual(newSaveData());
    expect(() => saveGame(newSaveData(), null)).not.toThrow();
    expect(() => resetSave(null)).not.toThrow();
  });
});

describe('v1 → v2 migration', () => {
  it('carries plain progress over losslessly', () => {
    const store = memoryStore();
    store.setItem('healgame-save-v1', v1Payload());
    const save = loadSave(store);
    expect(save.version).toBe(2);
    expect(save.tutorialDone).toBe(true);
    expect(save.gold).toBe(7);
    expect(save.xp).toBe(12);
    expect(save.rubies).toBe(1);
    expect(save.unlockedSpells).toEqual(['solemn-mend', 'zealous-mending']);
    expect(save.treeRanks).toEqual({});
    expect(save.subclass).toBeNull();
    expect(save.clearedDungeons).toEqual(['ash-gate']);
  });

  it("maps 'max-mana-1' to deep-reserves rank 1", () => {
    const store = memoryStore();
    store.setItem('healgame-save-v1', v1Payload({ treeNodes: ['max-mana-1'] }));
    expect(loadSave(store).treeRanks).toEqual({ 'deep-reserves': 1 });
  });

  it('refunds 5 gold per retired branch node', () => {
    const store = memoryStore();
    store.setItem(
      'healgame-save-v1',
      v1Payload({ gold: 2, treeNodes: ['vigil-deep-focus', 'zealot-battle-fervor'] }),
    );
    const save = loadSave(store);
    expect(save.gold).toBe(12);
    expect(save.treeRanks).toEqual({});
  });

  it('maps an existing subclass to owning its oath node at rank 1, no extra ruby charge', () => {
    const store = memoryStore();
    store.setItem('healgame-save-v1', v1Payload({ subclass: 'zealot', rubies: 0 }));
    const save = loadSave(store);
    expect(save.subclass).toBe('zealot');
    expect(save.treeRanks['zealot-oath']).toBe(1);
    expect(save.rubies).toBe(0);
  });

  it('handles the full Phase-1 endgame save in one shot', () => {
    const store = memoryStore();
    store.setItem(
      'healgame-save-v1',
      v1Payload({
        gold: 3,
        subclass: 'vigil',
        treeNodes: ['max-mana-1', 'vigil-deep-focus'],
      }),
    );
    const save = loadSave(store);
    expect(save.gold).toBe(8); // 3 + 5 refund
    expect(save.treeRanks).toEqual({ 'deep-reserves': 1, 'vigil-oath': 1 });
    expect(save.subclass).toBe('vigil');
  });

  it('persists the migrated save back to the store immediately', () => {
    const store = memoryStore();
    store.setItem('healgame-save-v1', v1Payload({ treeNodes: ['max-mana-1'] }));
    const migrated = loadSave(store);
    const raw = store.getItem('healgame-save-v1');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw ?? '')).toEqual(migrated);
  });
});
