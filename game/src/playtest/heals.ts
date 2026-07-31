/**
 * Shared heal scoring helpers for playtest bots (integer arithmetic only).
 */

import { GCD_MS } from '../data/constants';
import type { SpellDef, Unit } from '../combat/types';

/** Busy occupancy for HPS — cast time floors at the GCD. */
export function busyMs(spell: SpellDef): number {
  return Math.max(spell.castMs, GCD_MS);
}

/** Heal-per-mana × 1000 (integer). Higher = more efficient. */
export function healPerManaMillis(spell: SpellDef): number {
  if (spell.mana <= 0) return spell.heal > 0 ? Number.MAX_SAFE_INTEGER : 0;
  return Math.floor((spell.heal * 1000) / spell.mana);
}

/** Approximate HPS × 1000 (heal per busy-second, milli units). */
export function healPerSecondMillis(spell: SpellDef): number {
  const busy = busyMs(spell);
  if (busy <= 0) return spell.heal > 0 ? Number.MAX_SAFE_INTEGER : 0;
  return Math.floor((spell.heal * 1000_000) / busy);
}

export function isHealSpell(spell: SpellDef): boolean {
  return spell.heal > 0 && (spell.damage ?? 0) === 0;
}

export function isDamageFiller(spell: SpellDef): boolean {
  return (spell.damage ?? 0) > 0 && spell.heal === 0;
}

export function missingHp(unit: Unit): number {
  return Math.max(0, unit.maxHp - unit.hp);
}

/** Lowest current HP% among living party (dying counts). */
export function pickHealTarget(party: readonly Unit[]): Unit | undefined {
  const dying = party.find((u) => u.dying);
  if (dying) return dying;
  const injured = party
    .filter((u) => u.alive && missingHp(u) > 0)
    .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.maxHp - b.maxHp);
  return injured[0];
}

export function canAfford(healer: Unit, spell: SpellDef, freeHeal = false): boolean {
  return freeHeal || healer.mana >= spell.mana;
}

export function spellOffCd(
  spellId: string,
  spellCooldowns: readonly { spellId: string; remainingMs: number }[],
): boolean {
  const cd = spellCooldowns.find((c) => c.spellId === spellId);
  return (cd?.remainingMs ?? 0) <= 0;
}

/** HP below this fraction of max counts as "emergency" for god-gamer HPS mode. */
export const GOD_EMERGENCY_HP_PCT = 40;

export function isEmergency(target: Unit): boolean {
  if (target.dying) return true;
  return target.hp * 100 < target.maxHp * GOD_EMERGENCY_HP_PCT;
}
