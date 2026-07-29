/**
 * Radial save → CombatMods + purchase helpers.
 *
 * Chunk 1 replaces the Chunk 0 stub with:
 *   - treeStateFromRadialSave — builds TreeState from treeRanks + xp
 *   - resolveRadialCombatMods — owned tree contents + unlockedSpells → CombatMods
 *   - applyRadialPurchase    — mutates save after a tree node purchase
 *   - loadoutFromRadialSave  — canonical entry point (treeRanks + unlockedSpells + xp)
 */

import { levelForXp } from '../constants';
import { cooldownById } from '../cooldowns';
import { manaBonusesForLevel } from '../levelMana';
import { spellsFromActionBar, type CombatMods } from '../talentTree';
import {
  RADIAL_FREE_SPOT_IDS,
  RADIAL_TREE,
  RADIAL_CHOICE_TABLE,
  type RadialTreeContent,
  type RadialTreeEffect,
} from './tree';
import { radialSpellById } from './spells';
import type { SpellDef, SynergyRule, MissingHealthBonusRule, CooldownDef } from '../../combat/types';
import { create, update, snapshot, ownedContents } from '../../tree';
import type { TreeState } from '../../tree';

// ---------------------------------------------------------------------------
// Tree state bridge
// ---------------------------------------------------------------------------

/**
 * Reconstruct radial TreeState from persisted treeRanks + player xp.
 * In radial, every spot is single-rank, so spotId === nodeId.
 */
export function treeStateFromRadialSave(
  treeRanks: Record<string, number>,
  xp: number,
): TreeState {
  const owned = Object.keys(treeRanks).filter((id) => (treeRanks[id] ?? 0) > 0);

  // Talent points earned = level; free starter spots don't consume points.
  const level = levelForXp(xp);
  const paidCount = owned.filter((id) => !RADIAL_FREE_SPOT_IDS.has(id)).length;
  const available = Math.max(0, level - paidCount);

  return create(RADIAL_TREE, { talent: available }, owned);
}

/** Write owned radial node ids back to a treeRanks-shaped record. */
export function radialRanksFromOwned(owned: readonly string[]): Record<string, number> {
  const ranks: Record<string, number> = {};
  for (const id of owned) ranks[id] = 1;
  return ranks;
}

// ---------------------------------------------------------------------------
// CombatMods resolver
// ---------------------------------------------------------------------------

/**
 * Owned tree contents + unlockedSpells → flat CombatMods.
 * Does NOT apply level mana or actionBar filtering — the caller handles those.
 */
export function resolveRadialCombatMods(
  contents: readonly RadialTreeContent[],
  unlockedSpells: readonly string[],
): CombatMods {
  // Spell list comes from unlockedSpells (authoritative after specialize ops).
  const spells: SpellDef[] = unlockedSpells
    .map((id) => radialSpellById(id))
    .filter((s): s is SpellDef => s !== undefined)
    .map((s) => ({ ...s }));

  const synergyMap = new Map<string, SynergyRule>();
  const missingMap = new Map<string, MissingHealthBonusRule>();
  const cooldownMap = new Map<string, CooldownDef>();
  let bonusMaxMana = 0;

  // Collect non-spell effects from owned tree contents.
  for (const { effects } of contents) {
    for (const effect of effects) {
      applyEffectToMods(effect, spells, synergyMap, missingMap, cooldownMap, (d) => {
        bonusMaxMana += d;
      });
    }
  }

  return {
    spells,
    bonusMaxMana,
    synergies: [...synergyMap.values()],
    missingHealthBonuses: [...missingMap.values()],
    missingHealthPctBonuses: [],
    fullHealthBonuses: [],
    paceMultipliersTenths: [10],
    cooldowns: [...cooldownMap.values()],
  };
}

function applyEffectToMods(
  effect: RadialTreeEffect,
  spells: SpellDef[],
  synergyMap: Map<string, SynergyRule>,
  missingMap: Map<string, MissingHealthBonusRule>,
  cooldownMap: Map<string, CooldownDef>,
  addMana: (d: number) => void,
): void {
  switch (effect.kind) {
    case 'grantSpell':
    case 'specializeSpell':
      // Spell ownership is tracked via unlockedSpells on the save; handled at
      // purchase time by applyRadialPurchase, not at resolve time.
      break;

    case 'grantCooldown': {
      const def = cooldownById(effect.cooldownId);
      if (def) cooldownMap.set(def.id, def);
      break;
    }

    case 'castMod': {
      const spell = spells.find((s) => s.id === effect.spellId);
      if (spell) {
        if (effect.castMsDelta !== undefined)
          spell.castMs = Math.max(0, spell.castMs + effect.castMsDelta);
        if (effect.manaDelta !== undefined)
          spell.mana = Math.max(0, spell.mana + effect.manaDelta);
        if (effect.healDelta !== undefined)
          spell.heal = Math.max(0, spell.heal + effect.healDelta);
        if (effect.damageDelta !== undefined)
          spell.damage = Math.max(0, (spell.damage ?? 0) + effect.damageDelta);
      }
      break;
    }

    case 'synergy': {
      const key = `${effect.triggerSpellId}>${effect.buffedSpellId}`;
      const prev = synergyMap.get(key);
      if (prev) {
        prev.bonusHeal += effect.bonusHeal;
      } else {
        synergyMap.set(key, {
          triggerSpellId: effect.triggerSpellId,
          buffedSpellId: effect.buffedSpellId,
          bonusHeal: effect.bonusHeal,
        });
      }
      break;
    }

    case 'missingHealthBonus': {
      const prev = missingMap.get(effect.spellId);
      if (prev) {
        prev.healPer10PctMissing += effect.healPer10PctMissing;
      } else {
        missingMap.set(effect.spellId, {
          spellId: effect.spellId,
          healPer10PctMissing: effect.healPer10PctMissing,
        });
      }
      break;
    }

    case 'bonusMaxMana':
      addMana(effect.amount);
      break;

    case 'manaSynergy':
      // Engine support deferred to Chunk 4; data stored in tree, no CombatMods entry yet.
      break;
  }
}

// ---------------------------------------------------------------------------
// Save mutation helpers (specialize, grantSpell)
// ---------------------------------------------------------------------------

function grantSpellToSave(
  save: { unlockedSpells: string[]; actionBar: string[] },
  spellId: string,
): void {
  if (!save.unlockedSpells.includes(spellId)) {
    save.unlockedSpells.push(spellId);
  }
  if (!save.actionBar.includes(spellId)) {
    const empty = save.actionBar.findIndex((id) => id === '');
    if (empty >= 0) save.actionBar[empty] = spellId;
  }
}

function specializeInSave(
  save: { unlockedSpells: string[]; actionBar: string[] },
  fromId: string,
  toId: string,
): void {
  // Replace in action bar first (preserves slot position).
  for (let i = 0; i < save.actionBar.length; i++) {
    if (save.actionBar[i] === fromId) save.actionBar[i] = toId;
  }
  // Remove fromId from unlockedSpells.
  save.unlockedSpells = save.unlockedSpells.filter((id) => id !== fromId);
  // Grant toId.
  if (!save.unlockedSpells.includes(toId)) save.unlockedSpells.push(toId);
}

function applyEffectToSave(
  save: { unlockedSpells: string[]; actionBar: string[] },
  effect: RadialTreeEffect,
): void {
  switch (effect.kind) {
    case 'grantSpell':
      grantSpellToSave(save, effect.spellId);
      break;
    case 'specializeSpell':
      specializeInSave(save, effect.fromId, effect.toId);
      break;
    default:
      // All other effects are resolved at loadout time, not stored on the save.
      break;
  }
}

// ---------------------------------------------------------------------------
// applyRadialPurchase
// ---------------------------------------------------------------------------

/**
 * Attempt to purchase a radial tree spot. Mutates `save` on success.
 *
 * `spotId` may be either:
 *   - a concrete tree spot id (e.g. `'heal-s1-zealous'`)
 *   - a logical A/B group id (e.g. `'heal-s1'`) combined with `choice: 'a' | 'b'`
 *
 * Returns `true` on success, `false` if the purchase was rejected
 * (unknown spot, unaffordable, locked, level too low, etc.).
 */
export function applyRadialPurchase(
  save: {
    treeRanks: Record<string, number>;
    unlockedSpells: string[];
    actionBar: string[];
    xp: number;
  },
  spotId: string,
  choice?: 'a' | 'b',
): boolean {
  // Resolve logical choice id → concrete spot id.
  let actualSpotId = spotId;
  if (choice !== undefined) {
    const entry = RADIAL_CHOICE_TABLE[spotId];
    if (!entry) return false;
    actualSpotId = choice === 'a' ? entry.a : entry.b;
  }

  const level = levelForXp(save.xp);
  const treeState = treeStateFromRadialSave(save.treeRanks, save.xp);

  const result = update(RADIAL_TREE, treeState, {
    type: 'purchase',
    spotId: actualSpotId,
    level,
  });
  if (!result.ok) return false;

  // Persist new ownership.
  const snap = snapshot(result.state);
  save.treeRanks = radialRanksFromOwned(snap.owned);

  // Apply immediate save-level effects (grantSpell, specializeSpell).
  const node = RADIAL_TREE.nodes.find((n) => n.id === actualSpotId);
  if (node) {
    const content = node.content as RadialTreeContent;
    for (const effect of content.effects) {
      applyEffectToSave(save, effect);
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// loadoutFromRadialSave
// ---------------------------------------------------------------------------

/**
 * Canonical radial fight-start entry point: save → flat CombatMods.
 * Uses `unlockedSpells` as the authoritative spell list (tree effects baked on
 * specialize/grant), resolves cooldowns + synergies + castMods from treeRanks,
 * then applies level-mana bonuses and actionBar ordering.
 */
export function loadoutFromRadialSave(save: {
  unlockedSpells: readonly string[];
  xp?: number;
  actionBar?: readonly string[];
  treeRanks?: Record<string, number>;
}): CombatMods {
  const treeRanks = save.treeRanks ?? {};
  // Wallet=0 is fine for resolution; we only need owned node ids here.
  const treeState = treeStateFromRadialSave(treeRanks, 0);
  const contents = ownedContents<RadialTreeContent>(RADIAL_TREE, treeState);

  const mods = resolveRadialCombatMods(contents, save.unlockedSpells);

  // Level-derived mana bonuses (same as lattice path).
  const level = levelForXp(save.xp ?? 0);
  const levelMana = manaBonusesForLevel(level);
  mods.bonusMaxMana += levelMana.bonusMaxMana;
  if (levelMana.manaRegen !== null) {
    mods.manaRegen = levelMana.manaRegen;
  }

  // Action bar ordering.
  if (save.actionBar !== undefined && save.actionBar.some((id) => id.length > 0)) {
    mods.spells = spellsFromActionBar(mods.spells, save.actionBar);
  }

  return mods;
}

/** All owned radial spells (ignores action bar) — Loadout picker. */
export function ownedSpellsFromRadialSave(save: {
  unlockedSpells: readonly string[];
  xp?: number;
  treeRanks?: Record<string, number>;
}): SpellDef[] {
  return loadoutFromRadialSave({
    unlockedSpells: save.unlockedSpells,
    ...(save.xp !== undefined ? { xp: save.xp } : {}),
    ...(save.treeRanks !== undefined ? { treeRanks: save.treeRanks } : {}),
  }).spells;
}
