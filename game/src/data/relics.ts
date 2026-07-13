/**
 * Relic data (Alpha 0.1 §D7 — minimal relics). All numbers live here;
 * gameplay rules/interactions are documented in combat/README.md and encoded
 * in combat/engine.ts (the `relic` constructor option). Relics are picked
 * once, after the first-ever Ash Gate clear (RelicScene), and persist as
 * `save.relicId` — not tree nodes, never re-offered, restart wipes the pick.
 */

import type { RelicDef } from '../combat/types';

/** Once per combat, the first overheal restores mana to the healer. */
export const EMBER_LEDGER: RelicDef = {
  id: 'ember-ledger',
  name: 'Ember Ledger',
  description: 'First overheal each combat restores 3 mana.',
  effect: { kind: 'overhealManaRestore', mana: 3 },
};

/** Heals on low targets hit harder; heals on healthy targets are pruned (min 1). */
export const TRIAGE_BELL: RelicDef = {
  id: 'triage-bell',
  name: 'Triage Bell',
  description: 'Heals on targets below 50% health heal +2; heals at/above 50% heal -1 (min 1).',
  effect: { kind: 'thresholdHealMod', thresholdPct: 50, bonusBelow: 2, penaltyAtOrAbove: 1, minHeal: 1 },
};

/** Smaller mana pool, but a slow trickle back every 15s regardless of casting. */
export const STILL_RESERVOIR: RelicDef = {
  id: 'still-reservoir',
  name: 'Still Reservoir',
  description: 'Start each combat with 5 less max mana, but regain 2 mana every 15s.',
  effect: { kind: 'manaRegenTradeoff', maxManaDelta: -5, regenIntervalMs: 15_000, regenAmount: 2 },
};

export const RELICS: RelicDef[] = [EMBER_LEDGER, TRIAGE_BELL, STILL_RESERVOIR];

export function relicById(id: string | null | undefined): RelicDef | undefined {
  if (!id) return undefined;
  return RELICS.find((r) => r.id === id);
}
