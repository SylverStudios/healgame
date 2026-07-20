import { DUNGEONS, DUNGEON_ORDER } from '../dungeons';
import { ENEMY_ABILITIES } from '../enemyAbilities';
import { MOBS } from '../mobs';
import type { ContentCatalogs } from './types';

export const VISUAL_KEYS = [
  'bonehowl',
  'tunnel-vision',
  'extinction',
  'emberfall',
  'soul-toll',
  'needle-gaze',
  'null-psalm',
  'ash-husk',
  'iron-husk',
  'gate-warden',
  'spire-lancer',
  'hollow-king',
  'cinder-wraith',
  'ember-colossus',
  'choir-shade',
  'dirge-sovereign',
  'thorn-husk',
  'thorn-matriarch',
  'gloam-wretch',
  'veil-cantor',
  'ash-gate',
  'iron-pass',
  'cinder-vault',
  'verdant-rift',
  'black-choir',
  'gloam-sanctum',
  'the-maw',
] as const;

export const CONTENT_CATALOGS = {
  abilities: ENEMY_ABILITIES,
  mobs: MOBS,
  dungeons: DUNGEONS,
  dungeonOrder: DUNGEON_ORDER,
  visualKeys: VISUAL_KEYS,
} as const satisfies ContentCatalogs;
