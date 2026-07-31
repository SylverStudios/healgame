import { describe, expect, it } from 'vitest';
import { CARD_CHIPS } from './chips';
import { CARD_UNLOCKS } from './unlocks';
import {
  catalogueChips,
  catalogueChipsGrouped,
  catalogueSpells,
  formatChipEffect,
} from './catalogue';
import { CARD_ICON_ART, iconArtFor } from './iconPrompts';

describe('cards catalogue', () => {
  it('lists every CARD_UNLOCKS spell plus Set A/B cooldowns', () => {
    const entries = catalogueSpells();
    const spellIds = CARD_UNLOCKS.filter((u) => u.kind === 'spell').map((u) => u.id);
    expect(entries.filter((e) => e.kind === 'spell').map((e) => e.id)).toEqual(spellIds);
    expect(entries.some((e) => e.kind === 'spell')).toBe(true);
    expect(entries.some((e) => e.kind === 'cooldown')).toBe(true);
    expect(entries.filter((e) => e.kind === 'cooldown').map((e) => e.id)).toEqual([
      'still-waters',
      'wrath-ascendant',
      'frenzied-liturgy',
      'iron-canticle',
      'mercy-reserve',
      'ashen-rite',
    ]);
  });

  it('attaches authored chips to their spell entries', () => {
    const heal = catalogueSpells().find((e) => e.id === 'heal');
    expect(heal?.chipIds.length).toBeGreaterThanOrEqual(6);
    for (const id of heal!.chipIds) {
      expect(CARD_CHIPS.some((c) => c.id === id && c.spellId === 'heal')).toBe(true);
    }
  });

  it('lists every CARD_CHIPS entry once', () => {
    const chips = catalogueChips();
    expect(chips.map((c) => c.chip.id)).toEqual(CARD_CHIPS.map((c) => c.id));
  });

  it('groups chips by spell then slot', () => {
    const groups = catalogueChipsGrouped();
    expect(groups.map((g) => g.spellId)).toEqual(
      CARD_UNLOCKS.filter((u) => u.kind === 'spell').map((u) => u.id),
    );
    for (const group of groups) {
      for (const slot of group.slots) {
        expect(slot.chips.every((c) => c.chip.slotIndex === slot.slotIndex)).toBe(true);
        expect(slot.chips.every((c) => c.chip.spellId === group.spellId)).toBe(true);
      }
    }
  });

  it('surfaces icon prompts for entries that have them', () => {
    const heal = catalogueSpells().find((e) => e.id === 'heal');
    expect(heal?.icon.prompt).toBeTruthy();
    const still = catalogueSpells().find((e) => e.id === 'still-waters');
    expect(still?.icon.iconAssetId).toBe('still-waters');
    expect(still?.icon.iconKind).toBe('cooldown');
    expect(still?.icon.prompt).toContain('chalice');
  });

  it('iconArtFor covers every CARD_ICON_ART id', () => {
    for (const entry of CARD_ICON_ART) {
      expect(iconArtFor(entry.id)).toEqual(entry);
    }
  });

  it('formatChipEffect covers every authored effect kind', () => {
    for (const chip of CARD_CHIPS) {
      for (const effect of chip.effects) {
        expect(formatChipEffect(effect).length).toBeGreaterThan(0);
      }
    }
  });
});
