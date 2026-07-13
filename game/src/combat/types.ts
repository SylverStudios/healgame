/**
 * Engine-agnostic combat types (poc-spec §4). No Phaser imports here — Chunk 2
 * builds the view against exactly this surface.
 */

export type UnitRole = 'tank' | 'dps' | 'healer' | 'enemy' | 'boss';

export interface Unit {
  id: string;
  name: string;
  role: UnitRole;
  hp: number;
  maxHp: number;
  /** 0/0 for non-healers (mercs, enemies). */
  mana: number;
  maxMana: number;
  alive: boolean;
}

export interface SpellDef {
  id: string;
  name: string;
  heal: number;
  mana: number;
  castMs: number;
}

/**
 * A completed cast of `triggerSpellId` arms this rule; the next completed
 * cast of `buffedSpellId` consumes it, adding `bonusHeal` to that heal's raw
 * value (phase-2-handoff "Engine"). Structurally identical to
 * `Loadout['synergies'][number]` in meta/progression.ts — combat/ never
 * imports meta/, so this is redefined here.
 */
export interface SynergyRule {
  triggerSpellId: string;
  buffedSpellId: string;
  bonusHeal: number;
}

/**
 * On a completed cast of `spellId`, adds `healPer10PctMissing` per full 10%
 * of the target's HP missing (computed before the heal lands). Structurally
 * identical to `Loadout['missingHealthBonuses'][number]`.
 */
export interface MissingHealthBonusRule {
  spellId: string;
  healPer10PctMissing: number;
}

/**
 * On a completed cast of `spellId`, adds
 * `ceil(spell.heal * pctPer10PctMissing * bands / 100)` where
 * `bands = floor((maxHp - hp) * 10 / maxHp)`, computed on the target BEFORE
 * the heal lands — same banding as `MissingHealthBonusRule`, but
 * percent-of-base-heal (not flat), rounded up. `spell.heal` is always the
 * completing spell's *base* printed heal, never a synergy-buffed total
 * (Alpha 0.1 §D4 Graven Scale: pctPer10PctMissing = 5).
 */
export interface MissingHealthPctBonusRule {
  spellId: string;
  pctPer10PctMissing: number;
}

/**
 * On a completed cast of `spellId`, adds `bonusHeal` when the target's HP
 * BEFORE the heal is at least `hpPctAtLeast` percent of maxHp (Alpha 0.1 §D4
 * Steady Hands: 80, +1). Threshold check is
 * `target.hp * 100 >= rule.hpPctAtLeast * target.maxHp` — integer-safe, no
 * floats — and inclusive (a target exactly at the threshold qualifies).
 */
export interface FullHealthBonusRule {
  spellId: string;
  hpPctAtLeast: number;
  bonusHeal: number;
}

/**
 * A cooldown's gameplay effect (Alpha 0.1 §D6 — first major CDs, off-GCD).
 * `freeNextHeal` (Still Waters): arms a charge; the first player cast that
 * STARTS while armed bypasses the affordability check, reserves 0 mana, and
 * consumes the charge at cast start. `manaCostReduction` (Frenzied Liturgy):
 * opens a `durationMs` window (sim time) during which heal casts reserve
 * `max(0, spell.mana - costReduction)` at cast start.
 */
export type CooldownEffect =
  | { kind: 'freeNextHeal' }
  | { kind: 'manaCostReduction'; durationMs: number; costReduction: number };

/** Data-driven cooldown definition (instances live in data/cooldowns.ts). */
export interface CooldownDef {
  id: string;
  name: string;
  description: string;
  cooldownMs: number;
  effect: CooldownEffect;
}

/**
 * Per-CD live state exposed on CombatState for the UI (spellBar.ts). Same
 * order as the `cooldowns` option passed to the constructor.
 */
export interface CooldownState {
  id: string;
  name: string;
  /** 0 = ready to activate. */
  remainingCooldownMs: number;
  /**
   * manaCostReduction: ms left in the buff window. freeNextHeal: `1` while a
   * charge is armed, `0` otherwise — an armed flag, not a duration (see
   * combat/README.md). Either way, `> 0` means "show the active-buff accent".
   */
  activeRemainingMs: number;
}

/**
 * A relic's gameplay effect (Alpha 0.1 §D7 — one-time pick of 1-of-3 run
 * modifiers, locked for the save). Relics are **not** tree nodes: they're
 * resolved from `save.relicId` (`data/relics.ts`) and passed into the engine
 * separately, alongside the tree-derived `CombatEngineOptions`.
 */
export type RelicEffect =
  | { kind: 'overhealManaRestore'; mana: number }
  | { kind: 'thresholdHealMod'; thresholdPct: number; bonusBelow: number; penaltyAtOrAbove: number; minHeal: number }
  | { kind: 'manaRegenTradeoff'; maxManaDelta: number; regenIntervalMs: number; regenAmount: number };

/** Data-driven relic definition (instances live in data/relics.ts). */
export interface RelicDef {
  id: string;
  name: string;
  description: string;
  effect: RelicEffect;
}

export interface CombatEngineOptions {
  /** Adds to the healer's max AND starting mana (e.g. Deep Reserves). */
  bonusMaxMana?: number;
  synergies?: SynergyRule[];
  missingHealthBonuses?: MissingHealthBonusRule[];
  missingHealthPctBonuses?: MissingHealthPctBonusRule[];
  fullHealthBonuses?: FullHealthBonusRule[];
  /** Alpha 0.1 §D6: cooldowns granted by the tree (e.g. Still Waters, Frenzied Liturgy). */
  cooldowns?: CooldownDef[];
  /** Alpha 0.1 §D7: the player's one locked-in relic pick, if any (resolved from save.relicId). */
  relic?: RelicDef | undefined;
}

export interface CastState {
  spellId: string;
  targetId: string;
  remainingMs: number;
  totalMs: number;
}

export interface BossCastState {
  name: string;
  remainingMs: number;
  totalMs: number;
}

export type CombatStatus = 'running' | 'victory' | 'wipe';

export type CombatEvent =
  | { type: 'damage'; targetId: string; amount: number; sourceId: string }
  | { type: 'heal'; targetId: string; amount: number; overheal: number; spellId: string }
  | { type: 'castStarted'; cast: CastState }
  | { type: 'castFinished'; spellId: string }
  | { type: 'castCancelled'; spellId: string; reason: 'escape' | 'target-dead' }
  | { type: 'bossCastStarted'; cast: BossCastState }
  | { type: 'bossCastFinished'; name: string }
  | { type: 'bossFocusStarted'; targetId: string; name: string; totalMs: number }
  | { type: 'bossFocusTick'; targetId: string; amount: number }
  | { type: 'bossFocusEnded'; targetId: string; name: string }
  | { type: 'cooldownActivated'; id: string; name: string }
  | { type: 'cooldownBuffEnded'; id: string }
  /** Alpha 0.1 §D7: emitted on Ember Ledger's once-per-combat overheal restore and on each
   *  Still Reservoir regen tick. NOT emitted for Triage Bell (its heal mods already show in
   *  the heal numbers). */
  | { type: 'relicTriggered'; id: string; name: string }
  | { type: 'unitDied'; unitId: string }
  | { type: 'waveStarted'; waveIndex: number }
  | { type: 'combatEnded'; status: CombatStatus };

export interface CombatState {
  party: Unit[];
  /** Live (and just-died-this-tick) units of the current wave, or the boss once spawned. */
  enemies: Unit[];
  playerCast: CastState | null;
  bossCast: BossCastState | null;
  targetId: string | null;
  gcdRemainingMs: number;
  waveIndex: number;
  status: CombatStatus;
  /** Spell ids that currently have at least one armed synergy buffing them. */
  armedBuffedSpellIds: string[];
  /** Alpha 0.1 §D6: live cooldown state, same order as the constructor's `cooldowns` option; empty when none. */
  cooldowns: CooldownState[];
}

/**
 * One group of identical trash enemies within a wave (poc-spec §7).
 * `autoDamage`/`swingIntervalMs` override the global TRASH constants per
 * group (Alpha 0.1 §D2: Iron Pass trash hits harder without touching Ash
 * Gate); omitted = TRASH fallback.
 */
export interface EnemyGroupDef {
  name: string;
  hp: number;
  count: number;
  autoDamage?: number;
  swingIntervalMs?: number;
}

export interface WaveDef {
  enemies: EnemyGroupDef[];
}

/**
 * Bonehowl-style named boss cast: telegraphed, hits every living party member
 * on completion. `kind` is optional here (defaults to this arm) so existing
 * encounter data/tests written before the Tunnel Vision union stay valid
 * unchanged.
 */
export interface PartyAoECastDef {
  kind?: 'partyAoE';
  name: string;
  castMs: number;
  /** Delay from boss-phase start to the first cast start. */
  firstCastAtMs: number;
  /** Cast-start-to-cast-start cadence; the gap between casts is intervalMs - castMs. */
  intervalMs: number;
  partyDamage: number;
}

/**
 * Tunnel Vision-style boss cast (Alpha 0.1 §D3): a named telegraph, then a
 * channel that ticks damage into one focused non-tank party member. Boss
 * auto-attacks continue on the tank throughout both phases (not a full
 * interrupt) — see combat/README.md.
 */
export interface TunnelVisionCastDef {
  kind: 'tunnelVision';
  name: string;
  /** Named cast-bar warning before the channel begins. */
  telegraphMs: number;
  /** Delay from boss-phase start to first telegraph start; intervalMs is telegraph-start-to-telegraph-start. */
  firstCastAtMs: number;
  intervalMs: number;
  channelMs: number;
  tickMs: number;
  damagePerTick: number;
}

export type BossCastDef = PartyAoECastDef | TunnelVisionCastDef;

export interface BossDef {
  id: string;
  name: string;
  hp: number;
  autoDamage: number;
  swingIntervalMs: number;
  cast?: BossCastDef;
}

export interface EncounterDef {
  id: string;
  name: string;
  waves: WaveDef[];
  boss: BossDef;
}
