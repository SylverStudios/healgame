import { BONEHOWL } from './bonehowl';
import { BONEHOWL_LESSER } from './bonehowlLesser';
import { EMBERFALL } from './emberfall';
import { EMBERFALL_LESSER } from './emberfallLesser';
import { EXTINCTION } from './extinction';
import { EXTINCTION_LESSER } from './extinctionLesser';
import { NEEDLE_GAZE } from './needleGaze';
import { NEEDLE_GAZE_LESSER } from './needleGazeLesser';
import { NULL_PSALM } from './nullPsalm';
import { NULL_PSALM_LESSER } from './nullPsalmLesser';
import { SOUL_TOLL } from './soulToll';
import { SOUL_TOLL_LESSER } from './soulTollLesser';
import { TUNNEL_VISION } from './tunnelVision';
import { TUNNEL_VISION_LESSER } from './tunnelVisionLesser';
import type { EnemyAbilityDef } from '../content/types';

export { BONEHOWL } from './bonehowl';
export { BONEHOWL_LESSER } from './bonehowlLesser';
export { EMBERFALL } from './emberfall';
export { EMBERFALL_LESSER } from './emberfallLesser';
export { EXTINCTION } from './extinction';
export { EXTINCTION_LESSER } from './extinctionLesser';
export { NEEDLE_GAZE } from './needleGaze';
export { NEEDLE_GAZE_LESSER } from './needleGazeLesser';
export { NULL_PSALM } from './nullPsalm';
export { NULL_PSALM_LESSER } from './nullPsalmLesser';
export { SOUL_TOLL } from './soulToll';
export { SOUL_TOLL_LESSER } from './soulTollLesser';
export { TUNNEL_VISION } from './tunnelVision';
export { TUNNEL_VISION_LESSER } from './tunnelVisionLesser';

export const ENEMY_ABILITIES = [
  BONEHOWL,
  BONEHOWL_LESSER,
  TUNNEL_VISION,
  TUNNEL_VISION_LESSER,
  EXTINCTION,
  EXTINCTION_LESSER,
  EMBERFALL,
  EMBERFALL_LESSER,
  SOUL_TOLL,
  SOUL_TOLL_LESSER,
  NEEDLE_GAZE,
  NEEDLE_GAZE_LESSER,
  NULL_PSALM,
  NULL_PSALM_LESSER,
] as const satisfies readonly EnemyAbilityDef[];

export const ENEMY_ABILITY_REGISTRY: Readonly<Record<string, EnemyAbilityDef>> = Object.freeze(
  Object.fromEntries(ENEMY_ABILITIES.map((ability) => [ability.id, ability])),
);
