/** Journey/semantic name for a hub dungeon button — stable, derived from id. */
export function hubDungeonTargetName(dungeonId: string): string {
  return `hubDungeon:${dungeonId}`;
}
