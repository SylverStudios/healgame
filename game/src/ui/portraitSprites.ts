/**
 * PixelLab FE-style bust portraits (48×48 native, 96px display at the
 * density rule's 2× — bible item 5, chunk 5 of docs/ui-theme-handoff.md).
 * Presentation-only — party identity lives in data/ (banter.ts's
 * BanterSpeaker, save/loadout); this module only maps a unit/speaker id to
 * a texture. Shown beside banter speech bubbles, on the tutorial screen,
 * and on the combat result panel (victory = healer, wipe = tank).
 *
 * Registry mirrors relicSprites.ts/spellSprites.ts's pattern: BootScene
 * preloads every id below; callers check `scene.textures.exists(...)` and
 * fall back to the current no-portrait layout when a texture is missing —
 * never a broken image.
 *
 * Also ships `drawFramedPortrait` (a small Scene-consuming helper, same
 * spirit as `runModsBar.ts`'s `drawRunModGlyph`): the identical "ui/panels.ts
 * 'sm' frame + portrait Image" inset both TutorialScene and CombatScene's
 * result overlay draw, factored out once instead of duplicated twice (the
 * duplication originally pushed CombatScene.ts over eslint's max-lines cap).
 */

import Phaser from 'phaser';
import { addPanel, type Frame } from './panels';

/** Native canvas size for every portrait PNG under public/assets/units/portraits/. */
export const PORTRAIT_TEXTURE_SIZE = 48;

/** Every party unit id that ships a PixelLab bust portrait. Covers
 *  data/banter.ts's BanterSpeaker values ('healer' | 'tank') plus the two
 *  DPS slots, so the same registry already has room for a future banter
 *  speaker without a second module. */
export const PORTRAIT_UNIT_IDS: readonly string[] = ['healer', 'tank', 'dps1', 'dps2'];

/** Phaser texture key for a unit id (`healer` → `portrait-healer`). */
export function portraitTextureKey(unitId: string): string {
  return `portrait-${unitId}`;
}

/** Public URL for a unit's portrait still. */
export function portraitTextureUrl(unitId: string): string {
  return `assets/units/portraits/${unitId}.png`;
}

/** One entry per portrait texture BootScene must preload. */
export interface PortraitTexture {
  readonly key: string;
  readonly url: string;
}

/** Every portrait texture this chunk ships — BootScene loops this once. */
export function portraitTextures(): readonly PortraitTexture[] {
  return PORTRAIT_UNIT_IDS.map((id) => ({ key: portraitTextureKey(id), url: portraitTextureUrl(id) }));
}

/** Fixed padding (art px) between the portrait's display edge and its 'sm' Frame border. */
const FRAME_PAD = 4;

/** Outer size of a `drawFramedPortrait` inset — portrait display size (96) + frame padding
 *  on every edge. Callers use this to reserve layout space before drawing. */
export const PORTRAIT_FRAME_DISPLAY_SIZE = PORTRAIT_TEXTURE_SIZE * 2 + FRAME_PAD * 2;

export interface FramedPortrait {
  readonly frame: Frame;
  readonly image: Phaser.GameObjects.Image;
}

/**
 * Draws a framed bust (`ui/panels.ts` 'sm' Frame + the portrait Image) centered at (x, y).
 * Returns `null` and draws nothing when `unitId`'s texture never loaded — never a broken
 * image, mirroring `speechBubble.ts`'s fallback. Both pieces start fully transparent
 * (`alpha 0`); each call site owns its own reveal tween since they stage differently
 * (TutorialScene shows it immediately, CombatScene's result overlay stages it with the
 * other panel content).
 */
export function drawFramedPortrait(
  scene: Phaser.Scene,
  x: number,
  y: number,
  unitId: string,
  depth: number,
): FramedPortrait | null {
  const key = portraitTextureKey(unitId);
  if (!scene.textures.exists(key)) return null;
  const displaySize = PORTRAIT_TEXTURE_SIZE * 2;
  const frame = addPanel(scene, x, y, PORTRAIT_FRAME_DISPLAY_SIZE, PORTRAIT_FRAME_DISPLAY_SIZE, {
    size: 'sm',
    depth,
  });
  frame.container.setAlpha(0);
  const image = scene.add.image(x, y, key).setDisplaySize(displaySize, displaySize).setDepth(depth + 1).setAlpha(0);
  return { frame, image };
}

/** `drawFramedPortrait` + its own fade-in tween in one call — the CombatScene result-overlay
 *  call site's exact need (staged reveal alongside the rest of the panel's content); a no-op
 *  when the texture never loaded. Kept out of CombatScene.ts to stay under its max-lines cap. */
export function revealFramedPortrait(
  scene: Phaser.Scene,
  x: number,
  y: number,
  unitId: string,
  depth: number,
  reveal: { delay: number; duration: number },
): void {
  const portrait = drawFramedPortrait(scene, x, y, unitId, depth);
  if (!portrait) return;
  scene.tweens.add({ targets: [portrait.frame.container, portrait.image], alpha: 1, ...reveal });
}

/** Result-overlay bust position (pure, colocated-test-covered): a top-left inset that
 *  clears the outcome title / XP / glyph / combatReturn text columns at their existing
 *  centered x/y (see `revealResultPortrait`, the only caller). */
export function resultPortraitPosition(centerX: number, centerY: number, panelWidth: number): { x: number; y: number } {
  const margin = 10;
  const yOffset = 70;
  return { x: centerX - panelWidth / 2 + margin + PORTRAIT_FRAME_DISPLAY_SIZE / 2, y: centerY - yOffset };
}

/**
 * CombatScene's `showResultOverlay` in one call: healer bust on victory, tank bust on wipe
 * (the locked banter triggers), positioned via `resultPortraitPosition`, revealed with the
 * caller's own stagger timing. Bundling the whole "which speaker / where / when" decision
 * here (rather than in CombatScene.ts, this module's only caller for it) keeps that file's
 * showResultOverlay wiring to a single line — CombatScene.ts sits right at eslint's
 * max-lines cap, so every chunk touching it has to budget lines carefully.
 */
export function revealResultPortrait(
  scene: Phaser.Scene,
  status: 'victory' | 'wipe',
  centerX: number,
  centerY: number,
  panelWidth: number,
  depth: number,
  reveal: { delay: number; duration: number },
): void {
  const pos = resultPortraitPosition(centerX, centerY, panelWidth);
  revealFramedPortrait(scene, pos.x, pos.y, status === 'wipe' ? 'tank' : 'healer', depth, reveal);
}
