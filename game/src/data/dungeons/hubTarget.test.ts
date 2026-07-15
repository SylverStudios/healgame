import { describe, expect, it } from 'vitest';
import { hubDungeonTargetName, ORDERED_DUNGEONS } from './index';

describe('hubDungeonTargetName', () => {
  it('derives a stable journey name from every catalog dungeon id', () => {
    for (const dungeon of ORDERED_DUNGEONS) {
      expect(hubDungeonTargetName(dungeon.id)).toBe(`hubDungeon:${dungeon.id}`);
    }
  });
});
