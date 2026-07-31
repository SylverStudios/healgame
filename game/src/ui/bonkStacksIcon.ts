/**
 * Blessed Bonk stacked-cue layout + live Bonk-buff hover notes (Wave 6 R3).
 * Pure (Phaser-free) so it stays unit-testable; the Phaser drawing lives in
 * `healerCues.ts`, which imports `bonkStackIconPositions` from here.
 */

import type { CombatState, SpellDef } from '../combat/types';

/**
 * Same overhead height as the Battle Mend cue (`battleMendIcon.ts`
 * BATTLE_MEND_ICON_Y_OFFSET = 2 * (64/2 + 10)) — duplicated as a literal here
 * to keep this module Phaser-free (battleMendIcon.ts pulls in Phaser).
 */
export const BONK_STACK_ICON_Y_OFFSET = 2 * (64 / 2 + 10);
/** Offset right of healer center so the stack clears the centered Battle Mend cue. */
const BONK_STACK_BASE_DX = 24;
const BONK_STACK_STEP_X = 7;
const BONK_STACK_STEP_Y = 7;

/**
 * Overhead positions for `count` stacked icons, fanned up-and-right from the
 * healer's home. Pure — colocated tests pin the fan geometry.
 */
export function bonkStackIconPositions(
  homeX: number,
  homeY: number,
  count: number,
): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < count; i += 1) {
    positions.push({
      x: homeX + BONK_STACK_BASE_DX + i * BONK_STACK_STEP_X,
      y: homeY - BONK_STACK_ICON_Y_OFFSET - i * BONK_STACK_STEP_Y,
    });
  }
  return positions;
}

type BonkBuffState = Pick<
  CombatState,
  'bonkHealStacks' | 'nextHealPotencyPct' | 'nextSpellManaReduction'
>;

/**
 * Short, player-facing lines describing the active Bonk castBuff state for the
 * hovered spell. Pure — colocated tests pin the copy.
 *
 * - Blessed stacks show on heals (which consume them) and on the arming spell
 *   itself (build status); the total pct comes from the arming spell's castBuff.
 * - Armed flat next-heal potency shows only on heals (only heals consume it).
 * - Pending next-spell mana discount shows on any spell (it hits the next cast).
 */
export function bonkBuffHoverNotes(
  state: BonkBuffState,
  spell: SpellDef,
  loadoutSpells: readonly SpellDef[],
): string[] {
  const notes: string[] = [];
  const isHeal = (spell.damage ?? 0) <= 0 && spell.heal > 0;
  const armsStacks = spell.castBuff?.kind === 'stackNextHealPotencyPct';

  if (state.bonkHealStacks > 0 && (isHeal || armsStacks)) {
    const stackSpell = loadoutSpells.find((s) => s.castBuff?.kind === 'stackNextHealPotencyPct');
    const ownPct =
      armsStacks && spell.castBuff?.kind === 'stackNextHealPotencyPct'
        ? spell.castBuff.pct
        : stackSpell?.castBuff?.kind === 'stackNextHealPotencyPct'
          ? stackSpell.castBuff.pct
          : 0;
    const total = state.bonkHealStacks * ownPct;
    notes.push(
      total > 0
        ? `Blessed stacks: ${state.bonkHealStacks} (+${total}% next heal)`
        : `Blessed stacks: ${state.bonkHealStacks}`,
    );
  }

  if (isHeal && state.nextHealPotencyPct > 0) {
    notes.push(`Next heal +${state.nextHealPotencyPct}% potency`);
  }

  if (state.nextSpellManaReduction > 0) {
    notes.push(`Next spell \u2212${state.nextSpellManaReduction} mana`);
  }

  return notes;
}

/** Convenience: resolve `spellId` in `loadoutSpells`, then `bonkBuffHoverNotes`. */
export function liveBonkBuffNotes(
  state: BonkBuffState,
  loadoutSpells: readonly SpellDef[],
  spellId: string,
): string[] {
  const spell = loadoutSpells.find((s) => s.id === spellId);
  return spell ? bonkBuffHoverNotes(state, spell, loadoutSpells) : [];
}
