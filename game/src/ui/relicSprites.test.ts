import { describe, expect, it } from 'vitest';
import { RELICS } from '../data/relics';
import { RELIC_TEXTURE_IDS, relicTextureKey, relicTextureUrl } from './relicSprites';

describe('relicSprites', () => {
  it('covers every catalog relic with a stable texture key + URL', () => {
    expect(RELIC_TEXTURE_IDS).toEqual(RELICS.map((r) => r.id));
    for (const id of RELIC_TEXTURE_IDS) {
      expect(relicTextureKey(id)).toBe(`relic-${id}`);
      expect(relicTextureUrl(id)).toBe(`assets/relics/${id}.png`);
    }
  });
});
