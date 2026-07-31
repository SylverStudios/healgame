/**
 * Effective heal / mana for god-gamer scoring — includes armed synergies,
 * soon-to-arm triggers (mid-mend), potency buffs, and missing/full-HP rules.
 */

import type { CombatState, SpellDef, Unit } from '../combat/types';
import type { CombatMods } from '../data/talentTree';
import { busyMs, healPerManaMillis, healPerSecondMillis, isHealSpell, missingHp } from './heals';

/** Synergy bonusHeal that will apply when `spell` completes on a heal land. */
export function armedSynergyBonus(
  spellId: string,
  state: CombatState,
  loadout: CombatMods,
): number {
  if (!willBuffSpell(spellId, state, loadout)) return 0;
  let bonus = 0;
  for (const syn of loadout.synergies) {
    if (syn.buffedSpellId === spellId) bonus += syn.bonusHeal;
  }
  return bonus;
}

/**
 * True when `spellId` is already synergy-armed, or the active cast is a
 * trigger that will arm it the instant that cast completes (queue-ahead).
 */
export function willBuffSpell(
  spellId: string,
  state: CombatState,
  loadout: CombatMods,
): boolean {
  if (state.armedBuffedSpellIds.includes(spellId)) return true;
  const casting = state.playerCast?.spellId;
  if (!casting) return false;
  return loadout.synergies.some(
    (s) => s.triggerSpellId === casting && s.buffedSpellId === spellId,
  );
}

/** Mana synergies + nextSpellManaReduction that apply at cast start. */
export function effectiveManaCost(
  spell: SpellDef,
  state: CombatState,
  loadout: CombatMods,
): number {
  let cost = spell.mana;
  if (state.armedManaDiscountSpellIds.includes(spell.id)) {
    for (const ms of loadout.manaSynergies ?? []) {
      if (ms.targetSpellId === spell.id) cost += ms.manaDelta;
    }
  }
  // Mid-cast trigger that will arm a mana discount for this spell.
  const casting = state.playerCast?.spellId;
  if (casting) {
    for (const ms of loadout.manaSynergies ?? []) {
      if (ms.triggerSpellId === casting && ms.targetSpellId === spell.id) {
        cost += ms.manaDelta;
      }
    }
  }
  cost -= state.nextSpellManaReduction;
  return Math.max(0, cost);
}

/** Printed heal + armed synergy + missing/full bonuses + potency/stacks. */
export function effectiveHealAmount(
  spell: SpellDef,
  target: Unit,
  state: CombatState,
  loadout: CombatMods,
): number {
  if (!isHealSpell(spell)) return 0;
  const missing = missingHp(target);
  const bands = target.maxHp > 0 ? Math.floor((missing * 10) / target.maxHp) : 0;

  let missingFlat = 0;
  for (const mh of loadout.missingHealthBonuses) {
    if (mh.spellId === spell.id) missingFlat += mh.healPer10PctMissing * bands;
  }
  let missingPct = 0;
  for (const mp of loadout.missingHealthPctBonuses) {
    if (mp.spellId === spell.id) {
      missingPct += Math.ceil((spell.heal * mp.pctPer10PctMissing * bands) / 100);
    }
  }
  let full = 0;
  for (const fh of loadout.fullHealthBonuses) {
    if (fh.spellId === spell.id && target.hp * 100 >= fh.hpPctAtLeast * target.maxHp) {
      full += fh.bonusHeal;
    }
  }

  let potency = 0;
  if (state.nextHealPotencyPct > 0) {
    potency += Math.ceil((spell.heal * state.nextHealPotencyPct) / 100);
  }
  if (state.bonkHealStacks > 0) {
    const stackPct = bonkStackPct(loadout);
    potency += Math.ceil((spell.heal * state.bonkHealStacks * stackPct) / 100);
  }

  let cdBonus = 0;
  for (const cd of state.cooldowns) {
    if (cd.activeRemainingMs <= 0) continue;
    const def = loadout.cooldowns.find((d) => d.id === cd.id);
    if (def?.effect.kind === 'healBonus') cdBonus += def.effect.bonusHeal;
  }

  return (
    spell.heal +
    armedSynergyBonus(spell.id, state, loadout) +
    missingFlat +
    missingPct +
    full +
    potency +
    cdBonus
  );
}

function bonkStackPct(loadout: CombatMods): number {
  const bonk = loadout.spells.find((s) => s.id === 'bonk');
  const buff = bonk?.castBuff;
  if (buff?.kind === 'stackNextHealPotencyPct') return buff.pct;
  return 10;
}

export function effectiveHealPerMana(
  spell: SpellDef,
  target: Unit,
  state: CombatState,
  loadout: CombatMods,
): number {
  const heal = effectiveHealAmount(spell, target, state, loadout);
  const mana = effectiveManaCost(spell, state, loadout);
  if (mana <= 0) return heal > 0 ? Number.MAX_SAFE_INTEGER : 0;
  return Math.floor((heal * 1000) / mana);
}

export function effectiveHealPerSecond(
  spell: SpellDef,
  target: Unit,
  state: CombatState,
  loadout: CombatMods,
): number {
  const heal = effectiveHealAmount(spell, target, state, loadout);
  const busy = busyMs(spell);
  if (busy <= 0) return heal > 0 ? Number.MAX_SAFE_INTEGER : 0;
  return Math.floor((heal * 1000_000) / busy);
}

/** Whether any owned synergy can arm `buffedSpellId` via casting `triggerId`. */
export function canArmBuff(
  triggerId: string,
  buffedSpellId: string,
  loadout: CombatMods,
): boolean {
  return loadout.synergies.some(
    (s) => s.triggerSpellId === triggerId && s.buffedSpellId === buffedSpellId,
  );
}

// Re-export base scorers for call sites that only need printed numbers.
export { healPerManaMillis, healPerSecondMillis };
