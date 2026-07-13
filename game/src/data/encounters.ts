/**
 * Ash Gate (Dungeon 1) — poc-spec §7: wave 1 light trash, wave 2 denser trash,
 * then boss Gate Warden with Bonehowl. No phases.
 *
 * Enemy HP is not specified in poc-spec — these are draft numbers (per the
 * Chunk 1 task brief) meant to be tuned later; kept as data, not code.
 */

import { GATE_WARDEN, HOLLOW_KING, IRON_TRASH, SPIRE_LANCER } from './constants';
import type { EncounterDef } from '../combat/types';

export const ASH_GATE: EncounterDef = {
  id: 'ash-gate',
  name: 'Ash Gate',
  waves: [
    { enemies: [{ name: 'Ash Husk', hp: 11, count: 2 }] },
    { enemies: [{ name: 'Ash Husk', hp: 11, count: 3 }] },
  ],
  boss: {
    id: 'gate-warden',
    name: 'Gate Warden',
    // Phase 3 (handoff §B) retune: mercs got faster per-role swing intervals
    // (net ~2.6x combined DPS vs the old uniform 3000ms cadence), so enemy hp
    // scaled up proportionally to hold the original fight-length/difficulty
    // shape — see balance.test.ts gates and the throwaway diagnostic used to
    // derive these numbers.
    hp: 145,
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
 * Iron Pass (Dungeon 2, alpha-0.1-handoff §D2/§D3): unlocks after Ash Gate's
 * first clear. Four trash waves (same "Ash Husk" template, reskinned "Iron
 * Husk" in data only) building toward Spire Lancer — a single-target
 * pressure boss using the Tunnel Vision cast (see combat/types.ts
 * `TunnelVisionCastDef` and combat/README.md for cadence semantics).
 */
export const IRON_PASS: EncounterDef = {
  id: 'iron-pass',
  name: 'Iron Pass',
  // Iron Husks swing off IRON_TRASH (2 dmg / 3.0s), harder-hitting than the
  // global TRASH constants Ash Gate uses — per-group override, see
  // EnemyGroupDef. HP retuned down from the handoff's draft table (chunk 9a
  // bot tune — see balance.test.ts gates 5/6): the draft's 2/3/3/4 waves at
  // 14/14/16/16 hp (182 total trash hp) cost a maxed healer ~32-38 of their
  // ~48-49 max mana before the boss even spawned, leaving too little to
  // survive Spire Lancer's Tunnel Vision. 115 total trash hp keeps the "hits
  // harder than Ash Gate" per-swing feel (still ~2.1x Ash Gate's 55 total
  // trash hp at 2x the per-hit damage) while leaving a maxed Vigil/Zealot
  // build enough mana to clear the boss with >=3 party members standing.
  waves: [
    { enemies: [{ name: 'Iron Husk', hp: 9, count: 2, ...IRON_TRASH }] },
    { enemies: [{ name: 'Iron Husk', hp: 9, count: 3, ...IRON_TRASH }] },
    { enemies: [{ name: 'Iron Husk', hp: 10, count: 3, ...IRON_TRASH }] },
    { enemies: [{ name: 'Iron Husk', hp: 10, count: 4, ...IRON_TRASH }] },
  ],
  boss: {
    id: 'spire-lancer',
    name: 'Spire Lancer',
    hp: SPIRE_LANCER.hp,
    autoDamage: SPIRE_LANCER.autoDamage,
    swingIntervalMs: SPIRE_LANCER.swingIntervalMs,
    cast: {
      kind: 'tunnelVision',
      name: 'Tunnel Vision',
      telegraphMs: SPIRE_LANCER.telegraphMs,
      firstCastAtMs: SPIRE_LANCER.firstCastAtMs,
      intervalMs: SPIRE_LANCER.intervalMs,
      channelMs: SPIRE_LANCER.channelMs,
      tickMs: SPIRE_LANCER.tickMs,
      damagePerTick: SPIRE_LANCER.damagePerTick,
    },
  },
};

/**
 * The Maw (Dungeon 3, poc-spec §1 item 8, §7): unlocks after Iron Pass's
 * first clear (alpha-0.1-handoff §D1 amends the old "after Ash Gate" rule).
 * One light trash wave (same stats as Ash Gate wave 1) so grind attempts
 * still pay a little gold/XP, then Hollow King — a boss intentionally sized
 * far beyond PoC power. Cannot be cleared; it's an endless sandbox, not a
 * "no further dungeons" content wall.
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

export const ENCOUNTERS: EncounterDef[] = [ASH_GATE, IRON_PASS, THE_MAW];
