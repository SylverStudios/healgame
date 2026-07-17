/**
 * Relic glyph tints by role: grey = defense, red = offense, green = healing.
 * Presentation only — derived from effect kinds, not a save field.
 */

import type { RelicDef, RelicEffect } from '../combat/types';
import { relicById } from '../data/relics';

export type RelicColorRole = 'defense' | 'offense' | 'healing';

/** Green scale — healing / mana throughput. */
const HEALING_SCALE = [0x4caf50, 0x3d9b4a, 0x6bcf7a, 0x2e8b57] as const;
/** Red scale — damage / attack speed. */
const OFFENSE_SCALE = [0xc23b22, 0xe05a4e, 0xa33a2e, 0xd4685c] as const;
/** Grey scale — armor / max HP. */
const DEFENSE_SCALE = [0xa0a0a0, 0x7a7a7a, 0xb8b8b8, 0x5e5e5e] as const;

const SCALE: Record<RelicColorRole, readonly number[]> = {
  healing: HEALING_SCALE,
  offense: OFFENSE_SCALE,
  defense: DEFENSE_SCALE,
};

/** Offense wins ties with HP on hybrids (e.g. Warblood Gem). */
export function relicColorRole(effects: readonly RelicEffect[]): RelicColorRole {
  let healing = false;
  let offense = false;
  for (const effect of effects) {
    switch (effect.kind) {
      case 'bonusHealing':
      case 'manaRegen':
      case 'bonusMaxMana':
        healing = true;
        break;
      case 'roleAutoDamage':
      case 'roleSwingInterval':
        offense = true;
        break;
      default:
        break;
    }
  }
  if (healing) return 'healing';
  if (offense) return 'offense';
  return 'defense';
}

function shadeIndex(id: string, count: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % count;
}

/** Phaser fill color for a relic glyph / accent. */
export function relicGlyphColor(relic: RelicDef): number {
  const role = relicColorRole(relic.effects);
  const palette = SCALE[role];
  return palette[shadeIndex(relic.id, palette.length)]!;
}

/** Look up by id (run-mod bar); unknown ids fall back to mid grey. */
export function relicGlyphColorById(relicId: string): number {
  const relic = relicById(relicId);
  if (!relic) return DEFENSE_SCALE[1]!;
  return relicGlyphColor(relic);
}

/** CSS hex for Phaser text `color` (e.g. RelicScene name). */
export function relicGlyphColorCss(relic: RelicDef): string {
  return `#${relicGlyphColor(relic).toString(16).padStart(6, '0')}`;
}
