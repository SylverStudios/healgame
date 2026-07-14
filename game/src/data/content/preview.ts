import type { ContentCatalogs, DungeonDef, EnemyAbilityDef, MobStatOverrides } from './types';
import { compileDungeon, effectiveMobStats } from './compile';

export function formatDungeonPreview(
  dungeonOrId: DungeonDef | string,
  catalogs: ContentCatalogs,
): string {
  const dungeon =
    typeof dungeonOrId === 'string'
      ? catalogs.dungeons.find(({ id }) => id === dungeonOrId)
      : dungeonOrId;
  if (dungeon === undefined) throw new Error(`Cannot preview unknown dungeon "${String(dungeonOrId)}"`);
  void compileDungeon(dungeon, catalogs);

  const mobById = new Map(catalogs.mobs.map((mob) => [mob.id, mob]));
  const abilityById = new Map(catalogs.abilities.map((ability) => [ability.id, ability]));
  const lines = [
    `Dungeon ${dungeon.order}: ${dungeon.name} [${dungeon.id}]`,
    `Unlock: ${
      dungeon.unlock.kind === 'always'
        ? 'always'
        : `clear ${dungeon.unlock.dungeonId}`
    }`,
    `Rewards: gold ${dungeon.rewards.goldPerEnemy}/${dungeon.rewards.goldEveryKills} enemies, XP ${dungeon.rewards.xpPerEnemy}/enemy, ruby ${dungeon.rewards.rubyPerFirstClear}/first clear`,
    `Visual: ${dungeon.visualKey}`,
  ];

  dungeon.waves.forEach((wave, waveIndex) => {
    const final = waveIndex === dungeon.waves.length - 1;
    lines.push(`Wave ${waveIndex + 1}${final ? ' (boss)' : ''}:`);
    wave.enemies.forEach((group) => {
      const mob = mobById.get(group.mobId);
      if (mob === undefined) throw new Error(`Missing mob "${group.mobId}" after content validation`);
      const stats = effectiveMobStats(mob, group.statOverrides);
      lines.push(
        `  ${group.count}x ${mob.name} [${mob.id}] — HP ${stats.hp}, auto ${stats.autoDamage}/${stats.swingIntervalMs}ms, boss ${mob.tags.includes('boss') ? 'yes' : 'no'}, overrides ${formatOverrides(group.statOverrides)}`,
      );
      if (mob.abilityIds.length === 0) {
        lines.push('    Abilities: none');
      } else {
        mob.abilityIds.forEach((id) => {
          const ability = abilityById.get(id);
          if (ability === undefined) throw new Error(`Missing ability "${id}" after content validation`);
          lines.push(`    Ability: ${formatAbility(ability)}`);
        });
      }
    });
  });

  return lines.join('\n');
}

function formatOverrides(overrides: MobStatOverrides | undefined): string {
  if (overrides === undefined || Object.keys(overrides).length === 0) return 'none';
  return (['hp', 'autoDamage', 'swingIntervalMs'] as const)
    .filter((key) => overrides[key] !== undefined)
    .map((key) => `${key}=${String(overrides[key])}`)
    .join(', ');
}

function formatAbility(ability: EnemyAbilityDef): string {
  switch (ability.kind) {
    case 'partyAoE':
      return `${ability.name} [${ability.id}] partyAoE — cast ${ability.castMs}ms, first ${ability.firstCastAtMs}ms, interval ${ability.intervalMs}ms, party damage ${ability.partyDamage}`;
    case 'tunnelVision':
      return `${ability.name} [${ability.id}] tunnelVision — telegraph ${ability.telegraphMs}ms, first ${ability.firstCastAtMs}ms, interval ${ability.intervalMs}ms, channel ${ability.channelMs}ms, tick ${ability.tickMs}ms, tick damage ${ability.damagePerTick}`;
  }
}
