import { describe, expect, it } from 'vitest';
import { PORTRAIT_UNIT_IDS, portraitTextureKey, portraitTextureUrl, portraitTextures } from './portraitSprites';

describe('portraitSprites', () => {
  it('covers healer + tank (BanterSpeaker values) plus both DPS slots', () => {
    expect(PORTRAIT_UNIT_IDS).toEqual(['healer', 'tank', 'dps1', 'dps2']);
  });

  it('produces stable, distinct texture keys + URLs', () => {
    for (const id of PORTRAIT_UNIT_IDS) {
      expect(portraitTextureKey(id)).toBe(`portrait-${id}`);
      expect(portraitTextureUrl(id)).toBe(`assets/units/portraits/${id}.png`);
    }
    const keys = PORTRAIT_UNIT_IDS.map(portraitTextureKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('portraitTextures covers every unit id, no duplicate keys', () => {
    const textures = portraitTextures();
    expect(textures.length).toBe(PORTRAIT_UNIT_IDS.length);
    const keys = textures.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const id of PORTRAIT_UNIT_IDS) {
      expect(keys).toContain(portraitTextureKey(id));
    }
  });
});
