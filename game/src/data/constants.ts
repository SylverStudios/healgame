/**
 * Draft numbers from poc-spec §4.2 — tunable, all integers, keep roughly 1–10.
 * poc-spec.md wins any conflict.
 */

export const GCD_MS = 1000;

export const PARTY = {
  tankMaxHp: 20,
  dpsMaxHp: 10,
  healerMaxHp: 15,
  startingMana: 20,
  /** Harsh: no mana regen in combat for the first dungeon. */
  manaRegenPer5s: 0,
} as const;

export const TRASH = {
  autoDamage: 1,
  swingIntervalMs: 3000,
} as const;

export const GATE_WARDEN = {
  // QA-tuned from the §4.2 draft (auto 2): with 2 the party out-heals the
  // fight for free and a no-heal party still wins — see balance.test.ts gates.
  autoDamage: 3,
  swingIntervalMs: 3000,
  bonehowlCastMs: 10_000,
  bonehowlPartyDamage: 4,
} as const;

/**
 * Dungeon 2 boss (poc-spec §1 item 8, §7): "insanely overpowered" on purpose
 * — the party cannot win with PoC power. Auto damage 3 per 3s; Extinction is
 * a 10s named cast dealing 10 damage to every living party member, first at
 * 15s into the boss fight then every 25s thereafter.
 */
export const HOLLOW_KING = {
  hp: 999,
  autoDamage: 3,
  swingIntervalMs: 3000,
  extinctionCastMs: 10_000,
  extinctionPartyDamage: 10,
} as const;

/** Mercs (tank + 2 DPS) auto-attack only (poc-spec §2 row 10). Draft damage, tunable. */
export const MERCS = {
  tankAutoDamage: 1,
  dpsAutoDamage: 2,
  swingIntervalMs: 3000,
} as const;

export const SPELLS = {
  solemnMend: { id: 'solemn-mend', name: 'Solemn Mend', heal: 5, mana: 5, castMs: 2000 },
  zealousMending: { id: 'zealous-mending', name: 'Zealous Mending', heal: 5, mana: 8, castMs: 1000 },
  /** Vigil subclass spell (phase-2-handoff): slow, efficient. Granted by the vigil-oath tree node. */
  solemnVigil: { id: 'solemn-vigil', name: 'Solemn Vigil', heal: 9, mana: 7, castMs: 3000 },
  /** Zealot subclass spell (phase-2-handoff): fast, pricey per point. Granted by the zealot-oath tree node. */
  zealousFlare: { id: 'zealous-flare', name: 'Zealous Flare', heal: 3, mana: 4, castMs: 500 },
} as const;

export const REWARDS = {
  goldPerEnemy: 1,
  xpPerEnemy: 1,
  rubyPerFirstClear: 1,
} as const;

/** Micro-choice (poc-spec §10.1): level 2 at 10 XP; only level 2 matters for PoC. */
export const XP_LEVEL_2_THRESHOLD = 10;

export function levelForXp(xp: number): number {
  return xp >= XP_LEVEL_2_THRESHOLD ? 2 : 1;
}
