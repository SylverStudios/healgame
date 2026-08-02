/**
 * Wipe/victory result overlay helpers for CombatScene — layout/timing constants
 * plus the Return button mount (Space keycap + Space-only keybind).
 *
 * Split out of CombatScene.ts to stay under the max-lines lint cap; the rest of
 * showResultOverlay still lives there (tweens, engine, save, sprites).
 *
 * Short slide-in transition (~0.5-1.0s total) over the dimmed-but-visible
 * party, then outcome + XP + build glyph reveal in sequence, Return last
 * (~1s in, safely inside journey's 2s poll cadence).
 */

import Phaser from 'phaser';
import { addButton } from './panels';
import { KEYCAP_FRAME_TEXTURE_KEY } from './spellSprites';
import { FONT, FONT_SIZE_SM, FONT_SIZE_XS, PALETTE, PALETTE_NUM } from './theme';
import { buildLevelUpDeltas } from './levelUpDeltas';

export const OVERLAY_DEPTH = 1000;
export const OVERLAY_ALPHA = 0.85;
export const OVERLAY_FADE_MS = 300;

export const PANEL_WIDTH = 420;
export const PANEL_HEIGHT = 280;
/**
 * When HP/mana delta lines are shown under the level label, the three items
 * shift up so they clear the XP line at -28. Gaps are ~2px — intentionally
 * compact per spec ("compact formatting OK"). Panel height is unchanged (280).
 */
/** Y from centerY for the "Level N → M" label when delta lines accompany it. */
export const LEVEL_UP_DELTA_Y_OFFSET = -72;
/** Y from centerY for the HP delta line. */
export const HP_DELTA_Y_OFFSET = -58;
/** Y from centerY for the mana/regen delta line. */
export const MANA_DELTA_Y_OFFSET = -44;
/** Reveal delays for HP and mana delta lines (staggered after the level label). */
export const HP_DELTA_DELAY_MS = 760;
export const MANA_DELTA_DELAY_MS = 780;
export const DELTA_REVEAL_MS = 200;
export const PANEL_SLIDE_OFFSET = 50;
export const PANEL_SLIDE_DELAY_MS = 120;
export const PANEL_SLIDE_MS = 500;
export const TITLE_DELAY_MS = 520;
export const TITLE_REVEAL_MS = 220;
export const XP_DELAY_MS = 660;
export const XP_REVEAL_MS = 220;
export const LEVEL_UP_DELAY_MS = 740;
export const LEVEL_UP_REVEAL_MS = 220;
export const GLYPH_DELAY_MS = 860;
export const GLYPH_REVEAL_MS = 240;
export const GLYPH_CELL = 20;
export const GLYPH_COLOR = 0xfff2df;
export const DAMAGE_DELAY_MS = 790;
export const DAMAGE_REVEAL_MS = 220;
/** Y offset from panel centerY for the compact party-damage tally line. */
export const DAMAGE_Y_OFFSET = -8;
export const RETURN_DELAY_MS = 940;
export const RETURN_REVEAL_MS = 220;

export const RETURN_BUTTON_WIDTH = 180;
export const RETURN_BUTTON_HEIGHT = 40;
/** Y offset from panel center for the Return hit rect / chrome. */
export const RETURN_BUTTON_Y_OFFSET = 115;

/**
 * Slightly wider than spellBar's 18×14 Shift chips so the three-char `Spc`
 * label stays readable at FONT_SIZE_XS.
 */
const KEYCAP_WIDTH = 22;
const KEYCAP_HEIGHT = 14;
const KEYCAP_BG = 0x241a15;
const KEYCAP_BORDER = 0x8a7868;
const KEYCAP_INSET = 6;
/** Compact Space label for the Return keycap chip. */
export const RETURN_KEYCAP_LABEL = 'Spc';

/** Pure layout: Space keycap center inside the Return button. */
export function resultReturnKeycapPosition(
  buttonX: number,
  buttonY: number,
  buttonWidth: number = RETURN_BUTTON_WIDTH,
): { x: number; y: number } {
  return {
    x: buttonX - buttonWidth / 2 + KEYCAP_INSET + KEYCAP_WIDTH / 2,
    y: buttonY,
  };
}

export interface MountDamageListOptions {
  centerX: number;
  centerY: number;
  depth: number;
  label: string;
}

/**
 * Renders a compact one-line party-damage tally below the XP line.
 * Fades in after XP and level-up, before the build glyph.
 */
export function mountDamageList(scene: Phaser.Scene, opts: MountDamageListOptions): void {
  const { centerX, centerY, depth, label } = opts;
  const text = scene.add
    .text(centerX, centerY + DAMAGE_Y_OFFSET, label, {
      fontFamily: FONT,
      fontSize: FONT_SIZE_XS,
      color: '#a89888',
    })
    .setOrigin(0.5)
    .setDepth(depth)
    .setAlpha(0);
  scene.tweens.add({ targets: text, alpha: 1, delay: DAMAGE_DELAY_MS, duration: DAMAGE_REVEAL_MS });
}

export interface MountLevelUpDeltasOptions {
  centerX: number;
  centerY: number;
  depth: number;
  levelBefore: number;
  levelAfter: number;
  /** Non-null "Level N → M" label — only call when leveledUp is true. */
  levelUpLabel: string;
}

/**
 * Renders the level-up section on the result overlay: "Level N → M" label
 * (at `LEVEL_UP_DELTA_Y_OFFSET`) followed by compact HP-gain and mana/regen
 * lines. Replaces the ad-hoc level label in CombatScene — call this instead
 * of rendering lvlText inline.
 *
 * Positions are chosen to clear the title at centerY−80 (gap ~14px above)
 * and the XP line at centerY−28 (gap ~2px below), fitting within the
 * unmodified 280px panel.
 */
export function mountLevelUpDeltas(scene: Phaser.Scene, opts: MountLevelUpDeltasOptions): void {
  const { centerX, centerY, depth, levelBefore, levelAfter, levelUpLabel } = opts;

  const lvlText = scene.add
    .text(centerX, centerY + LEVEL_UP_DELTA_Y_OFFSET, levelUpLabel, {
      fontFamily: FONT,
      fontSize: FONT_SIZE_XS,
      color: '#a89888',
    })
    .setOrigin(0.5)
    .setDepth(depth)
    .setAlpha(0);
  scene.tweens.add({ targets: lvlText, alpha: 1, delay: LEVEL_UP_DELAY_MS, duration: LEVEL_UP_REVEAL_MS });

  const { hpLine, manaLine } = buildLevelUpDeltas(levelBefore, levelAfter);

  if (hpLine !== 'HP') {
    const hpText = scene.add
      .text(centerX, centerY + HP_DELTA_Y_OFFSET, hpLine, {
        fontFamily: FONT,
        fontSize: FONT_SIZE_XS,
        color: PALETTE.health,
      })
      .setOrigin(0.5)
      .setDepth(depth)
      .setAlpha(0);
    scene.tweens.add({ targets: hpText, alpha: 1, delay: HP_DELTA_DELAY_MS, duration: DELTA_REVEAL_MS });
  }

  if (manaLine) {
    const manaText = scene.add
      .text(centerX, centerY + MANA_DELTA_Y_OFFSET, manaLine, {
        fontFamily: FONT,
        fontSize: FONT_SIZE_XS,
        color: PALETTE.mana,
      })
      .setOrigin(0.5)
      .setDepth(depth)
      .setAlpha(0);
    scene.tweens.add({ targets: manaText, alpha: 1, delay: MANA_DELTA_DELAY_MS, duration: DELTA_REVEAL_MS });
  }
}

/** Single-fire wrapper so click + Space share one dismiss path. */
export function createOnceAction(action: () => void): () => void {
  let fired = false;
  return () => {
    if (fired) return;
    fired = true;
    action();
  };
}

export interface MountResultReturnOptions {
  centerX: number;
  centerY: number;
  /** Depth for hit rect + frame; label/keycap sit one/two above. */
  depth: number;
  onReturn: () => void;
}

/**
 * Mount the result-overlay Return control: named hit rect (`combatReturn`),
 * framed chrome, visible Space keycap, and Space-only keybind that shares a
 * single-fire dismiss with pointerdown.
 */
export function mountResultReturn(scene: Phaser.Scene, opts: MountResultReturnOptions): void {
  const { centerX, centerY, depth, onReturn } = opts;
  const x = centerX;
  const y = centerY + RETURN_BUTTON_Y_OFFSET;
  const dismiss = createOnceAction(onReturn);

  // combatReturn keeps its exact original rect (hit area/name unchanged) —
  // ui/panels.ts draws framed chrome around it (chunk-3 SpellButton pattern).
  const returnButton = scene.add
    .rectangle(x, y, RETURN_BUTTON_WIDTH, RETURN_BUTTON_HEIGHT, 0x3a2a22)
    .setStrokeStyle(1, 0x0a0605)
    .setDepth(depth)
    .setInteractive({ useHandCursor: true })
    .setName('combatReturn')
    .setAlpha(0)
    .on('pointerdown', dismiss);

  const returnFrame = addButton(scene, x, y, RETURN_BUTTON_WIDTH, RETURN_BUTTON_HEIGHT, {
    fillColor: PALETTE_NUM.panelLight,
    depth,
    hitRect: returnButton,
  });
  returnFrame.container.setAlpha(0);

  const keycapPos = resultReturnKeycapPosition(x, y);
  const keycap = addKeycap(scene, keycapPos.x, keycapPos.y).setDepth(depth + 1).setAlpha(0);
  const keycapText = scene.add
    .text(keycapPos.x, keycapPos.y, RETURN_KEYCAP_LABEL, {
      fontFamily: FONT,
      fontSize: FONT_SIZE_XS,
      color: PALETTE.text,
    })
    .setOrigin(0.5)
    .setDepth(depth + 2)
    .setAlpha(0);

  const returnText = scene.add
    .text(x, y, 'Return', { fontFamily: FONT, fontSize: FONT_SIZE_SM, color: PALETTE.text })
    .setOrigin(0.5)
    .setDepth(depth + 1)
    .setAlpha(0);

  const keyboard = scene.input.keyboard;
  if (keyboard) {
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      dismiss();
    };
    keyboard.on('keydown-SPACE', onKey);
  }

  // combatReturn exists immediately; only alpha is staged (journey-stable).
  scene.tweens.add({
    targets: [returnButton, returnFrame.container, returnText, keycap, keycapText],
    alpha: 1,
    delay: RETURN_DELAY_MS,
    duration: RETURN_REVEAL_MS,
  });
}

/** Keycap chip: pixel-art image when loaded, else the original flat rect + stroke. */
function addKeycap(
  scene: Phaser.Scene,
  x: number,
  y: number,
): Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle {
  if (scene.textures.exists(KEYCAP_FRAME_TEXTURE_KEY)) {
    return scene.add
      .image(x, y, KEYCAP_FRAME_TEXTURE_KEY)
      .setOrigin(0.5)
      .setDisplaySize(KEYCAP_WIDTH, KEYCAP_HEIGHT);
  }
  return scene.add.rectangle(x, y, KEYCAP_WIDTH, KEYCAP_HEIGHT, KEYCAP_BG).setStrokeStyle(1, KEYCAP_BORDER);
}
