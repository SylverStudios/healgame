import { BONEHOWL } from './bonehowl';
import { EMBERFALL } from './emberfall';
import { EXTINCTION } from './extinction';
import { NEEDLE_GAZE } from './needleGaze';
import { NULL_PSALM } from './nullPsalm';
import { SOUL_TOLL } from './soulToll';
import { TUNNEL_VISION } from './tunnelVision';
import type { EnemyAbilityDef } from '../content/types';

export { BONEHOWL } from './bonehowl';
export { EMBERFALL } from './emberfall';
export { EXTINCTION } from './extinction';
export { NEEDLE_GAZE } from './needleGaze';
export { NULL_PSALM } from './nullPsalm';
export { SOUL_TOLL } from './soulToll';
export { TUNNEL_VISION } from './tunnelVision';

export const ENEMY_ABILITIES = [
  BONEHOWL,
  TUNNEL_VISION,
  EXTINCTION,
  EMBERFALL,
  SOUL_TOLL,
  NEEDLE_GAZE,
  NULL_PSALM,
] as const satisfies readonly EnemyAbilityDef[];

export const ENEMY_ABILITY_REGISTRY: Readonly<Record<string, EnemyAbilityDef>> = Object.freeze(
  Object.fromEntries(ENEMY_ABILITIES.map((ability) => [ability.id, ability])),
);
