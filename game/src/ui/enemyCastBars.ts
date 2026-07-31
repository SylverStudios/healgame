/**
 * Pooled cast slivers for every active enemy caster (boss + trash), v1 enemy
 * mechanics E3. One unlabeled {@link Bar} per caster, anchored above its sprite
 * and shaking harder as its fill nears full (see {@link castBarShakeOffset}).
 *
 * Presentation-only: driven each frame from `CombatState.enemyCasts` (active
 * casts only — no idle cooldown chrome). Bars are pooled by unit id — created
 * on first sight of a cast, hidden when the cast ends, and fully destroyed on
 * wave rebuild via {@link reset}. The demoted single-boss sliver (v0.3 chunk F)
 * generalized: identical geometry, now one per caster.
 */

import type Phaser from 'phaser';
import { Bar } from './bar';
import { castBarShakeOffset } from './castBarShake';
import type { CombatState } from '../combat/types';
import type { UnitSprite } from './unitSprite';

/** Sliver geometry — an unlabeled sliver above the caster (the combat log names the ability). */
export const ENEMY_CAST_BAR_WIDTH = 70;
export const ENEMY_CAST_BAR_HEIGHT = 5;
/** Gap between the caster sprite's top edge and the sliver's bottom edge. */
export const ENEMY_CAST_BAR_GAP = 14;
const ENEMY_CAST_FILL_COLOR = 0xe05a4e;
const ENEMY_CAST_BAR_DEPTH = 46;
/** Trash casters wander a touch less than the boss (reversible presentation default). */
const TRASH_CAST_BAR_SHAKE_MAX_PX = 2;
/** Fallback anchor height when a caster's sprite height was not captured (boss-sized). */
const FALLBACK_ANCHOR_HEIGHT = 80;

export class EnemyCastBars {
  private readonly bars = new Map<string, Bar>();
  /** Caster unit id → display height, so each sliver anchors above its caster regardless of size. */
  private readonly anchorHeights = new Map<string, number>();

  constructor(private readonly scene: Phaser.Scene) {}

  /** Record a caster's sprite height so its sliver anchors above the sprite top. */
  setAnchorHeight(unitId: string, height: number): void {
    this.anchorHeights.set(unitId, height);
  }

  /** Destroy the whole pool and forget anchor heights — a cast can't survive its caster's wave. */
  reset(): void {
    for (const bar of this.bars.values()) bar.destroy();
    this.bars.clear();
    this.anchorHeights.clear();
  }

  /**
   * Show a sliver for each caster in `state.enemyCasts`, anchored above its sprite, and hide any
   * pooled bar whose caster is no longer casting. `phaseMs` drives the fill-scaled shake wander.
   */
  sync(
    state: CombatState,
    phaseMs: number,
    findSprite: (unitId: string) => UnitSprite | undefined,
  ): void {
    const active = new Set<string>();
    for (const cast of state.enemyCasts) {
      active.add(cast.sourceId);
      const bar = this.barFor(cast.sourceId);
      const fillProgress = cast.totalMs > 0 ? 1 - cast.remainingMs / cast.totalMs : 0;
      const sprite = findSprite(cast.sourceId);
      if (sprite) {
        const isBoss = state.enemies.find((u) => u.id === cast.sourceId)?.role === 'boss';
        const height = this.anchorHeights.get(cast.sourceId) ?? FALLBACK_ANCHOR_HEIGHT;
        const { dx, dy } = isBoss
          ? castBarShakeOffset(fillProgress, phaseMs)
          : castBarShakeOffset(fillProgress, phaseMs, TRASH_CAST_BAR_SHAKE_MAX_PX);
        bar.setPosition(
          sprite.getHomeX() - ENEMY_CAST_BAR_WIDTH / 2 + dx,
          sprite.getHomeY() - height / 2 - ENEMY_CAST_BAR_GAP + dy,
        );
      }
      bar.setRatio(fillProgress);
      bar.setVisible(true);
    }
    for (const [id, bar] of this.bars) {
      if (!active.has(id)) bar.setVisible(false);
    }
  }

  private barFor(sourceId: string): Bar {
    let bar = this.bars.get(sourceId);
    if (!bar) {
      bar = new Bar(
        this.scene,
        0,
        0,
        ENEMY_CAST_BAR_WIDTH,
        ENEMY_CAST_BAR_HEIGHT,
        ENEMY_CAST_FILL_COLOR,
      ).setDepth(ENEMY_CAST_BAR_DEPTH);
      this.bars.set(sourceId, bar);
    }
    return bar;
  }
}
