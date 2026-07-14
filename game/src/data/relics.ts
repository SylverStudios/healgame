/** Permanent, low-complexity stat relics offered after dungeon first clears. */

import type { RelicDef } from '../combat/types';

export const EMBER_LEDGER: RelicDef = {
  id: 'ember-ledger',
  name: 'Ember Ledger',
  description: 'The healer restores 1 mana every 30 seconds.',
  effects: [{ kind: 'manaRegen', amount: 1, intervalMs: 30_000 }],
};

export const TRIAGE_BELL: RelicDef = {
  id: 'triage-bell',
  name: 'Triage Bell',
  description: 'All healing is increased by 1.',
  effects: [{ kind: 'bonusHealing', amount: 1 }],
};

export const STILL_RESERVOIR: RelicDef = {
  id: 'still-reservoir',
  name: 'Still Reservoir',
  description: 'The healer gains 10 maximum mana.',
  effects: [{ kind: 'bonusMaxMana', amount: 10 }],
};

export const VITAL_EMBER: RelicDef = {
  id: 'vital-ember',
  name: 'Vital Ember',
  description: 'The healer gains 5 maximum health.',
  effects: [{ kind: 'roleMaxHp', role: 'healer', amount: 5 }],
};

export const BASTION_PLATE: RelicDef = {
  id: 'bastion-plate',
  name: 'Bastion Plate',
  description: 'The tank gains 5 maximum health.',
  effects: [{ kind: 'roleMaxHp', role: 'tank', amount: 5 }],
};

export const IRON_WARD: RelicDef = {
  id: 'iron-ward',
  name: 'Iron Ward',
  description: 'The tank takes 1 less damage from every hit (minimum 1).',
  effects: [{ kind: 'roleArmor', role: 'tank', amount: 1 }],
};

export const TWIN_FANG: RelicDef = {
  id: 'twin-fang',
  name: 'Twin Fang',
  description: 'Each DPS deals 1 additional auto-attack damage.',
  effects: [{ kind: 'roleAutoDamage', role: 'dps', amount: 1 }],
};

export const QUICKSTEEL: RelicDef = {
  id: 'quicksteel',
  name: 'Quicksteel',
  description: 'DPS auto-attacks are 100ms faster.',
  effects: [{ kind: 'roleSwingInterval', role: 'dps', deltaMs: -100 }],
};

export const WARBLOOD_GEM: RelicDef = {
  id: 'warblood-gem',
  name: 'Warblood Gem',
  description: 'Each DPS gains 3 maximum health and 1 attack damage.',
  effects: [
    { kind: 'roleMaxHp', role: 'dps', amount: 3 },
    { kind: 'roleAutoDamage', role: 'dps', amount: 1 },
  ],
};

export const VANGUARD_SIGIL: RelicDef = {
  id: 'vanguard-sigil',
  name: 'Vanguard Sigil',
  description: 'The tank deals 1 additional auto-attack damage.',
  effects: [{ kind: 'roleAutoDamage', role: 'tank', amount: 1 }],
};

export const RELICS: RelicDef[] = [
  EMBER_LEDGER,
  TRIAGE_BELL,
  STILL_RESERVOIR,
  VITAL_EMBER,
  BASTION_PLATE,
  IRON_WARD,
  TWIN_FANG,
  QUICKSTEEL,
  WARBLOOD_GEM,
  VANGUARD_SIGIL,
];

export function relicById(id: string | null | undefined): RelicDef | undefined {
  if (!id) return undefined;
  return RELICS.find((r) => r.id === id);
}

export function relicsById(ids: readonly string[]): RelicDef[] {
  return ids.map((id) => relicById(id)).filter((relic): relic is RelicDef => relic !== undefined);
}

/** Draw unique, unowned offers. Randomness is injected by the application layer. */
export function chooseRelicOffers(
  ownedIds: readonly string[],
  random: () => number,
  count = 3,
): string[] {
  const candidates = RELICS.filter((relic) => !ownedIds.includes(relic.id)).map((relic) => relic.id);
  const offers: string[] = [];
  while (offers.length < count && candidates.length > 0) {
    const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
    offers.push(candidates.splice(index, 1)[0]!);
  }
  return offers;
}
