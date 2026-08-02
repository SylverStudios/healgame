/**
 * Secondary-stat HUD cues for crit and block (v1 playtest UI, U2).
 * Reads `CombatState.secondaries` (set by U1) and renders:
 *   – Countdown badge near healer: "Crit N" where N = casts until next crit.
 *   – Countdown badge near tank:   "Block N" where N = hits until next block.
 *   – Float "CRIT" rising above healer on heal/damage events with crit===true.
 *   – Float "BLOCK" rising above tank on damage events with blocked > 0.
 *
 * Pattern mirrors `healerCues.ts` — sync functions own the lifecycle of
 * persistent objects; spawn functions produce one-shot animated floats.
 * No new assets; no clickable controls.
 */

import Phaser from 'phaser';
import type { CombatState } from '../combat/types';
import { FONT, FONT_SIZE_XS, FONT_SIZE_SM } from './theme';

// ── palette ──────────────────────────────────────────────────────────────────
const GOLD_CSS = '#f2c14e';
const STEEL_CSS = '#a8c8f0';
const STROKE_CSS = '#0a0605';

// ── depths ───────────────────────────────────────────────────────────────────
const CUE_DEPTH = 40;
const FLOAT_DEPTH = 50;

// ── badge geometry ───────────────────────────────────────────────────────────
/** Offset from unit home: right-of-center, above the HP bar row. */
const BADGE_DX = 28;
const BADGE_DY = -46;

// ── float geometry ───────────────────────────────────────────────────────────
/** Spawn point relative to unit center (same starting height as damage floats). */
const FLOAT_SPAWN_DY = -22;
const FLOAT_RISE = 30;
const FLOAT_DURATION_MS = 700;

// ── public types ──────────────────────────────────────────────────────────────
type UnitHome = { getHomeX(): number; getHomeY(): number };

export interface SecondaryCueHandles {
  critBadge: Phaser.GameObjects.Text | null;
  blockBadge: Phaser.GameObjects.Text | null;
}

export function emptySecondaryCueHandles(): SecondaryCueHandles {
  return { critBadge: null, blockBadge: null };
}

// ── pure helpers ─────────────────────────────────────────────────────────────

/** Casts/hits remaining until next proc (exported for unit tests). */
export function secondaryRemaining(n: number, carry: number): number {
  return n - carry;
}

// ── internal ─────────────────────────────────────────────────────────────────

function syncBadge(
  scene: Phaser.Scene,
  current: Phaser.GameObjects.Text | null,
  label: string,
  color: string,
  unit: UnitHome | null | undefined,
  enabled: boolean,
): Phaser.GameObjects.Text | null {
  if (!enabled || !unit) {
    current?.destroy();
    return null;
  }
  const x = unit.getHomeX() + BADGE_DX;
  const y = unit.getHomeY() + BADGE_DY;
  if (!current) {
    return scene.add
      .text(x, y, label, {
        fontFamily: FONT,
        fontSize: FONT_SIZE_XS,
        color,
        stroke: STROKE_CSS,
        strokeThickness: 2,
      })
      .setOrigin(0, 0.5)
      .setDepth(CUE_DEPTH);
  }
  current.setPosition(x, y).setText(label);
  return current;
}

// ── public API ────────────────────────────────────────────────────────────────

/**
 * Sync crit/block countdown badges from one `CombatState` snapshot.
 * Call each frame alongside `syncHealerCues`; returns updated handles.
 */
export function syncSecondaryCues(
  scene: Phaser.Scene,
  handles: SecondaryCueHandles,
  state: CombatState,
  healer: UnitHome | null | undefined,
  tank: UnitHome | null | undefined,
): SecondaryCueHandles {
  const crit = state.secondaries?.crit;
  const block = state.secondaries?.block;
  return {
    critBadge: syncBadge(
      scene,
      handles.critBadge,
      crit !== undefined ? `Crit ${secondaryRemaining(crit.n, crit.carry)}` : '',
      GOLD_CSS,
      healer,
      crit !== undefined,
    ),
    blockBadge: syncBadge(
      scene,
      handles.blockBadge,
      block !== undefined ? `Block ${secondaryRemaining(block.n, block.carry)}` : '',
      STEEL_CSS,
      tank,
      block !== undefined,
    ),
  };
}

/**
 * Spawn a gold "CRIT" rising float above `unit` (healer) on a crit event.
 * One-shot; no handle needed.
 */
export function spawnCritFloat(scene: Phaser.Scene, unit: UnitHome): void {
  const x = unit.getHomeX();
  const y = unit.getHomeY() + FLOAT_SPAWN_DY;
  const obj = scene.add
    .text(x, y, 'CRIT', {
      fontFamily: FONT,
      fontSize: FONT_SIZE_SM,
      color: GOLD_CSS,
      stroke: STROKE_CSS,
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(FLOAT_DEPTH);
  scene.tweens.add({
    targets: obj,
    y: y - FLOAT_RISE,
    alpha: 0,
    duration: FLOAT_DURATION_MS,
    ease: 'Quad.easeOut',
    onComplete: () => obj.destroy(),
  });
}

/**
 * Spawn a steel "BLOCK" rising float above `unit` (tank) on a blocked-damage event.
 * One-shot; no handle needed.
 */
export function spawnBlockFloat(scene: Phaser.Scene, unit: UnitHome): void {
  const x = unit.getHomeX();
  const y = unit.getHomeY() + FLOAT_SPAWN_DY;
  const obj = scene.add
    .text(x, y, 'BLOCK', {
      fontFamily: FONT,
      fontSize: FONT_SIZE_SM,
      color: STEEL_CSS,
      stroke: STROKE_CSS,
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(FLOAT_DEPTH);
  scene.tweens.add({
    targets: obj,
    y: y - FLOAT_RISE,
    alpha: 0,
    duration: FLOAT_DURATION_MS,
    ease: 'Quad.easeOut',
    onComplete: () => obj.destroy(),
  });
}
