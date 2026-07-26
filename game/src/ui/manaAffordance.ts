/**
 * Shared mana-blue affordance (Playtest Wave 2).
 *
 * Spell costs show a blue orb + digits (not `Nm` / `(m)`). Combat spell bar,
 * tooltips, and the spellbook reuse these helpers so non-gamers read "blue =
 * mana" consistently. Code-drawn circle — no new asset (temp-art rules).
 */

import type Phaser from 'phaser';
import { FONT, FONT_SIZE_XS, PALETTE, PALETTE_NUM } from './theme';

/** CSS mana blue — same token as theme; prefer this over local hex literals. */
export const MANA_BLUE_CSS = PALETTE.mana;
/** Packed hex for Phaser fill/stroke/tint. */
export const MANA_BLUE_NUM = PALETTE_NUM.mana;
/** OOM / can't-afford accent (matches spell-bar danger). */
export const MANA_OOM_CSS = PALETTE.danger;
export const MANA_OOM_NUM = PALETTE_NUM.danger;

/** Default orb radius for compact spell-bar / spellbook slot costs. */
export const MANA_ORB_RADIUS = 3;
/** Gap between orb right edge and cost digit left edge. */
export const MANA_ORB_TEXT_GAP = 3;

/** Digits only — UI draws the orb; never append `m` / `(m)`. */
export function manaCostDigits(mana: number): string {
  return String(Math.max(0, Math.floor(mana)));
}

export function manaCostColorCss(canAfford: boolean): string {
  return canAfford ? MANA_BLUE_CSS : MANA_OOM_CSS;
}

export function manaCostColorNum(canAfford: boolean): number {
  return canAfford ? MANA_BLUE_NUM : MANA_OOM_NUM;
}

/**
 * Tiny filled circle used as the mana "orb" glyph next to cost digits.
 * Recolors via `setFillStyle` when OOM.
 */
export function addManaOrb(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number = MANA_ORB_RADIUS,
  canAfford: boolean = true,
): Phaser.GameObjects.Arc {
  return scene.add.circle(x, y, radius, manaCostColorNum(canAfford));
}

export interface ManaCostAffordance {
  orb: Phaser.GameObjects.Arc;
  text: Phaser.GameObjects.Text;
  /** Update digits + afford state (orb tint + text color). */
  setCost: (mana: number, canAfford?: boolean) => void;
  destroy: () => void;
}

/**
 * Orb + digit cost pair centered as a group around `(x, y)`.
 * Layout: [orb][gap][digits], group center at x.
 */
export function addManaCostAffordance(
  scene: Phaser.Scene,
  x: number,
  y: number,
  mana: number,
  options?: {
    canAfford?: boolean;
    fontSize?: string;
    fontFamily?: string;
    orbRadius?: number;
  },
): ManaCostAffordance {
  const canAfford = options?.canAfford ?? true;
  const fontSize = options?.fontSize ?? FONT_SIZE_XS;
  const fontFamily = options?.fontFamily ?? FONT;
  const orbRadius = options?.orbRadius ?? MANA_ORB_RADIUS;
  const digits = manaCostDigits(mana);

  const text = scene.add
    .text(0, 0, digits, {
      fontFamily,
      fontSize,
      color: manaCostColorCss(canAfford),
    })
    .setOrigin(0, 0.5);

  const orb = addManaOrb(scene, 0, y, orbRadius, canAfford);

  const layout = (): void => {
    const totalW = orbRadius * 2 + MANA_ORB_TEXT_GAP + text.width;
    const left = x - totalW / 2;
    orb.setPosition(left + orbRadius, y);
    text.setPosition(left + orbRadius * 2 + MANA_ORB_TEXT_GAP, y);
  };
  layout();

  return {
    orb,
    text,
    setCost: (nextMana: number, nextAfford: boolean = true) => {
      text.setText(manaCostDigits(nextMana));
      text.setColor(manaCostColorCss(nextAfford));
      orb.setFillStyle(manaCostColorNum(nextAfford));
      layout();
    },
    destroy: () => {
      orb.destroy();
      text.destroy();
    },
  };
}
