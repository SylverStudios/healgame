/**
 * Ash Gate (Dungeon 1) — poc-spec §7: wave 1 light trash, wave 2 denser trash,
 * then boss Gate Warden with Bonehowl. No phases.
 *
 * Enemy HP is not specified in poc-spec — these are draft numbers (per the
 * Chunk 1 task brief) meant to be tuned later; kept as data, not code.
 */

import { GATE_WARDEN } from './constants';
import type { EncounterDef } from '../combat/types';

export const ASH_GATE: EncounterDef = {
  id: 'ash-gate',
  name: 'Ash Gate',
  waves: [
    { enemies: [{ name: 'Ash Husk', hp: 4, count: 2 }] },
    { enemies: [{ name: 'Ash Husk', hp: 4, count: 3 }] },
  ],
  boss: {
    id: 'gate-warden',
    name: 'Gate Warden',
    hp: 15,
    autoDamage: GATE_WARDEN.autoDamage,
    swingIntervalMs: GATE_WARDEN.swingIntervalMs,
    cast: {
      name: 'Bonehowl',
      castMs: GATE_WARDEN.bonehowlCastMs,
      // First cast at 5s after the boss wave starts, then every 15s
      // (start-to-start cadence — see combat/README.md).
      firstCastAtMs: 5000,
      intervalMs: 15_000,
      partyDamage: GATE_WARDEN.bonehowlPartyDamage,
    },
  },
};

export const ENCOUNTERS: EncounterDef[] = [ASH_GATE];
