/**
 * Cooldown data (Alpha 0.1 §D6 — first major CDs). All numbers live here;
 * gameplay rules/interactions are documented in combat/README.md and encoded
 * in combat/engine.ts (activateCooldown, effectiveManaCost, beginCast).
 */

import type { CooldownDef } from '../combat/types';

/** Vigil CD: arms a free-heal charge, consumed by the next cast that starts (OOM panic button). */
export const STILL_WATERS: CooldownDef = {
  id: 'still-waters',
  name: 'Still Waters',
  description: 'Next completed heal costs no mana.',
  cooldownMs: 60_000,
  effect: { kind: 'freeNextHeal' },
};

/** Zealot CD: a 30s tempo window, followed by 10s of recovery before reuse. */
export const FRENZIED_LITURGY: CooldownDef = {
  id: 'frenzied-liturgy',
  name: 'Frenzied Liturgy',
  description: 'For 30s, heals cost 1 less mana.',
  cooldownMs: 40_000,
  effect: { kind: 'manaCostReduction', durationMs: 30_000, costReduction: 1 },
};

export const COOLDOWNS: CooldownDef[] = [STILL_WATERS, FRENZIED_LITURGY];

export function cooldownById(id: string): CooldownDef | undefined {
  return COOLDOWNS.find((c) => c.id === id);
}
