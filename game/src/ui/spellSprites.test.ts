import { describe, expect, it } from 'vitest';
import { SPELLS } from '../data/constants';
import { COOLDOWNS } from '../data/cooldowns';
import {
  COOLDOWN_ICON_IDS,
  SPELL_ICON_IDS,
  cooldownIconTextureKey,
  cooldownIconTextureUrl,
  spellBarTextures,
  spellIconTextureKey,
  spellIconTextureUrl,
} from './spellSprites';

describe('spellSprites', () => {
  it('every icon id maps to a real catalog spell or cooldown id', () => {
    const spellIds = new Set<string>(Object.values(SPELLS).map((s) => s.id));
    const cooldownIds = new Set<string>(COOLDOWNS.map((c) => c.id));
    for (const id of SPELL_ICON_IDS) expect(spellIds.has(id)).toBe(true);
    for (const id of COOLDOWN_ICON_IDS) expect(cooldownIds.has(id)).toBe(true);
  });

  it('produces stable, distinct texture keys + URLs for spells and cooldowns', () => {
    for (const id of SPELL_ICON_IDS) {
      expect(spellIconTextureKey(id)).toBe(`spell-icon-${id}`);
      expect(spellIconTextureUrl(id)).toBe(`assets/ui/spell-icons/${id}.png`);
    }
    for (const id of COOLDOWN_ICON_IDS) {
      expect(cooldownIconTextureKey(id)).toBe(`cooldown-icon-${id}`);
      expect(cooldownIconTextureUrl(id)).toBe(`assets/ui/spell-icons/cd-${id}.png`);
    }
    // No collisions between spell and cooldown keys (e.g. same-named ids).
    const spellKeys = SPELL_ICON_IDS.map(spellIconTextureKey);
    const cooldownKeys = COOLDOWN_ICON_IDS.map(cooldownIconTextureKey);
    const allKeys = [...spellKeys, ...cooldownKeys];
    expect(new Set(allKeys).size).toBe(allKeys.length);
  });

  it('spellBarTextures covers every icon id plus the four framing-kit textures, no duplicate keys', () => {
    const textures = spellBarTextures();
    const keys = textures.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(textures.length).toBe(SPELL_ICON_IDS.length + COOLDOWN_ICON_IDS.length + 4);
    for (const id of SPELL_ICON_IDS) expect(keys).toContain(spellIconTextureKey(id));
    for (const id of COOLDOWN_ICON_IDS) expect(keys).toContain(cooldownIconTextureKey(id));
  });
});
