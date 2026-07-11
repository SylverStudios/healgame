/**
 * Bottom row of spell buttons (poc-spec §4: click ally -> click spell/hotkey).
 * One button per unlocked spell; disabled look when mana is short or nothing
 * is targeted. Temp art only — flat rectangles + text, no icons.
 */

import Phaser from 'phaser';
import type { SpellDef } from '../combat/types';
import type { CombatMods } from '../data/spellTree';
import { SpellTooltip, buildTooltipLines } from './spellTooltip';

const BUTTON_WIDTH = 160;
const BUTTON_HEIGHT = 52;
const BUTTON_GAP = 14;
const BUTTON_BG_COLOR = 0x3a2a22;
const BUTTON_BORDER_COLOR = 0x0a0605;
const BUTTON_BORDER_WIDTH = 1;
const BUTTON_DISABLED_ALPHA = 0.35;

/** Armed-synergy accent border (handoff §E): thicker gold stroke, no other feedback. */
const ARMED_BORDER_COLOR = 0xf2c14e;
const ARMED_BORDER_WIDTH = 3;

const NAME_FONT = '13px monospace';
const NAME_COLOR = '#e8d8c8';
const COST_FONT = '11px monospace';
const COST_COLOR = '#a8c8f0';
const HOTKEY_FONT = '10px monospace';
const HOTKEY_COLOR = '#8a7868';

class SpellButton {
  readonly spellId: string;
  readonly mana: number;
  readonly centerX: number;
  readonly topY: number;

  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly costText: Phaser.GameObjects.Text;
  private readonly hotkeyText: Phaser.GameObjects.Text;
  private enabled = true;
  private armed = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    spell: SpellDef,
    hotkeyLabel: string,
    onClick: (spellId: string) => void,
    onHoverStart: (spellId: string, centerX: number, topY: number) => void,
    onHoverEnd: () => void,
  ) {
    this.spellId = spell.id;
    this.mana = spell.mana;
    this.centerX = x;
    this.topY = y - BUTTON_HEIGHT / 2;

    this.bg = scene.add
      .rectangle(x, y, BUTTON_WIDTH, BUTTON_HEIGHT, BUTTON_BG_COLOR)
      .setStrokeStyle(BUTTON_BORDER_WIDTH, BUTTON_BORDER_COLOR)
      .setInteractive({ useHandCursor: true });
    this.bg.on('pointerdown', () => {
      if (this.enabled) onClick(this.spellId);
    });
    this.bg.on('pointerover', () => onHoverStart(this.spellId, this.centerX, this.topY));
    this.bg.on('pointerout', () => onHoverEnd());

    this.nameText = scene.add
      .text(x, y - 8, spell.name, { fontFamily: NAME_FONT, color: NAME_COLOR })
      .setOrigin(0.5);
    this.costText = scene.add
      .text(x, y + 11, `${spell.mana} mana`, { fontFamily: COST_FONT, color: COST_COLOR })
      .setOrigin(0.5);
    this.hotkeyText = scene.add
      .text(x - BUTTON_WIDTH / 2 + 8, y - BUTTON_HEIGHT / 2 + 6, hotkeyLabel, {
        fontFamily: HOTKEY_FONT,
        color: HOTKEY_COLOR,
      })
      .setOrigin(0, 0);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    const alpha = enabled ? 1 : BUTTON_DISABLED_ALPHA;
    this.bg.setAlpha(alpha);
    this.nameText.setAlpha(alpha);
    this.costText.setAlpha(alpha);
    this.hotkeyText.setAlpha(alpha);
  }

  /** Thicker accent stroke while a synergy buffing this spell is armed; default border otherwise. */
  setArmed(armed: boolean): void {
    if (armed === this.armed) return;
    this.armed = armed;
    this.bg.setStrokeStyle(armed ? ARMED_BORDER_WIDTH : BUTTON_BORDER_WIDTH, armed ? ARMED_BORDER_COLOR : BUTTON_BORDER_COLOR);
  }

  destroy(): void {
    this.bg.destroy();
    this.nameText.destroy();
    this.costText.destroy();
    this.hotkeyText.destroy();
  }
}

/** A centered row of spell buttons; index order also drives 1..N hotkeys. */
export class SpellBar {
  private readonly buttons: SpellButton[] = [];
  private readonly tooltip: SpellTooltip;

  constructor(
    scene: Phaser.Scene,
    centerX: number,
    y: number,
    spells: SpellDef[],
    loadout: CombatMods,
    onCast: (spellId: string) => void,
    screenWidth = 960,
  ) {
    this.tooltip = new SpellTooltip(scene, screenWidth);

    const showTooltip = (spellId: string, buttonCenterX: number, buttonTopY: number): void => {
      const spell = spells.find((s) => s.id === spellId);
      if (!spell) return;
      this.tooltip.show(buttonCenterX, buttonTopY, buildTooltipLines(spell, loadout));
    };
    const hideTooltip = (): void => this.tooltip.hide();

    const totalWidth = spells.length * BUTTON_WIDTH + Math.max(0, spells.length - 1) * BUTTON_GAP;
    const startX = centerX - totalWidth / 2 + BUTTON_WIDTH / 2;
    spells.forEach((spell, i) => {
      const x = startX + i * (BUTTON_WIDTH + BUTTON_GAP);
      this.buttons.push(new SpellButton(scene, x, y, spell, `${i + 1}`, onCast, showTooltip, hideTooltip));
    });
  }

  /** Toggle each button's enabled look based on current healer mana / target / running state. */
  setState(healerMana: number, hasTarget: boolean, isRunning: boolean): void {
    for (const button of this.buttons) {
      button.setEnabled(isRunning && hasTarget && healerMana >= button.mana);
    }
  }

  /** Accent border on buttons whose spell id has an armed synergy buffing it (handoff §E). */
  setArmedSpellIds(ids: Iterable<string>): void {
    const armedSet = ids instanceof Set ? ids : new Set(ids);
    for (const button of this.buttons) button.setArmed(armedSet.has(button.spellId));
  }

  destroy(): void {
    for (const button of this.buttons) button.destroy();
    this.tooltip.destroy();
  }
}
