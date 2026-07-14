import type { BossCastDef, EncounterDef } from '../../combat/types';
import type {
  ContentCatalogs,
  ContentDiagnostic,
  DungeonDef,
  EffectiveMobStats,
  EnemyAbilityDef,
  MobDef,
  MobStatOverrides,
} from './types';
import { validateContent } from './validate';

export class ContentValidationError extends Error {
  readonly diagnostics: readonly ContentDiagnostic[];

  constructor(diagnostics: readonly ContentDiagnostic[]) {
    super(formatContentDiagnostics(diagnostics));
    this.name = 'ContentValidationError';
    this.diagnostics = diagnostics;
  }
}

export function formatContentDiagnostics(diagnostics: readonly ContentDiagnostic[]): string {
  const errors = diagnostics.filter(({ severity }) => severity === 'error');
  const heading = `Content validation failed with ${errors.length} error${errors.length === 1 ? '' : 's'}`;
  return [heading, ...errors.map((item) => `[${item.code}] ${item.path}: ${item.message}`)].join('\n');
}

export function effectiveMobStats(
  mob: MobDef,
  overrides: MobStatOverrides | undefined,
): EffectiveMobStats {
  return {
    hp: overrides?.hp ?? mob.hp,
    autoDamage: overrides?.autoDamage ?? mob.autoDamage,
    swingIntervalMs: overrides?.swingIntervalMs ?? mob.swingIntervalMs,
  };
}

export function compileDungeon(
  dungeonOrId: DungeonDef | string,
  catalogs: ContentCatalogs,
): EncounterDef {
  assertValid(catalogs);
  return compileValidatedDungeon(dungeonOrId, catalogs);
}

function compileValidatedDungeon(
  dungeonOrId: DungeonDef | string,
  catalogs: ContentCatalogs,
): EncounterDef {
  const dungeon =
    typeof dungeonOrId === 'string'
      ? catalogs.dungeons.find(({ id }) => id === dungeonOrId)
      : dungeonOrId;
  if (dungeon === undefined || !catalogs.dungeons.includes(dungeon)) {
    throw new Error(`Cannot compile unknown dungeon "${String(dungeonOrId)}"`);
  }

  const mobById = new Map(catalogs.mobs.map((mob) => [mob.id, mob]));
  const abilityById = new Map(catalogs.abilities.map((ability) => [ability.id, ability]));
  const finalWave = dungeon.waves[dungeon.waves.length - 1];
  const bossGroup = finalWave?.enemies[0];
  if (bossGroup === undefined) {
    throw new Error(`Cannot compile dungeon "${dungeon.id}" without a final boss`);
  }
  const bossMob = required(mobById, bossGroup.mobId, 'mob');
  const bossStats = effectiveMobStats(bossMob, bossGroup.statOverrides);
  const abilityId = bossMob.abilityIds[0];
  const cast = abilityId === undefined ? undefined : compileAbility(required(abilityById, abilityId, 'ability'));

  return {
    id: dungeon.id,
    name: dungeon.name,
    goldPerEnemy: dungeon.rewards.goldPerEnemy,
    goldEveryKills: dungeon.rewards.goldEveryKills,
    xpPerEnemy: dungeon.rewards.xpPerEnemy,
    rubyPerFirstClear: dungeon.rewards.rubyPerFirstClear,
    waves: dungeon.waves.slice(0, -1).map((wave) => ({
      enemies: wave.enemies.map((group) => {
        const mob = required(mobById, group.mobId, 'mob');
        const stats = effectiveMobStats(mob, group.statOverrides);
        return {
          mobId: mob.id,
          name: mob.name,
          hp: stats.hp,
          count: group.count,
          autoDamage: stats.autoDamage,
          swingIntervalMs: stats.swingIntervalMs,
        };
      }),
    })),
    boss: {
      id: bossMob.id,
      name: bossMob.name,
      hp: bossStats.hp,
      autoDamage: bossStats.autoDamage,
      swingIntervalMs: bossStats.swingIntervalMs,
      ...(cast === undefined ? {} : { cast }),
    },
  };
}

export function compileAllDungeons(catalogs: ContentCatalogs): EncounterDef[] {
  assertValid(catalogs);
  const dungeonById = new Map(catalogs.dungeons.map((dungeon) => [dungeon.id, dungeon]));
  return catalogs.dungeonOrder.map((id) =>
    compileValidatedDungeon(required(dungeonById, id, 'dungeon'), catalogs),
  );
}

function assertValid(catalogs: ContentCatalogs): void {
  const result = validateContent(catalogs);
  if (!result.valid) {
    throw new ContentValidationError([...result.errors, ...result.warnings]);
  }
}

function compileAbility(ability: EnemyAbilityDef): BossCastDef {
  switch (ability.kind) {
    case 'partyAoE':
      return {
        name: ability.name,
        castMs: ability.castMs,
        firstCastAtMs: ability.firstCastAtMs,
        intervalMs: ability.intervalMs,
        partyDamage: ability.partyDamage,
      };
    case 'tunnelVision':
      return {
        kind: 'tunnelVision',
        name: ability.name,
        telegraphMs: ability.telegraphMs,
        firstCastAtMs: ability.firstCastAtMs,
        intervalMs: ability.intervalMs,
        channelMs: ability.channelMs,
        tickMs: ability.tickMs,
        damagePerTick: ability.damagePerTick,
      };
  }
}

function required<T>(map: ReadonlyMap<string, T>, id: string, kind: string): T {
  const value = map.get(id);
  if (value === undefined) throw new Error(`Missing ${kind} "${id}" after content validation`);
  return value;
}
