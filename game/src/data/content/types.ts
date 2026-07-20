import type { EncounterDef } from '../../combat/types';

export const CONTENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Presentation keys that every live MobDef may use; ui/sprites.ts exhaustively maps them. */
export const MOB_VISUAL_KEYS = [
  'ash-husk',
  'iron-husk',
  'gate-warden',
  'spire-lancer',
  'hollow-king',
  'cinder-wraith',
  'ember-colossus',
  'choir-shade',
  'dirge-sovereign',
  'thorn-husk',
  'thorn-matriarch',
  'gloam-wretch',
  'veil-cantor',
] as const;
export type MobVisualKey = (typeof MOB_VISUAL_KEYS)[number];

export type EnemyAbilityDef =
  | PartyAoeAbilityDef
  | TunnelVisionAbilityDef
  | PartyDoTAbilityDef
  | ManaSiphonAbilityDef;

/**
 * v0.3 chunk F "Boss telegraphs": data-driven wind-up cue played on the boss
 * sprite for the bossCastStarted → bossCastFinished window (Tunnel Vision:
 * just its telegraph phase, not the channel — see combat/README.md "Telegraph
 * → channel"). Optional; CombatScene defaults to 'glow' when absent. Kept to
 * three members by design ("keep the set tiny" — docs/v0.3-handoff.md).
 * Presentation-only — never reaches the engine (BossCastDef/BossCastState in
 * combat/types.ts are untouched; CombatScene resolves this straight off the
 * authoring registries via the boss's stable mobId).
 */
export type BossTelegraphCue = 'glow' | 'raise' | 'pulse';

/**
 * The runtime currently supports one telegraphed boss cast per boss.
 * Add future mechanics as new `kind` members instead of optional fields here.
 */
export interface PartyAoeAbilityDef {
  id: string;
  name: string;
  kind: 'partyAoE';
  castMs: number;
  firstCastAtMs: number;
  intervalMs: number;
  partyDamage: number;
  visualKey: string;
  telegraph?: BossTelegraphCue;
}

export interface TunnelVisionAbilityDef {
  id: string;
  name: string;
  kind: 'tunnelVision';
  telegraphMs: number;
  firstCastAtMs: number;
  intervalMs: number;
  channelMs: number;
  tickMs: number;
  damagePerTick: number;
  visualKey: string;
  telegraph?: BossTelegraphCue;
}

/**
 * Telegraphed cast that then scorches every living party member for a fixed
 * DoT window (Cinder Vault / Emberfall). DoT duration is not part of cast
 * occupancy — a later telegraph may start while ticks are still landing.
 */
export interface PartyDoTAbilityDef {
  id: string;
  name: string;
  kind: 'partyDoT';
  castMs: number;
  firstCastAtMs: number;
  intervalMs: number;
  durationMs: number;
  tickMs: number;
  damagePerTick: number;
  visualKey: string;
  telegraph?: BossTelegraphCue;
}

/**
 * Telegraphed party spike that also drains healer mana (Black Choir / Soul
 * Toll). Mana burn is the soft gate that current tree mana pools cannot outpace.
 */
export interface ManaSiphonAbilityDef {
  id: string;
  name: string;
  kind: 'manaSiphon';
  castMs: number;
  firstCastAtMs: number;
  intervalMs: number;
  partyDamage: number;
  manaBurn: number;
  visualKey: string;
  telegraph?: BossTelegraphCue;
}

export type MobTag = 'trash' | 'boss';

export interface MobDef {
  id: string;
  name: string;
  tags: readonly MobTag[];
  hp: number;
  autoDamage: number;
  swingIntervalMs: number;
  abilityIds: readonly string[];
  visualKey: MobVisualKey;
}

export interface MobStatOverrides {
  hp?: number;
  autoDamage?: number;
  swingIntervalMs?: number;
}

export interface DungeonMobGroupDef {
  mobId: string;
  count: number;
  statOverrides?: MobStatOverrides;
}

export interface DungeonWaveDef {
  enemies: readonly DungeonMobGroupDef[];
}

export type DungeonUnlockRequirement =
  | { kind: 'always' }
  | { kind: 'dungeonClear'; dungeonId: string };

export interface DungeonRewardsDef {
  xpPerEnemy: number;
}

/** Authoring form: unlike EncounterDef, the final boss is an ordinary ordered wave. */
export interface DungeonDef {
  id: string;
  name: string;
  order: number;
  unlock: DungeonUnlockRequirement;
  rewards: DungeonRewardsDef;
  visualKey: string;
  waves: readonly DungeonWaveDef[];
}

export interface ContentCatalogs {
  abilities: readonly EnemyAbilityDef[];
  mobs: readonly MobDef[];
  dungeons: readonly DungeonDef[];
  dungeonOrder: readonly string[];
  visualKeys: readonly string[];
}

export type DiagnosticSeverity = 'error' | 'warning';

export interface ContentDiagnostic {
  severity: DiagnosticSeverity;
  code: string;
  path: string;
  message: string;
}

export interface ContentValidationResult {
  valid: boolean;
  errors: ContentDiagnostic[];
  warnings: ContentDiagnostic[];
}

export interface EffectiveMobStats {
  hp: number;
  autoDamage: number;
  swingIntervalMs: number;
}

/** Useful to callers migrating incrementally from the current encounter module. */
export type CompiledDungeon = EncounterDef;
