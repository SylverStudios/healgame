/**
 * PixelLab relic icons (64×64). Presentation-only — gameplay lives in
 * data/relics.ts. BootScene preloads every catalog id; UI falls back to the
 * colored circle glyph when a texture is missing.
 */

import { RELICS } from '../data/relics';

/** Native canvas size for every relic PNG under public/assets/relics/. */
export const RELIC_TEXTURE_SIZE = 64;

/** Phaser texture key for a catalog relic id (`ember-ledger` → `relic-ember-ledger`). */
export function relicTextureKey(relicId: string): string {
  return `relic-${relicId}`;
}

/** Public URL for a catalog relic still. */
export function relicTextureUrl(relicId: string): string {
  return `assets/relics/${relicId}.png`;
}

/** Every catalog relic id that ships a PixelLab still (preload list). */
export const RELIC_TEXTURE_IDS: readonly string[] = RELICS.map((relic) => relic.id);
