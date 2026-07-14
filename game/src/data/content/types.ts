import type { EncounterDef } from '../../combat/types';

export const CONTENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Presentation keys that every live MobDef may use; ui/sprites.ts exhaustively maps them. */
export const MOB_VISUAL_KEYS = [
  'ash-husk',
  'iron-husk',
  'gate-warden',
  'spire-lancer',
  'hollow-king',
] as const;
export type MobVisualKey = (typeof MOB_VISUAL_KEYS)[number];

export type EnemyAbilityDef = PartyAoeAbilityDef | TunnelVisionAbilityDef;

/**
 * The runtime currently supports one telegraphed party-wide boss cast.
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
  goldPerEnemy: number;
  goldEveryKills: number;
  xpPerEnemy: number;
  rubyPerFirstClear: number;
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
