/**
 * Slot-card spell info model + pure builders.
 * Shared by combat SpellBar tooltips and talent-tree grantSpell nodes so the
 * player learns one layout: name → effect band → cost/cast/cd → description.
 */

import type { SpellDef } from '../combat/types';
import type { CombatMods } from '../data/talentTree';
import { spellById } from '../data/spells';
import { manaCostDigits } from './manaAffordance';

export type SpellEffectTone = 'heal' | 'damage';

/** Structured spell panel content (layout A — slot card). */
export interface SpellCardModel {
  /** Optional line above the spell name (e.g. talent unlock meta). */
  eyebrow: string | null;
  name: string;
  effect: string;
  effectTone: SpellEffectTone;
  /** Mana cost digits only; UI draws the blue orb (never `Nm` / `(m)`). */
  cost: string;
  cast: string;
  /** Null → UI shows an em-dash so the CD slot never jumps. */
  cooldown: string | null;
  description: string | null;
  /** Cast-buff notes + loadout synergies (gold accent). */
  notes: string[];
}

export interface BuildSpellCardOptions {
  loadout?: CombatMods;
  /** Overrides SpellDef.description when set (talent flavor, etc.). */
  description?: string | null;
  eyebrow?: string | null;
  /**
   * Sum of all relic `bonusHealing` effects active this fight. Folded into the
   * combined (+N) on heal spells. Pass 0 or omit when no relics apply.
   */
  bonusHealing?: number;
  /**
   * Override for the catalog base heal value (talent-baked delta fallback).
   * When omitted, the catalog is queried by spell id via spellById(). Supply
   * this when the caller already has the catalog value to avoid a second lookup.
   */
  catalogHeal?: number;
  /**
   * Sum of flat heal bonuses that are unconditionally active right now: open
   * healBonus CD windows + bonusHeal of every armed synergy targeting this
   * spell. NOT for target-conditional bonuses (missing/full-health).
   */
  activeFlatHealBonus?: number;
  /**
   * Live combat buff lines to append after the static/loadout notes (gold
   * accent). Wave 6 R3: active Bonk castBuff state (Blessed stacks, armed
   * next-heal potency, pending next-spell mana discount). Empty/omit outside
   * combat (tree unlock cards).
   */
  liveBuffNotes?: readonly string[];
}

function formatCast(castMs: number): string {
  return castMs === 0 ? 'Instant' : `${(castMs / 1000).toFixed(1)}s`;
}

function formatCooldown(cooldownMs: number | undefined): string | null {
  if (!cooldownMs || cooldownMs <= 0) return null;
  return `${(cooldownMs / 1000).toFixed(0)}s`;
}

/**
 * Combined flat bonus to show in the parenthetical: relic bonusHealing +
 * talent-baked delta (loadout heal minus catalog base) + active flat buffs.
 * Returns 0 for damage spells (bonus is irrelevant to the damage line).
 */
function combinedHealBonus(spell: SpellDef, options: BuildSpellCardOptions): number {
  if ((spell.damage ?? 0) > 0 || spell.heal <= 0) return 0;
  const relicBonus = options.bonusHealing ?? 0;
  const catalogBase = options.catalogHeal ?? spellById(spell.id)?.heal ?? spell.heal;
  const talentBaked = Math.max(0, spell.heal - catalogBase);
  const activeFlat = options.activeFlatHealBonus ?? 0;
  return relicBonus + talentBaked + activeFlat;
}

function effectLine(spell: SpellDef, options: BuildSpellCardOptions): { text: string; tone: SpellEffectTone } {
  if ((spell.damage ?? 0) > 0) {
    return { text: `Damage front ${spell.damage}`, tone: 'damage' };
  }
  // Always show catalog base heal; talent-baked deltas fold into (+N).
  const catalogBase = options.catalogHeal ?? spellById(spell.id)?.heal ?? spell.heal;
  const bonus = combinedHealBonus(spell, options);
  const bonusStr = bonus > 0 ? ` (+${bonus})` : '';
  return { text: `Heal target ${catalogBase}${bonusStr}`, tone: 'heal' };
}

function spellName(id: string, loadout: CombatMods): string {
  return loadout.spells.find((s) => s.id === id)?.name ?? spellById(id)?.name ?? id;
}

function castBuffNotes(spell: SpellDef): string[] {
  if (spell.castBuff?.kind === 'nextSpellManaReduction') {
    return [`Next spell costs ${spell.castBuff.amount} less mana`];
  }
  if (spell.castBuff?.kind === 'nextHealPotencyPct') {
    return [`Next heal +${spell.castBuff.pct}% potency`];
  }
  if (spell.castBuff?.kind === 'stackNextHealPotencyPct') {
    return [`Each hit stacks +${spell.castBuff.pct}% next heal (cap ${spell.castBuff.cap})`];
  }
  return [];
}

function loadoutNotes(spell: SpellDef, loadout: CombatMods): string[] {
  const notes: string[] = [];
  for (const synergy of loadout.synergies) {
    if (synergy.buffedSpellId === spell.id) {
      notes.push(
        `+${synergy.bonusHeal} heal when armed by ${spellName(synergy.triggerSpellId, loadout)}`,
      );
    }
  }
  for (const synergy of loadout.synergies) {
    if (synergy.triggerSpellId === spell.id) {
      notes.push(
        `Arms +${synergy.bonusHeal} on your next ${spellName(synergy.buffedSpellId, loadout)}`,
      );
    }
  }
  for (const bonus of loadout.missingHealthBonuses) {
    if (bonus.spellId === spell.id) {
      notes.push(`+${bonus.healPer10PctMissing} per 10% target health missing`);
    }
  }
  for (const bonus of loadout.missingHealthPctBonuses) {
    if (bonus.spellId === spell.id) {
      notes.push(`+${bonus.pctPer10PctMissing}% base per 10% target health missing`);
    }
  }
  for (const bonus of loadout.fullHealthBonuses) {
    if (bonus.spellId === spell.id) {
      notes.push(`+${bonus.bonusHeal} heal when target at ${bonus.hpPctAtLeast}%+ hp`);
    }
  }
  return notes;
}

/** Builds the slot-card model for one spell (combat hover or tree unlock). */
export function buildSpellCard(spell: SpellDef, options: BuildSpellCardOptions = {}): SpellCardModel {
  const { text: effect, tone: effectTone } = effectLine(spell, options);
  const description =
    options.description !== undefined ? options.description : (spell.description ?? null);
  const notes = [
    ...castBuffNotes(spell),
    ...(options.loadout ? loadoutNotes(spell, options.loadout) : []),
    ...(options.liveBuffNotes ?? []),
  ];

  return {
    eyebrow: options.eyebrow ?? null,
    name: spell.name,
    effect,
    effectTone,
    cost: manaCostDigits(spell.mana),
    cast: formatCast(spell.castMs),
    cooldown: formatCooldown(spell.cooldownMs),
    description: description && description.length > 0 ? description : null,
    notes,
  };
}
