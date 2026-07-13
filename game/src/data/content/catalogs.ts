import { DUNGEONS, DUNGEON_ORDER } from '../dungeons';
import { ENEMY_ABILITIES } from '../enemyAbilities';
import { MOBS } from '../mobs';
import type { ContentCatalogs } from './types';

export const VISUAL_KEYS = [
  'bonehowl',
  'tunnel-vision',
  'extinction',
  'ash-husk',
  'iron-husk',
  'gate-warden',
  'spire-lancer',
  'hollow-king',
  'ash-gate',
  'iron-pass',
  'the-maw',
] as const;

export const CONTENT_CATALOGS = {
  abilities: ENEMY_ABILITIES,
  mobs: MOBS,
  dungeons: DUNGEONS,
  dungeonOrder: DUNGEON_ORDER,
  visualKeys: VISUAL_KEYS,
} as const satisfies ContentCatalogs;
