import { DUNGEONS, DUNGEON_ORDER } from '../dungeons';
import { ENEMY_ABILITIES } from '../enemyAbilities';
import { MOBS } from '../mobs';
import type { ContentCatalogs } from './types';

export const VISUAL_KEYS = [
  'bonehowl',
  'extinction',
  'ash-husk',
  'gate-warden',
  'hollow-king',
  'ash-gate',
  'the-maw',
] as const;

export const CONTENT_CATALOGS = {
  abilities: ENEMY_ABILITIES,
  mobs: MOBS,
  dungeons: DUNGEONS,
  dungeonOrder: DUNGEON_ORDER,
  visualKeys: VISUAL_KEYS,
} as const satisfies ContentCatalogs;
