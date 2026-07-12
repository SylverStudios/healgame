import { BONEHOWL } from './bonehowl';
import { EXTINCTION } from './extinction';
import { TUNNEL_VISION } from './tunnelVision';
import type { EnemyAbilityDef } from '../content/types';

export { BONEHOWL } from './bonehowl';
export { EXTINCTION } from './extinction';
export { TUNNEL_VISION } from './tunnelVision';

export const ENEMY_ABILITIES = [BONEHOWL, TUNNEL_VISION, EXTINCTION] as const satisfies readonly EnemyAbilityDef[];

export const ENEMY_ABILITY_REGISTRY: Readonly<Record<string, EnemyAbilityDef>> = Object.freeze(
  Object.fromEntries(ENEMY_ABILITIES.map((ability) => [ability.id, ability])),
);
