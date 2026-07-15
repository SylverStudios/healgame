/**
 * Engine-agnostic combat types (poc-spec §4). No Phaser imports here — Chunk 2
 * builds the view against exactly this surface.
 */

export type UnitRole = 'tank' | 'dps' | 'healer' | 'enemy' | 'boss';

export interface Unit {
  id: string;
  /** Stable authored mob identity when this unit was spawned from catalog content. */
  mobId?: string;
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
  /** Alpha 0.2 §D8 — placeholder glyph key/character for tree + spell bar. */
  glyph?: string;
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
 * A cooldown's gameplay effect (Alpha 0.1 §D6 — first major CDs, off-GCD;
 * Alpha 0.2 adds `healBonus` for Wrath Ascendant).
 * `freeNextHeal` (Still Waters): arms a charge; the first player cast that
 * STARTS while armed bypasses the affordability check, reserves 0 mana, and
 * consumes the charge at cast start. `manaCostReduction` (Frenzied Liturgy):
 * opens a `durationMs` window (sim time) during which heal casts reserve
 * `max(0, spell.mana - costReduction)` at cast start. `healBonus` (Wrath
 * Ascendant): opens a `durationMs` window during which every completed player
 * heal adds `bonusHeal` to raw heal **after** synergy / missing-health /
 * full-health / relic `bonusHealing` (Alpha 0.2 §D6).
 */
export type CooldownEffect =
  | { kind: 'freeNextHeal' }
  | { kind: 'manaCostReduction'; durationMs: number; costReduction: number }
  | { kind: 'healBonus'; durationMs: number; bonusHeal: number };

/** Data-driven cooldown definition (instances live in data/cooldowns.ts). */
export interface CooldownDef {
  id: string;
  name: string;
  description: string;
  cooldownMs: number;
  effect: CooldownEffect;
  /** Alpha 0.2 §D8 — placeholder glyph key/character for tree + spell bar. */
  glyph?: string;
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
   * manaCostReduction / healBonus: ms left in the buff window. freeNextHeal:
   * `1` while a charge is armed, `0` otherwise — an armed flag, not a duration
   * (see combat/README.md). Either way, `> 0` means "show the active-buff
   * accent".
   */
  activeRemainingMs: number;
}

/** Simple permanent stat effects awarded by first-clear relic choices. */
export type RelicEffect =
  | { kind: 'bonusMaxMana'; amount: number }
  | { kind: 'manaRegen'; amount: number; intervalMs: number }
  | { kind: 'bonusHealing'; amount: number }
  | { kind: 'roleMaxHp'; role: 'tank' | 'dps' | 'healer'; amount: number }
  | { kind: 'roleArmor'; role: 'tank' | 'dps' | 'healer'; amount: number }
  | { kind: 'roleAutoDamage'; role: 'tank' | 'dps'; amount: number }
  | { kind: 'roleSwingInterval'; role: 'tank' | 'dps'; deltaMs: number };

/** Data-driven relic definition (instances live in data/relics.ts). */
export interface RelicDef {
  id: string;
  name: string;
  description: string;
  effects: RelicEffect[];
}

export interface CombatEngineOptions {
  /** Adds to the healer's max AND starting mana (e.g. Deep Reserves + level). */
  bonusMaxMana?: number;
  /**
   * Alpha 0.2: combat mana regen from level (or loadout). Merged with relic
   * `manaRegen`: amounts sum; interval is the minimum of every contributing
   * source (see combat/README.md).
   */
  manaRegen?: { amount: number; intervalMs: number };
  synergies?: SynergyRule[];
  missingHealthBonuses?: MissingHealthBonusRule[];
  missingHealthPctBonuses?: MissingHealthPctBonusRule[];
  fullHealthBonuses?: FullHealthBonusRule[];
  /** Alpha 0.1 §D6: cooldowns granted by the tree (e.g. Still Waters, Frenzied Liturgy). */
  cooldowns?: CooldownDef[];
  /** Permanent relics selected on prior dungeon first clears. */
  relics?: RelicDef[];
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
  | { type: 'partyDoTStarted'; name: string; totalMs: number }
  | { type: 'partyDoTEnded'; name: string }
  | { type: 'manaBurned'; amount: number }
  | { type: 'cooldownActivated'; id: string; name: string }
  | { type: 'cooldownBuffEnded'; id: string }
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
  /** Catalog identity. Optional only for compatibility with synthetic test encounters. */
  mobId?: string;
  name: string;
  hp: number;
  count: number;
  /** Falls back to the legacy trash constant for synthetic encounters. */
  autoDamage?: number;
  /** Falls back to the legacy trash constant for synthetic encounters. */
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

/**
 * Emberfall-style telegraphed cast: on finish, a party-wide DoT ticks for
 * `durationMs`. Cadence matches partyAoE (cast-start-to-cast-start); the DoT
 * may still be ticking when the next telegraph begins.
 */
export interface PartyDoTCastDef {
  kind: 'partyDoT';
  name: string;
  castMs: number;
  firstCastAtMs: number;
  intervalMs: number;
  durationMs: number;
  tickMs: number;
  damagePerTick: number;
}

/**
 * Soul Toll-style telegraphed cast: party-wide damage plus a fixed mana drain
 * on the healer. Cadence matches partyAoE.
 */
export interface ManaSiphonCastDef {
  kind: 'manaSiphon';
  name: string;
  castMs: number;
  firstCastAtMs: number;
  intervalMs: number;
  partyDamage: number;
  manaBurn: number;
}

export type BossCastDef =
  | PartyAoECastDef
  | TunnelVisionCastDef
  | PartyDoTCastDef
  | ManaSiphonCastDef;

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
  /** Resolved catalog rewards; legacy synthetic encounters fall back to reward constants. */
  xpPerEnemy?: number;
  waves: WaveDef[];
  boss: BossDef;
}
