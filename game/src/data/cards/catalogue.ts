/**
 * Pure view-model for the Cards-mode content Catalogue (Settings → Catalogue).
 *
 * Aggregates every cards unlock (spells + major CDs) and every authored chip
 * so a single scene can review the full catalog without owning a save.
 * Texture keys stay in the scene / ui layer — this module only carries
 * iconAssetId + art prompts from iconPrompts.ts.
 */

import type { SpellDef, CooldownDef } from '../../combat/types';
import { radialSpellById } from '../radial/spells';
import { cooldownById, COOLDOWN_SET_A_IDS, COOLDOWN_SET_B_IDS } from '../cooldowns';
import { CARD_UNLOCKS } from './unlocks';
import { CARD_CHIPS, type CardChipDef, type CardChipEffect } from './chips';
import { iconArtFor } from './iconPrompts';

export type CatalogueSection = 'spells' | 'chips';

export interface CatalogueIconView {
  /** Asset id for a shipped spell/cooldown PNG, if any. */
  iconAssetId: string | null;
  iconKind: 'spell' | 'cooldown' | null;
  /** Art prompt for generating / regenerating the icon (null if none authored). */
  prompt: string | null;
}

export interface CatalogueSpellEntry {
  kind: 'spell' | 'cooldown';
  id: string;
  name: string;
  description: string;
  glyph: string;
  /** Unlock level from CARD_UNLOCKS. */
  minLevel: number;
  /** Compact combat stats for review. */
  stats: string[];
  icon: CatalogueIconView;
  /** Chip ids authored for this spell (empty for cooldowns). */
  chipIds: readonly string[];
}

export interface CatalogueChipEntry {
  chip: CardChipDef;
  spellName: string;
  /** Slot label for UI ("Slot 1" / "Slot 2"). */
  slotLabel: string;
  /** Human-readable effect lines. */
  effectLines: string[];
  icon: CatalogueIconView;
}

function resolveIcon(id: string): CatalogueIconView {
  const meta = iconArtFor(id);
  return {
    iconAssetId: meta?.iconAssetId ?? null,
    iconKind: meta?.iconKind ?? null,
    prompt: meta?.iconPrompt ?? null,
  };
}

function spellStats(spell: SpellDef): string[] {
  const lines: string[] = [];
  if (spell.heal > 0) lines.push(`Heal ${spell.heal}`);
  if ((spell.damage ?? 0) > 0) lines.push(`Damage ${spell.damage}`);
  lines.push(`Mana ${spell.mana}`);
  lines.push(spell.castMs === 0 ? 'Instant' : `Cast ${(spell.castMs / 1000).toFixed(1)}s`);
  if (spell.cooldownMs && spell.cooldownMs > 0) {
    lines.push(`CD ${(spell.cooldownMs / 1000).toFixed(0)}s`);
  }
  if (spell.manaOnHit) lines.push(`Mana on hit +${spell.manaOnHit}`);
  if (spell.castBuff) lines.push(`Cast buff: ${spell.castBuff.kind}`);
  return lines;
}

function cooldownStats(cd: CooldownDef): string[] {
  return [`CD ${(cd.cooldownMs / 1000).toFixed(0)}s`, `Effect: ${cd.effect.kind}`];
}

/** Format one chip effect for the catalogue (dev-facing, not player copy). */
export function formatChipEffect(effect: CardChipEffect): string {
  switch (effect.kind) {
    case 'castMod': {
      const parts: string[] = [`castMod → ${effect.spellId}`];
      if (effect.healDelta) parts.push(`heal${fmtDelta(effect.healDelta)}`);
      if (effect.damageDelta) parts.push(`dmg${fmtDelta(effect.damageDelta)}`);
      if (effect.manaDelta) parts.push(`mana${fmtDelta(effect.manaDelta)}`);
      if (effect.castMsDelta) parts.push(`castMs${fmtDelta(effect.castMsDelta)}`);
      if (effect.cooldownMsDelta) parts.push(`cdMs${fmtDelta(effect.cooldownMsDelta)}`);
      return parts.join(' ');
    }
    case 'synergy':
      return `synergy ${effect.triggerSpellId} → ${effect.buffedSpellId} heal+${effect.bonusHeal}`;
    case 'manaSynergy':
      return `manaSynergy ${effect.triggerSpellId} → ${effect.targetSpellId} mana${fmtDelta(effect.manaDelta)}`;
    case 'missingHealthBonus':
      return `missingHP ${effect.spellId} +${effect.healPer10PctMissing}/10%`;
    case 'missingHealthPctBonus':
      return `missingHP% ${effect.spellId} +${effect.pctPer10PctMissing}%/10%`;
    case 'fullHealthBonus':
      return `fullHP ${effect.spellId} (≥${effect.hpPctAtLeast}%) heal+${effect.bonusHeal}`;
    case 'setManaOnHit':
      return `manaOnHit ${effect.spellId} = ${effect.amount}`;
    case 'setCastBuff':
      return `castBuff ${effect.spellId}: ${effect.castBuff.kind}`;
    default: {
      const _exhaustive: never = effect;
      return String(_exhaustive);
    }
  }
}

function fmtDelta(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/** Every cards-mode spell + major CD (Set A @6 / Set B @8), review order. */
export function catalogueSpells(): CatalogueSpellEntry[] {
  const spells = CARD_UNLOCKS.filter((u) => u.kind === 'spell').map((unlock) => {
    const icon = resolveIcon(unlock.id);
    const spell = radialSpellById(unlock.id);
    const chipIds = CARD_CHIPS.filter((c) => c.spellId === unlock.id).map((c) => c.id);
    return {
      kind: 'spell' as const,
      id: unlock.id,
      name: spell?.name ?? unlock.id,
      description: spell?.description ?? '',
      glyph: spell?.glyph ?? '?',
      minLevel: unlock.minLevel,
      stats: spell ? spellStats(spell) : [],
      icon,
      chipIds,
    };
  });

  const cooldownRows: { id: string; minLevel: number }[] = [
    ...COOLDOWN_SET_A_IDS.map((id) => ({ id, minLevel: 6 })),
    ...COOLDOWN_SET_B_IDS.map((id) => ({ id, minLevel: 8 })),
  ];
  const cooldowns = cooldownRows.map(({ id, minLevel }) => {
    const cd = cooldownById(id);
    return {
      kind: 'cooldown' as const,
      id,
      name: cd?.name ?? id,
      description: cd?.description ?? '',
      glyph: cd?.glyph ?? '?',
      minLevel,
      stats: cd ? cooldownStats(cd) : [],
      icon: resolveIcon(id),
      chipIds: [] as readonly string[],
    };
  });

  return [...spells, ...cooldowns];
}

/** Every authored chip, catalog order, with spell name + effect lines. */
export function catalogueChips(): CatalogueChipEntry[] {
  return CARD_CHIPS.map((chip) => {
    const spell = radialSpellById(chip.spellId);
    return {
      chip,
      spellName: spell?.name ?? chip.spellId,
      slotLabel: `Slot ${chip.slotIndex + 1}`,
      effectLines: chip.effects.map(formatChipEffect),
      icon: resolveIcon(chip.id),
    };
  });
}

/** Chips grouped by spellId then slot — for the Chips tab layout. */
export function catalogueChipsGrouped(): {
  spellId: string;
  spellName: string;
  slots: { slotIndex: 0 | 1; chips: CatalogueChipEntry[] }[];
}[] {
  const all = catalogueChips();
  const spellOrder = CARD_UNLOCKS.filter((u) => u.kind === 'spell').map((u) => u.id);
  return spellOrder
    .map((spellId) => {
      const forSpell = all.filter((e) => e.chip.spellId === spellId);
      if (forSpell.length === 0) return null;
      const spellName = forSpell[0]!.spellName;
      const slots: { slotIndex: 0 | 1; chips: CatalogueChipEntry[] }[] = [];
      for (const slotIndex of [0, 1] as const) {
        const chips = forSpell.filter((e) => e.chip.slotIndex === slotIndex);
        if (chips.length > 0) slots.push({ slotIndex, chips });
      }
      return { spellId, spellName, slots };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);
}
