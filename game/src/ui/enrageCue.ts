/**
 * Boss-phase enrage countdown cue (v1 playtest UI, Iron Pass DPS-check).
 * Reads `CombatState.enrageRemainingMs` and renders:
 *   – Red/orange "Enrage Xs" countdown text above the boss HP bar.
 *   – On `enrage` combat event: brief "ENRAGE!" rising float above the boss.
 *
 * Pattern mirrors `secondaryCues.ts` — sync functions own the lifecycle of
 * persistent objects; spawn functions produce one-shot animated floats.
 * No new assets; no clickable controls.
 */

import Phaser from 'phaser';
import type { CombatState } from '../combat/types';
import { FONT, FONT_SIZE_XS, FONT_SIZE_SM } from './theme';

// ── palette ──────────────────────────────────────────────────────────────────
const URGENT_CSS = '#ff4a2b';
const WARNING_CSS = '#f2a12e';
const STROKE_CSS = '#0a0605';

// ── depths ───────────────────────────────────────────────────────────────────
const CUE_DEPTH = 40;
const FLOAT_DEPTH = 50;

// ── badge geometry ───────────────────────────────────────────────────────────
/** Threshold (ms) below which the countdown turns red (urgent). */
const URGENT_THRESHOLD_MS = 15_000;

/** Offset from unit home: above/centered, above the HP bar row. */
const BADGE_DX = 0;
const BADGE_DY = -54;

// ── float geometry ───────────────────────────────────────────────────────────
const FLOAT_SPAWN_DY = -28;
const FLOAT_RISE = 36;
const FLOAT_DURATION_MS = 900;

// ── public types ─────────────────────────────────────────────────────────────
type UnitHome = { getHomeX(): number; getHomeY(): number };

export interface EnrageCueHandles {
  countdown: Phaser.GameObjects.Text | null;
}

export function emptyEnrageCueHandles(): EnrageCueHandles {
  return { countdown: null };
}

// ── public API ────────────────────────────────────────────────────────────────

/**
 * Sync enrage countdown badge from one `CombatState` snapshot.
 * Pass `boss` as the boss UnitSprite (or null when boss is not up).
 * Call each frame alongside `syncSecondaryCues`; returns updated handles.
 */
export function syncEnrageCue(
  scene: Phaser.Scene,
  handles: EnrageCueHandles,
  state: CombatState,
  boss: UnitHome | null | undefined,
): EnrageCueHandles {
  const remaining = state.enrageRemainingMs;

  if (remaining === null || remaining <= 0 || !boss) {
    handles.countdown?.destroy();
    return { countdown: null };
  }

  const secs = Math.ceil(remaining / 1000);
  const label = `Enrage ${secs}s`;
  const color = remaining <= URGENT_THRESHOLD_MS ? URGENT_CSS : WARNING_CSS;
  const x = boss.getHomeX() + BADGE_DX;
  const y = boss.getHomeY() + BADGE_DY;

  if (!handles.countdown) {
    const text = scene.add
      .text(x, y, label, {
        fontFamily: FONT,
        fontSize: FONT_SIZE_XS,
        color,
        stroke: STROKE_CSS,
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(CUE_DEPTH);
    return { countdown: text };
  }

  handles.countdown.setPosition(x, y).setText(label).setColor(color);
  return handles;
}

/**
 * Spawn a red "ENRAGE!" rising float above `boss` on the `enrage` combat event.
 * One-shot; no handle needed.
 */
export function spawnEnrageFloat(scene: Phaser.Scene, boss: UnitHome): void {
  const x = boss.getHomeX();
  const y = boss.getHomeY() + FLOAT_SPAWN_DY;
  const obj = scene.add
    .text(x, y, 'ENRAGE!', {
      fontFamily: FONT,
      fontSize: FONT_SIZE_SM,
      color: URGENT_CSS,
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
