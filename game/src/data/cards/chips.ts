/**
 * Cards-mode chip catalog (spell-cards-poc-handoff §7.2 / §8 + Wave 7a).
 *
 * Mend / bonk / vowstrike: exactly 6 chips (3 per slot). Heal: 3 slot-0 +
 * 4 slot-1 catalog members (slot-2 offers are a gated trio — see draft.ts).
 */

import type { SpellCastBuff } from '../../combat/types';
import { CARD_SLOTS } from './unlocks';

export type CardChipEffect =
  | {
      kind: 'castMod';
      spellId: string;
      castMsDelta?: number;
      manaDelta?: number;
      healDelta?: number;
      damageDelta?: number;
      cooldownMsDelta?: number;
    }
  | { kind: 'synergy'; triggerSpellId: string; buffedSpellId: string; bonusHeal: number }
  | { kind: 'manaSynergy'; triggerSpellId: string; targetSpellId: string; manaDelta: number }
  | { kind: 'missingHealthBonus'; spellId: string; healPer10PctMissing: number }
  | { kind: 'missingHealthPctBonus'; spellId: string; pctPer10PctMissing: number }
  | { kind: 'fullHealthBonus'; spellId: string; hpPctAtLeast: number; bonusHeal: number }
  | { kind: 'setManaOnHit'; spellId: string; amount: number }
  | { kind: 'setCastBuff'; spellId: string; castBuff: SpellCastBuff };

export interface CardChipDef {
  id: string;
  name: string;
  description: string;
  spellId: string;
  /** 0 = first upgrade on the card; 1 = second. */
  slotIndex: 0 | 1;
  effects: CardChipEffect[];
  /** Optional flavor tag from relic revamp (Z/S/R/X) — comments/tests only. */
  archetype?: 'Z' | 'S' | 'R' | 'X';
}

/** Authored chips — heal has 7 (gated slot-2 catalog); others 6 each. */
export const CARD_CHIPS: readonly CardChipDef[] = [
  // ----- heal slot 1 -----
  {
    id: 'heal-mend-link',
    name: 'Mend Link',
    description: 'After Mend, your next Heal gains +2.',
    spellId: 'heal',
    slotIndex: 0,
    archetype: 'X',
    effects: [{ kind: 'synergy', triggerSpellId: 'mend', buffedSpellId: 'heal', bonusHeal: 2 }],
  },
  {
    id: 'heal-graven',
    name: 'Graven Light',
    description: 'Heal gains +10% of its base per 10% HP the target is missing.',
    spellId: 'heal',
    slotIndex: 0,
    archetype: 'S',
    effects: [{ kind: 'missingHealthPctBonus', spellId: 'heal', pctPer10PctMissing: 10 }],
  },
  {
    id: 'heal-cost',
    name: 'Cost Cut',
    description: 'Heal costs 1 less mana (never below 1).',
    spellId: 'heal',
    slotIndex: 0,
    archetype: 'Z',
    effects: [{ kind: 'castMod', spellId: 'heal', manaDelta: -1 }],
  },
  // ----- heal slot 2 (4 catalog members; offers are a gated trio — draft.ts) -----
  {
    id: 'heal-heavy',
    name: 'Heavy Cast',
    description: 'Heal restores +3 but takes 500ms longer.',
    spellId: 'heal',
    slotIndex: 1,
    archetype: 'S',
    effects: [{ kind: 'castMod', spellId: 'heal', healDelta: 3, castMsDelta: 500 }],
  },
  {
    id: 'heal-quick',
    name: 'Quick Hands',
    description: 'Heal casts 300ms faster.',
    spellId: 'heal',
    slotIndex: 1,
    archetype: 'Z',
    effects: [{ kind: 'castMod', spellId: 'heal', castMsDelta: -300 }],
  },
  {
    id: 'heal-power',
    name: 'Power Up',
    description: 'Heal restores +2.',
    spellId: 'heal',
    slotIndex: 1,
    archetype: 'S',
    effects: [{ kind: 'castMod', spellId: 'heal', healDelta: 2 }],
  },
  {
    id: 'heal-bulwark',
    name: 'Bulwark Mend',
    description: 'Heal restores +1.',
    spellId: 'heal',
    slotIndex: 1,
    archetype: 'Z',
    effects: [{ kind: 'castMod', spellId: 'heal', healDelta: 1 }],
  },

  // ----- mend slot 1 -----
  {
    id: 'mend-arming',
    name: 'Arming Mend',
    description: 'After Mend, your next Heal gains +2.',
    spellId: 'mend',
    slotIndex: 0,
    archetype: 'X',
    effects: [{ kind: 'synergy', triggerSpellId: 'mend', buffedSpellId: 'heal', bonusHeal: 2 }],
  },
  {
    id: 'mend-battle',
    name: 'Battle Mend',
    description: 'After Bonk or Vowstrike, your next Mend costs 1 less.',
    spellId: 'mend',
    slotIndex: 0,
    archetype: 'R',
    effects: [
      { kind: 'manaSynergy', triggerSpellId: 'bonk', targetSpellId: 'mend', manaDelta: -1 },
      { kind: 'manaSynergy', triggerSpellId: 'vowstrike', targetSpellId: 'mend', manaDelta: -1 },
    ],
  },
  {
    id: 'mend-quick',
    name: 'Quick Mend',
    description: 'Mend casts 400ms faster.',
    spellId: 'mend',
    slotIndex: 0,
    archetype: 'Z',
    effects: [{ kind: 'castMod', spellId: 'mend', castMsDelta: -400 }],
  },
  // ----- mend slot 2 -----
  {
    id: 'mend-penny',
    name: 'Penny Mend',
    description: 'Mend costs 0 mana.',
    spellId: 'mend',
    slotIndex: 1,
    archetype: 'S',
    effects: [{ kind: 'castMod', spellId: 'mend', manaDelta: -1 }],
  },
  {
    id: 'mend-graven',
    name: 'Brink Mend',
    description: 'Mend gains +1 per 10% HP the target is missing.',
    spellId: 'mend',
    slotIndex: 1,
    archetype: 'S',
    effects: [{ kind: 'missingHealthBonus', spellId: 'mend', healPer10PctMissing: 1 }],
  },
  {
    id: 'mend-spark',
    name: 'Spark Mend',
    description: 'Mend restores +1 and casts 200ms faster.',
    spellId: 'mend',
    slotIndex: 1,
    archetype: 'Z',
    effects: [{ kind: 'castMod', spellId: 'mend', healDelta: 1, castMsDelta: -200 }],
  },

  // ----- bonk slot 1 -----
  {
    id: 'bonk-battle',
    name: 'Battle Link',
    description: 'After Bonk, your next Mend costs 1 less.',
    spellId: 'bonk',
    slotIndex: 0,
    archetype: 'R',
    effects: [{ kind: 'manaSynergy', triggerSpellId: 'bonk', targetSpellId: 'mend', manaDelta: -1 }],
  },
  {
    id: 'bonk-blessed',
    name: 'Blessed Bonk',
    description: 'Each Bonk stacks +10% on your next heal (cap 3).',
    spellId: 'bonk',
    slotIndex: 0,
    archetype: 'R',
    effects: [
      {
        kind: 'setCastBuff',
        spellId: 'bonk',
        castBuff: { kind: 'stackNextHealPotencyPct', pct: 10, cap: 3 },
      },
    ],
  },
  {
    id: 'bonk-mana',
    name: 'Mana Bonk',
    description: 'Bonk restores 1 mana on hit.',
    spellId: 'bonk',
    slotIndex: 0,
    archetype: 'Z',
    effects: [{ kind: 'setManaOnHit', spellId: 'bonk', amount: 1 }],
  },
  // ----- bonk slot 2 -----
  {
    id: 'bonk-crush',
    name: 'Crushing Bonk',
    description: 'Bonk deals +2 damage.',
    spellId: 'bonk',
    slotIndex: 1,
    archetype: 'R',
    effects: [{ kind: 'castMod', spellId: 'bonk', damageDelta: 2 }],
  },
  {
    id: 'bonk-reckoning',
    name: 'Reckoning Weight',
    description: 'Each Bonk stacks +15% on your next heal (cap 3). Replaces other Bonk cast buffs.',
    spellId: 'bonk',
    slotIndex: 1,
    archetype: 'R',
    effects: [
      {
        kind: 'setCastBuff',
        spellId: 'bonk',
        castBuff: { kind: 'stackNextHealPotencyPct', pct: 15, cap: 3 },
      },
    ],
  },
  {
    id: 'bonk-quicksteel',
    name: 'Quicksteel',
    description: 'After Bonk, your next heal gains +25%. Replaces other Bonk cast buffs.',
    spellId: 'bonk',
    slotIndex: 1,
    archetype: 'X',
    effects: [
      {
        kind: 'setCastBuff',
        spellId: 'bonk',
        castBuff: { kind: 'nextHealPotencyPct', pct: 25 },
      },
    ],
  },

  // ----- vowstrike slot 1 -----
  {
    id: 'vs-battle',
    name: 'Battle Link',
    description: 'After Vowstrike, your next Mend costs 1 less.',
    spellId: 'vowstrike',
    slotIndex: 0,
    archetype: 'R',
    effects: [
      { kind: 'manaSynergy', triggerSpellId: 'vowstrike', targetSpellId: 'mend', manaDelta: -1 },
    ],
  },
  {
    id: 'vs-absolution',
    name: 'Absolution Lite',
    description: 'After Vowstrike, your next spell costs 1 less mana.',
    spellId: 'vowstrike',
    slotIndex: 0,
    archetype: 'S',
    effects: [
      {
        kind: 'setCastBuff',
        spellId: 'vowstrike',
        castBuff: { kind: 'nextSpellManaReduction', amount: 1 },
      },
    ],
  },
  {
    id: 'vs-reckoning',
    name: 'Reckoning Lite',
    description: 'After Vowstrike, your next heal gains +20%.',
    spellId: 'vowstrike',
    slotIndex: 0,
    archetype: 'R',
    effects: [
      {
        kind: 'setCastBuff',
        spellId: 'vowstrike',
        castBuff: { kind: 'nextHealPotencyPct', pct: 20 },
      },
    ],
  },
  // ----- vowstrike slot 2 -----
  {
    id: 'vs-ready',
    name: 'Ready Strike',
    description: 'Vowstrike cooldown is 2s shorter.',
    spellId: 'vowstrike',
    slotIndex: 1,
    archetype: 'Z',
    effects: [{ kind: 'castMod', spellId: 'vowstrike', cooldownMsDelta: -2000 }],
  },
  {
    id: 'vs-crush',
    name: 'Crush',
    description: 'Vowstrike deals +2 damage.',
    spellId: 'vowstrike',
    slotIndex: 1,
    archetype: 'R',
    effects: [{ kind: 'castMod', spellId: 'vowstrike', damageDelta: 2 }],
  },
  {
    id: 'vs-weight',
    name: 'Heavy Vow',
    description: 'Vowstrike deals +1 and your next heal gains +30%.',
    spellId: 'vowstrike',
    slotIndex: 1,
    archetype: 'R',
    effects: [
      { kind: 'castMod', spellId: 'vowstrike', damageDelta: 1 },
      {
        kind: 'setCastBuff',
        spellId: 'vowstrike',
        castBuff: { kind: 'nextHealPotencyPct', pct: 30 },
      },
    ],
  },
];

const byId = new Map(CARD_CHIPS.map((c) => [c.id, c]));

export function chipById(id: string): CardChipDef | undefined {
  return byId.get(id);
}

/**
 * Exactly the three authored offers for this spell + slot, in catalog order.
 * Heal slot 2 is gated (chip1-dependent) — use `offersForNextSlot` / 
 * `healSlot2Offers` instead. Throws if the spell/slot has no authored trio.
 */
export function chipOffersForSlot(
  spellId: string,
  slotIndex: 0 | 1,
): readonly [string, string, string] {
  if (slotIndex !== 0 && slotIndex !== 1) {
    throw new Error(`chipOffersForSlot: invalid slotIndex ${String(slotIndex)}`);
  }
  if (slotIndex >= CARD_SLOTS) {
    throw new Error(`chipOffersForSlot: slotIndex ${slotIndex} >= CARD_SLOTS`);
  }
  if (spellId === 'heal' && slotIndex === 1) {
    throw new Error(
      'chipOffersForSlot: heal slot 2 is gated — use offersForNextSlot / healSlot2Offers',
    );
  }
  const ids = CARD_CHIPS.filter((c) => c.spellId === spellId && c.slotIndex === slotIndex).map(
    (c) => c.id,
  );
  if (ids.length !== 3) {
    throw new Error(
      `chipOffersForSlot: expected 3 chips for ${spellId} slot ${slotIndex}, got ${ids.length}`,
    );
  }
  return ids as [string, string, string];
}

/** Heal chip1 id that unlocks Heavy Cast in slot-2 offers. */
export const HEAL_HEAVY_GATE_CHIP1 = 'heal-graven';

/**
 * Slot-2 offer trio for Heal (Wave 7a J25b). Stable order.
 * chip1 === heal-graven → Heavy / Quick / Power; else Quick / Power / Bulwark.
 */
export function healSlot2Offers(
  chip1Id: string | undefined,
): readonly [string, string, string] {
  if (chip1Id === HEAL_HEAVY_GATE_CHIP1) {
    return ['heal-heavy', 'heal-quick', 'heal-power'];
  }
  return ['heal-quick', 'heal-power', 'heal-bulwark'];
}
