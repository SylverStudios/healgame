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
  // Phase 3 (handoff §B) retune: bumped from 3 (see balance.test.ts gates —
  // the starting kit must never cruise to a full-party clear).
  autoDamage: 4,
  // Phase 3 (handoff §B): desynced from TRASH's 3000ms so boss/trash swings
  // don't line up every tick.
  swingIntervalMs: 3500,
  bonehowlCastMs: 10_000,
  bonehowlPartyDamage: 4,
} as const;

/**
 * Iron Pass (Dungeon 2, alpha-0.1-handoff §D2) trash: same "Ash Husk" template
 * (reskinned "Iron Husk" in data only), harder than Ash Gate's global `TRASH`
 * (1 dmg / 3000ms) per the handoff's "bump damage +1 vs Ash Gate feel"
 * guidance.
 *
 * NOT currently wired into the engine: `engine.ts` swings all non-boss
 * enemies off the single global `TRASH` constant (no per-encounter trash
 * stats in `EnemyGroupDef`/`EncounterDef`). Flagged as a cross-boundary gap
 * for the central agent — Iron Pass trash uses global `TRASH` for now.
 */
export const IRON_TRASH = {
  autoDamage: 2,
  swingIntervalMs: 3000,
} as const;

/**
 * Iron Pass boss (alpha-0.1-handoff §D3): "Spire Lancer" — draft hp 170,
 * auto damage 4 per 3.5s swing (same cadence feel as Gate Warden), plus the
 * Tunnel Vision cast: 3s telegraph, then a 10s channel ticking 2 damage/s
 * into one focused non-tank party member (≈2× that unit's 10hp maxHp if
 * unhealed). First telegraph at 8s into the boss fight, then every 30s
 * (start-to-start cadence — see combat/README.md).
 */
export const SPIRE_LANCER = {
  hp: 170,
  autoDamage: 4,
  swingIntervalMs: 3500,
  telegraphMs: 3000,
  firstCastAtMs: 8000,
  intervalMs: 30_000,
  channelMs: 10_000,
  tickMs: 1000,
  damagePerTick: 2,
} as const;

/**
 * Dungeon 2 boss (poc-spec §1 item 8, §7): "insanely overpowered" on purpose
 * — the party cannot win with PoC power. Auto damage 3 per 3.5s; Extinction is
 * a 10s named cast dealing 10 damage to every living party member, first at
 * 15s into the boss fight then every 25s thereafter.
 */
export const HOLLOW_KING = {
  hp: 999,
  autoDamage: 3,
  swingIntervalMs: 3500,
  extinctionCastMs: 10_000,
  extinctionPartyDamage: 10,
} as const;

/**
 * Mercs (tank + 2 DPS) auto-attack only (poc-spec §2 row 10). Draft damage,
 * tunable. Phase 3 (handoff §B): per-role swing intervals (no phase offsets)
 * so simultaneous merc swings are rare — tank is slow or hard-hitting, DPS
 * swing faster for less.
 */
export const MERCS = {
  tankAutoDamage: 1,
  dpsAutoDamage: 2,
  tankSwingIntervalMs: 2500,
  dpsSwingIntervalMs: 1000,
} as const;

export const SPELLS = {
  solemnMend: { id: 'solemn-mend', name: 'Solemn Mend', heal: 5, mana: 5, castMs: 2000 },
  zealousMending: { id: 'zealous-mending', name: 'Zealous Mending', heal: 6, mana: 6, castMs: 1000 },
  /** Vigil subclass spell (phase-2-handoff): slow, efficient. Granted by the vigil-oath tree node. */
  solemnVigil: { id: 'solemn-vigil', name: 'Solemn Vigil', heal: 9, mana: 7, castMs: 3000 },
  /** Zealot subclass spell (phase-2-handoff): fast, pricey per point. Granted by the zealot-oath tree node. */
  zealousFlare: { id: 'zealous-flare', name: 'Zealous Flare', heal: 3, mana: 4, castMs: 500 },
} as const;

export const REWARDS = {
  goldPerEnemy: 1,
  xpPerEnemy: 1,
  rubyPerFirstClear: 1,
  /**
   * Alpha 0.1 §D1: rubies stay Ash-Gate-only — an Iron Pass first clear
   * records the clear (unlocking The Maw) but grants no ruby.
   */
  rubyFirstClearDungeonIds: ['ash-gate'],
} as const;

/** Micro-choice (poc-spec §10.1): level 2 at 10 XP; only level 2 matters for PoC. */
export const XP_LEVEL_2_THRESHOLD = 10;

export function levelForXp(xp: number): number {
  return xp >= XP_LEVEL_2_THRESHOLD ? 2 : 1;
}
