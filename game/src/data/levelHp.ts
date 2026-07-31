/**
 * J26 — level-derived party max-HP growth.
 *
 * Mirrors `levelMana.ts`: a pure `level → {tank, dps, healer}` bonus, isolated
 * so loadout/scene/bot call sites share one source of truth. Relic `roleMaxHp`
 * stacks on top at engine construction time.
 */

import { PARTY_LEVEL_HP } from './constants';

export interface PartyHpBonuses {
  tank: number;
  dps: number;
  healer: number;
}

/** Pure level → per-role max-HP bonus (0 at level 1). */
export function partyHpBonusesForLevel(level: number): PartyHpBonuses {
  const above1 = Math.max(0, Math.floor(level) - 1);
  return {
    tank: PARTY_LEVEL_HP.tankPerLevel * above1,
    dps: PARTY_LEVEL_HP.dpsPerLevel * above1,
    healer: PARTY_LEVEL_HP.healerPerLevel * above1,
  };
}
