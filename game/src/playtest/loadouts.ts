/**
 * Deterministic cards-mode chip / upgrade / CD picks for playtest bots.
 *
 * Choices are authored here (not rolled at runtime) so sweeps stay stable.
 * Basic = simple passive / flat modifiers. God = mend→heal synergy core plus
 * sustain and potency follow-ups.
 */

import type { SecondaryId } from '../data/secondaryStats';

export type KitProfile = 'basic' | 'god';

/** Ordered chip purchases (slot 0 then slot 1 per spell). */
export interface ChipPick {
  spellId: string;
  chipId: string;
}

/**
 * Basic: no sequencing required.
 * - Heal Graven + Heavy (passive missing-% then flat +heal)
 * - Mend Surge + Penny (self buff / free mend — no arming chain)
 * - Bonk Mana + Vow Link (mana on hit / next-spell discount)
 * - Vowstrike Absolution + Wellspring (discount / mana on hit)
 */
export const BASIC_CHIP_PLAN: readonly ChipPick[] = [
  { spellId: 'heal', chipId: 'heal-graven' },
  { spellId: 'heal', chipId: 'heal-heavy' },
  { spellId: 'mend', chipId: 'mend-surge' },
  { spellId: 'mend', chipId: 'mend-penny' },
  { spellId: 'bonk', chipId: 'bonk-mana' },
  { spellId: 'bonk', chipId: 'bonk-vow-link' },
  { spellId: 'vowstrike', chipId: 'vs-absolution' },
  { spellId: 'vowstrike', chipId: 'vs-wellspring' },
];

/**
 * God: mend→heal combo (+4 when both links owned), free mend to arm, mana
 * sustain on Bonk, heal stacks from Reckoning Weight, Vowstrike Heavy Vow.
 * - Heal Mend Link + Vigor (combo arm + missing-HP throughput)
 * - Mend Arming + Penny (stack the +2 and arm for free)
 * - Bonk Mana + Reckoning Weight
 * - Vowstrike Absolution + Heavy Vow
 */
export const GOD_CHIP_PLAN: readonly ChipPick[] = [
  { spellId: 'heal', chipId: 'heal-mend-link' },
  { spellId: 'heal', chipId: 'heal-vigor' },
  { spellId: 'mend', chipId: 'mend-arming' },
  { spellId: 'mend', chipId: 'mend-penny' },
  { spellId: 'bonk', chipId: 'bonk-mana' },
  { spellId: 'bonk', chipId: 'bonk-reckoning' },
  { spellId: 'vowstrike', chipId: 'vs-absolution' },
  { spellId: 'vowstrike', chipId: 'vs-weight' },
];

/** Basic dumps every secondary pick into block. */
export const BASIC_SECONDARY: SecondaryId = 'block';

/**
 * God front-loads block (spike survival), then manaRegen, then crit/haste.
 * Index = 0-based pick among (level − 1) upgrades.
 */
export function godSecondaryAtPick(index: number): SecondaryId {
  if (index < 3) return 'block';
  const rest: readonly SecondaryId[] = ['manaRegen', 'crit', 'haste', 'block'];
  return rest[(index - 3) % rest.length]!;
}

export const BASIC_SET_A_CD = 'still-waters';
export const BASIC_SET_B_CD = 'mercy-reserve';
export const GOD_SET_A_CD = 'frenzied-liturgy';
export const GOD_SET_B_CD = 'iron-canticle';

export function chipPlanFor(profile: KitProfile): readonly ChipPick[] {
  return profile === 'god' ? GOD_CHIP_PLAN : BASIC_CHIP_PLAN;
}
