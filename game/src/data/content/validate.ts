import {
  CONTENT_ID_PATTERN,
  type ContentCatalogs,
  type ContentDiagnostic,
  type ContentValidationResult,
  type DungeonDef,
} from './types';

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function diagnostic(
  severity: ContentDiagnostic['severity'],
  code: string,
  path: string,
  message: string,
): ContentDiagnostic {
  return { severity, code, path, message };
}

export function validateContent(catalogs: ContentCatalogs): ContentValidationResult {
  const errors: ContentDiagnostic[] = [];
  const warnings: ContentDiagnostic[] = [];
  const error = (code: string, path: string, message: string): void => {
    errors.push(diagnostic('error', code, path, message));
  };
  const warning = (code: string, path: string, message: string): void => {
    warnings.push(diagnostic('warning', code, path, message));
  };

  const validateIds = (kind: string, entries: readonly { id: string }[]): void => {
    const seen = new Set<string>();
    entries.forEach((entry, index) => {
      const path = `${kind}[${index}].id`;
      if (!CONTENT_ID_PATTERN.test(entry.id)) {
        error('invalid-slug-id', path, `"${entry.id}" must be a lowercase slug`);
      }
      if (seen.has(entry.id)) {
        error('duplicate-id', path, `duplicate ${kind} id "${entry.id}"`);
      }
      seen.add(entry.id);
    });
  };

  validateIds('abilities', catalogs.abilities);
  validateIds('mobs', catalogs.mobs);
  validateIds('dungeons', catalogs.dungeons);

  const abilityIds = new Set(catalogs.abilities.map(({ id }) => id));
  const mobById = new Map(catalogs.mobs.map((mob) => [mob.id, mob]));
  const dungeonById = new Map(catalogs.dungeons.map((dungeon) => [dungeon.id, dungeon]));
  const visualKeys = new Set(catalogs.visualKeys);
  const usedAbilities = new Set<string>();
  const usedMobs = new Set<string>();

  const checkVisualKey = (key: string, path: string): void => {
    if (!visualKeys.has(key)) {
      error('unknown-visual-key', path, `visual key "${key}" is not registered`);
    }
  };

  catalogs.visualKeys.forEach((key, index) => {
    if (!CONTENT_ID_PATTERN.test(key)) {
      error('invalid-visual-key', `visualKeys[${index}]`, `"${key}" must be a lowercase slug`);
    }
    if (catalogs.visualKeys.indexOf(key) !== index) {
      error('duplicate-visual-key', `visualKeys[${index}]`, `duplicate visual key "${key}"`);
    }
  });

  catalogs.abilities.forEach((ability, index) => {
    const path = `abilities[${index}]`;
    if (ability.kind !== 'partyAoE') {
      error('unsupported-ability-kind', `${path}.kind`, `ability kind "${String(ability.kind)}" is unsupported`);
      return;
    }
    (
      [
        ['castMs', ability.castMs],
        ['firstCastAtMs', ability.firstCastAtMs],
        ['intervalMs', ability.intervalMs],
        ['partyDamage', ability.partyDamage],
      ] as const
    ).forEach(([field, value]) => {
      if (!isPositiveInteger(value)) {
        error('invalid-positive-integer', `${path}.${field}`, `${field} must be a positive integer`);
      }
    });
    if (
      isPositiveInteger(ability.intervalMs) &&
      isPositiveInteger(ability.castMs) &&
      ability.intervalMs < ability.castMs
    ) {
      error(
        'invalid-cast-cadence',
        `${path}.intervalMs`,
        `intervalMs ${ability.intervalMs} must be at least castMs ${ability.castMs}`,
      );
    }
    checkVisualKey(ability.visualKey, `${path}.visualKey`);
  });

  catalogs.mobs.forEach((mob, index) => {
    const path = `mobs[${index}]`;
    (
      [
        ['hp', mob.hp],
        ['autoDamage', mob.autoDamage],
        ['swingIntervalMs', mob.swingIntervalMs],
      ] as const
    ).forEach(([field, value]) => {
      if (!isPositiveInteger(value)) {
        error('invalid-positive-integer', `${path}.${field}`, `${field} must be a positive integer`);
      }
    });
    if (mob.tags.length === 0) {
      error('missing-mob-tag', `${path}.tags`, 'mob must have at least one tag');
    }
    if (new Set(mob.tags).size !== mob.tags.length) {
      error('duplicate-mob-tag', `${path}.tags`, 'mob tags must be unique');
    }
    if (mob.abilityIds.length > 1) {
      error(
        'runtime-ability-limit',
        `${path}.abilityIds`,
        `current runtime supports at most one ability; found ${mob.abilityIds.length}`,
      );
    }
    mob.abilityIds.forEach((abilityId, abilityIndex) => {
      usedAbilities.add(abilityId);
      if (!abilityIds.has(abilityId)) {
        error(
          'unknown-ability-ref',
          `${path}.abilityIds[${abilityIndex}]`,
          `ability "${abilityId}" is not registered`,
        );
      }
    });
    checkVisualKey(mob.visualKey, `${path}.visualKey`);
  });

  const orderedIds = new Set<string>();
  catalogs.dungeonOrder.forEach((id, index) => {
    const path = `dungeonOrder[${index}]`;
    if (orderedIds.has(id)) {
      error('duplicate-dungeon-order-id', path, `dungeon "${id}" appears more than once in order`);
    }
    orderedIds.add(id);
    const dungeon = dungeonById.get(id);
    if (dungeon === undefined) {
      error('unknown-dungeon-order-ref', path, `dungeon "${id}" is not registered`);
    } else if (dungeon.order !== index + 1) {
      error(
        'dungeon-order-mismatch',
        `${path}`,
        `dungeon "${id}" declares order ${dungeon.order}, expected ${index + 1}`,
      );
    }
  });

  catalogs.dungeons.forEach((dungeon, dungeonIndex) => {
    const path = `dungeons[${dungeonIndex}]`;
    validateDungeon(dungeon, path, mobById, usedMobs, error);
    if (!orderedIds.has(dungeon.id)) {
      error('missing-dungeon-order-id', `${path}.id`, `dungeon "${dungeon.id}" is absent from dungeonOrder`);
    }
    if (!isPositiveInteger(dungeon.order)) {
      error('invalid-positive-integer', `${path}.order`, 'order must be a positive integer');
    }
    (
      [
        ['goldPerEnemy', dungeon.rewards.goldPerEnemy],
        ['xpPerEnemy', dungeon.rewards.xpPerEnemy],
        ['rubyPerFirstClear', dungeon.rewards.rubyPerFirstClear],
      ] as const
    ).forEach(([field, value]) => {
      if (!isPositiveInteger(value)) {
        error(
          'invalid-positive-integer',
          `${path}.rewards.${field}`,
          `${field} must be a positive integer`,
        );
      }
    });
    checkVisualKey(dungeon.visualKey, `${path}.visualKey`);
    if (dungeon.unlock.kind === 'dungeonClear') {
      const target = dungeonById.get(dungeon.unlock.dungeonId);
      if (target === undefined) {
        error(
          'unknown-unlock-ref',
          `${path}.unlock.dungeonId`,
          `dungeon "${dungeon.unlock.dungeonId}" is not registered`,
        );
      } else if (target.order >= dungeon.order) {
        error(
          'unlock-order-mismatch',
          `${path}.unlock.dungeonId`,
          `unlock dungeon "${target.id}" must come before "${dungeon.id}"`,
        );
      }
    }
  });

  detectUnlockCycles(catalogs.dungeons, dungeonById, error);

  catalogs.abilities.forEach((ability, index) => {
    if (!usedAbilities.has(ability.id)) {
      warning('unused-ability', `abilities[${index}].id`, `ability "${ability.id}" is unused`);
    }
  });
  catalogs.mobs.forEach((mob, index) => {
    if (!usedMobs.has(mob.id)) {
      warning('unused-mob', `mobs[${index}].id`, `mob "${mob.id}" is unused`);
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}

function validateDungeon(
  dungeon: DungeonDef,
  path: string,
  mobById: ReadonlyMap<string, ContentCatalogs['mobs'][number]>,
  usedMobs: Set<string>,
  error: (code: string, path: string, message: string) => void,
): void {
  if (dungeon.waves.length === 0) {
    error('empty-dungeon', `${path}.waves`, 'dungeon must contain at least one wave');
    return;
  }

  dungeon.waves.forEach((wave, waveIndex) => {
    const wavePath = `${path}.waves[${waveIndex}]`;
    if (wave.enemies.length === 0) {
      error('empty-wave', `${wavePath}.enemies`, 'wave must contain at least one enemy group');
    }
    wave.enemies.forEach((group, groupIndex) => {
      const groupPath = `${wavePath}.enemies[${groupIndex}]`;
      if (!isPositiveInteger(group.count)) {
        error('invalid-positive-integer', `${groupPath}.count`, 'count must be a positive integer');
      }
      const mob = mobById.get(group.mobId);
      usedMobs.add(group.mobId);
      if (mob === undefined) {
        error('unknown-mob-ref', `${groupPath}.mobId`, `mob "${group.mobId}" is not registered`);
      } else if (waveIndex < dungeon.waves.length - 1 && mob.tags.includes('boss')) {
        error('boss-before-final-wave', `${groupPath}.mobId`, `boss "${mob.id}" may only appear in the final wave`);
      }
      if (group.statOverrides !== undefined) {
        Object.entries(group.statOverrides).forEach(([field, value]) => {
          if (!isPositiveInteger(value)) {
            error(
              'invalid-positive-integer',
              `${groupPath}.statOverrides.${field}`,
              `${field} override must be a positive integer`,
            );
          }
        });
      }
    });
  });

  const finalWaveIndex = dungeon.waves.length - 1;
  const finalWave = dungeon.waves[finalWaveIndex];
  if (finalWave === undefined) return;
  const finalPath = `${path}.waves[${finalWaveIndex}]`;
  if (finalWave.enemies.length !== 1) {
    error('invalid-boss-wave-size', `${finalPath}.enemies`, 'final wave must contain exactly one enemy group');
    return;
  }
  const bossGroup = finalWave.enemies[0];
  if (bossGroup === undefined) return;
  if (bossGroup.count !== 1) {
    error('invalid-boss-count', `${finalPath}.enemies[0].count`, 'final boss count must be 1');
  }
  const boss = mobById.get(bossGroup.mobId);
  if (boss !== undefined && !boss.tags.includes('boss')) {
    error('missing-boss-tag', `${finalPath}.enemies[0].mobId`, `final mob "${boss.id}" must have the boss tag`);
  }
}

function detectUnlockCycles(
  dungeons: readonly DungeonDef[],
  dungeonById: ReadonlyMap<string, DungeonDef>,
  error: (code: string, path: string, message: string) => void,
): void {
  dungeons.forEach((start, startIndex) => {
    const trail = new Set<string>();
    let current: DungeonDef | undefined = start;
    while (current?.unlock.kind === 'dungeonClear') {
      if (trail.has(current.id)) {
        error(
          'unlock-cycle',
          `dungeons[${startIndex}].unlock`,
          `unlock chain from "${start.id}" contains a cycle at "${current.id}"`,
        );
        break;
      }
      trail.add(current.id);
      current = dungeonById.get(current.unlock.dungeonId);
    }
  });
}
