import { BONEHOWL } from './bonehowl';
import { EXTINCTION } from './extinction';
import type { EnemyAbilityDef } from '../content/types';

export { BONEHOWL } from './bonehowl';
export { EXTINCTION } from './extinction';

export const ENEMY_ABILITY_ORDER = ['bonehowl', 'extinction'] as const;

export const ENEMY_ABILITIES = [BONEHOWL, EXTINCTION] as const satisfies readonly EnemyAbilityDef[];

export const ENEMY_ABILITY_REGISTRY: Readonly<Record<string, EnemyAbilityDef>> = Object.freeze(
  Object.fromEntries(ENEMY_ABILITIES.map((ability) => [ability.id, ability])),
);
