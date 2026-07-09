/**
 * Ash Gate (Dungeon 1) — poc-spec §7: wave 1 light trash, wave 2 denser trash,
 * then boss Gate Warden with Bonehowl. No phases.
 *
 * Enemy HP is not specified in poc-spec — these are draft numbers (per the
 * Chunk 1 task brief) meant to be tuned later; kept as data, not code.
 */

import { GATE_WARDEN, HOLLOW_KING } from './constants';
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
    // QA-tuned (was 15): the boss must outlive at least one full Bonehowl
    // telegraph and outlast a no-heal party — see balance.test.ts gates.
    hp: 55,
    autoDamage: GATE_WARDEN.autoDamage,
    swingIntervalMs: GATE_WARDEN.swingIntervalMs,
    cast: {
      name: 'Bonehowl',
      castMs: GATE_WARDEN.bonehowlCastMs,
      // First cast at 3s after the boss wave starts, then every 12s
      // (start-to-start cadence — see combat/README.md), so the 10s telegraph
      // lands at ~13s/25s into a ~30s boss fight.
      firstCastAtMs: 3000,
      intervalMs: 12_000,
      partyDamage: GATE_WARDEN.bonehowlPartyDamage,
    },
  },
};

/**
 * The Maw (Dungeon 2, poc-spec §1 item 8, §7): unlocks after Ash Gate's
 * first clear. One light trash wave (same stats as Ash Gate wave 1) so
 * grind attempts still pay a little gold/XP, then Hollow King — a boss
 * intentionally sized far beyond PoC power. Cannot be cleared; it's an
 * endless sandbox, not a "no further dungeons" content wall.
 */
export const THE_MAW: EncounterDef = {
  id: 'the-maw',
  name: 'The Maw',
  waves: [{ enemies: [{ name: 'Ash Husk', hp: 4, count: 2 }] }],
  boss: {
    id: 'hollow-king',
    name: 'Hollow King',
    hp: HOLLOW_KING.hp,
    autoDamage: HOLLOW_KING.autoDamage,
    swingIntervalMs: HOLLOW_KING.swingIntervalMs,
    cast: {
      name: 'Extinction',
      castMs: HOLLOW_KING.extinctionCastMs,
      // First cast at 15s after the boss wave starts, then every 25s
      // (start-to-start cadence — see combat/README.md).
      firstCastAtMs: 15_000,
      intervalMs: 25_000,
      partyDamage: HOLLOW_KING.extinctionPartyDamage,
    },
  },
};

export const ENCOUNTERS: EncounterDef[] = [ASH_GATE, THE_MAW];
