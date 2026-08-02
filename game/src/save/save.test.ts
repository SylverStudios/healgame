import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  LEGACY_SAVE_KEYS,
  loadSave,
  newSaveData,
  resetSave,
  resetSaveToMode,
  SAVE_KEY,
  SAVE_SCHEMA,
  saveGame,
  validateSaveData,
  type KeyValueStore,
  type SaveData,
} from './save';
import { SPELLS } from '../data/constants';
import { RADIAL_BONK, RADIAL_HEAL } from '../data/radial/spells';
import saveVersion from './save-version.json';

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
  it('SAVE_KEY and SAVE_SCHEMA derive from save-version.json', () => {
    expect(SAVE_SCHEMA).toBe(saveVersion.schema);
    expect(SAVE_KEY).toBe(`healgame-save-v${SAVE_SCHEMA}`);
  });

  it('returns a fresh cards save when nothing is stored', () => {
    const save = loadSave(memoryStore());
    expect(save).toEqual(newSaveData());
    expect(save).toEqual({
      version: SAVE_SCHEMA,
      progressionMode: 'cards',
      tutorialDone: false,
      xp: 0,
      unlockedSpells: [RADIAL_HEAL.id, RADIAL_BONK.id],
      actionBar: [RADIAL_BONK.id, RADIAL_HEAL.id, '', ''],
      treeRanks: {},
      talentPointsEarned: 0,
      subclass: null,
      clearedDungeons: [],
      combatPaceTenths: 10,
      relicIds: [],
      pendingRelicOffers: [],
      upgradePoints: 0,
      spellChips: {},
      secondaryRanks: {},
      chosenCooldownIds: [],
      pendingUpgradePicks: 0,
      musicVolumePct: 50,
      recentRuns: [],
    });
    expect(save).not.toHaveProperty('gold');
    expect(save).not.toHaveProperty('rubies');
  });

  it('radial newSaveData prepurchases Bonk on Q + Heal on W', () => {
    const save = newSaveData('radial');
    expect(save.progressionMode).toBe('radial');
    expect(save.unlockedSpells).toEqual([RADIAL_HEAL.id, RADIAL_BONK.id]);
    expect(save.actionBar).toEqual([RADIAL_BONK.id, RADIAL_HEAL.id, '', '']);
    expect(save.treeRanks).toEqual({ heal: 1, bonk: 1 });
    expect(save.upgradePoints).toBe(0);
    expect(save.spellChips).toEqual({});
    expect(save.secondaryRanks).toEqual({});
    expect(save.chosenCooldownIds).toEqual([]);
    expect(save.pendingUpgradePicks).toBe(0);
  });

  it('cards newSaveData starts Heal+Bonk with 0 upgrade points', () => {
    const save = newSaveData('cards');
    expect(save.progressionMode).toBe('cards');
    expect(save.unlockedSpells).toEqual([RADIAL_HEAL.id, RADIAL_BONK.id]);
    expect(save.actionBar).toEqual([RADIAL_BONK.id, RADIAL_HEAL.id, '', '']);
    expect(save.treeRanks).toEqual({});
    expect(save.upgradePoints).toBe(0);
    expect(save.spellChips).toEqual({});
    expect(save.relicIds).toEqual([]);
    expect(save.pendingRelicOffers).toEqual([]);
    expect(save.secondaryRanks).toEqual({});
    expect(save.chosenCooldownIds).toEqual([]);
    expect(save.pendingUpgradePicks).toBe(0);
  });

  it('lattice newSaveData still starts Bonk-only classic kit', () => {
    const save = newSaveData('lattice');
    expect(save.progressionMode).toBe('lattice');
    expect(save.unlockedSpells).toEqual([SPELLS.bonk.id]);
    expect(save.actionBar).toEqual([SPELLS.bonk.id, '', '', '']);
  });

  it('round-trips a full save', () => {
    const store = memoryStore();
    const data: SaveData = {
      version: SAVE_SCHEMA,
      progressionMode: 'lattice',
      tutorialDone: true,
      xp: 42,
      unlockedSpells: [SPELLS.bonk.id, 'solemn-mend', 'zealous-mending'],
      actionBar: [SPELLS.bonk.id, 'solemn-mend', '', ''],
      treeRanks: { 'deep-reserves': 3, 'vigil-oath': 1 },
      talentPointsEarned: 3,
      subclass: 'vigil',
      clearedDungeons: ['ash-gate'],
      combatPaceTenths: 15,
      relicIds: ['ember-ledger', 'triage-bell'],
      pendingRelicOffers: ['still-reservoir', 'vital-ember', 'bastion-plate'],
      upgradePoints: 0,
      spellChips: {},
      secondaryRanks: { haste: 2 },
      chosenCooldownIds: ['still-waters'],
      pendingUpgradePicks: 1,
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
    for (const key of LEGACY_SAVE_KEYS) {
      store.setItem(key, JSON.stringify({ version: 0, xp: 999 }));
    }
    expect(loadSave(store)).toEqual(newSaveData());
    for (const key of LEGACY_SAVE_KEYS) {
      expect(store.getItem(key)).toBeNull();
    }
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

    const cards = resetSaveToMode('cards', store);
    expect(cards.progressionMode).toBe('cards');
    expect(cards.upgradePoints).toBe(0);
    expect(loadSave(store).progressionMode).toBe('cards');
  });

  it('discards unrecognized payloads', () => {
    const store = memoryStore();
    storePayload(store, { version: SAVE_SCHEMA, xp: 'nope' });
    expect(loadSave(store)).toEqual(newSaveData());
  });

  it('golden fixture and newSaveData pass validateSaveData', () => {
    const raw = readFileSync(new URL('./fixtures/golden-save.json', import.meta.url), 'utf8');
    const fixture: unknown = JSON.parse(raw);
    expect(validateSaveData(fixture)).toBe(true);
    expect(validateSaveData(newSaveData('lattice'))).toBe(true);
  });
});
