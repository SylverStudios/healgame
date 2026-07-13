/**
 * Bottom row of spell buttons (poc-spec §4: click ally -> click spell/hotkey).
 * One button per unlocked spell; dimmed + crimson cost when mana is short;
 * dimmed when nothing is targeted or combat ended. Temp art only — flat
 * rectangles + text, no icons.
 */

import Phaser from 'phaser';
import type { CooldownDef, CooldownState, SpellDef } from '../combat/types';
import type { CombatMods } from '../data/spellTree';
import { SpellTooltip, buildTooltipLines } from './spellTooltip';

const BUTTON_WIDTH = 160;
const BUTTON_HEIGHT = 52;
const BUTTON_GAP = 14;
const BUTTON_BG_COLOR = 0x3a2a22;
const BUTTON_BG_OOM_COLOR = 0x2a1a18;
const BUTTON_BORDER_COLOR = 0x0a0605;
const BUTTON_BORDER_WIDTH = 1;
const BUTTON_DISABLED_ALPHA = 0.28;

/** Armed-synergy accent border (handoff §E): thicker gold stroke, no other feedback.
 *  Reused for cooldowns (Alpha 0.1 §D6): active manaCostReduction window / armed freeNextHeal charge. */
const ARMED_BORDER_COLOR = 0xf2c14e;
const ARMED_BORDER_WIDTH = 3;

const NAME_FONT = '13px monospace';
const NAME_COLOR = '#e8d8c8';
const COST_FONT = '11px monospace';
const COST_COLOR = '#a8c8f0';
const COST_OOM_COLOR = '#e05a4e';
const HOTKEY_FONT = '10px monospace';
const HOTKEY_COLOR = '#e8d8c8';
const KEYCAP_SIZE = 18;
const KEYCAP_BG = 0x241a15;
const KEYCAP_BORDER = 0x8a7868;

/** Cooldown buttons (Alpha 0.1 §D6): a compact group right of the spell buttons. */
const CD_BUTTON_WIDTH = 90;
const CD_BUTTON_HEIGHT = 52;
const CD_BUTTON_GAP = 14;
const CD_GROUP_GAP = 24;
const CD_NAME_FONT = '11px monospace';
const CD_NAME_WRAP_WIDTH = CD_BUTTON_WIDTH - 10;
const CD_TIMER_FONT = '13px monospace';
const CD_TIMER_COLOR = '#a8c8f0';

class SpellButton {
  readonly spellId: string;
  readonly mana: number;
  readonly centerX: number;
  readonly topY: number;

  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly keycap: Phaser.GameObjects.Rectangle;
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

    const keycapX = x - BUTTON_WIDTH / 2 + 6 + KEYCAP_SIZE / 2;
    const keycapY = y - BUTTON_HEIGHT / 2 + 6 + KEYCAP_SIZE / 2;
    this.keycap = scene.add
      .rectangle(keycapX, keycapY, KEYCAP_SIZE, KEYCAP_SIZE, KEYCAP_BG)
      .setStrokeStyle(1, KEYCAP_BORDER);

    this.nameText = scene.add
      .text(x, y - 8, spell.name, { fontFamily: NAME_FONT, color: NAME_COLOR })
      .setOrigin(0.5);
    this.costText = scene.add
      .text(x, y + 11, `${spell.mana} mana`, { fontFamily: COST_FONT, color: COST_COLOR })
      .setOrigin(0.5);
    this.hotkeyText = scene.add
      .text(keycapX, keycapY, hotkeyLabel, {
        fontFamily: HOTKEY_FONT,
        color: HOTKEY_COLOR,
      })
      .setOrigin(0.5);
  }

  /** Enabled = clickable (running + target + affordable). OOM always paints crimson cost. */
  setCastability(enabled: boolean, canAfford: boolean): void {
    this.enabled = enabled;
    const alpha = enabled ? 1 : BUTTON_DISABLED_ALPHA;
    this.bg.setFillStyle(canAfford ? BUTTON_BG_COLOR : BUTTON_BG_OOM_COLOR);
    this.bg.setAlpha(alpha);
    this.keycap.setAlpha(alpha);
    this.nameText.setAlpha(alpha);
    this.costText.setAlpha(canAfford ? alpha : Math.max(alpha, 0.55));
    this.costText.setColor(canAfford ? COST_COLOR : COST_OOM_COLOR);
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
    this.keycap.destroy();
    this.nameText.destroy();
    this.costText.destroy();
    this.hotkeyText.destroy();
  }
}

/**
 * Cooldown button (Alpha 0.1 §D6): name up top (may wrap to two lines via
 * wordWrap — short single-line initials are not okay per the handoff), a
 * seconds-remaining readout below while on cooldown, dimmed alpha while on
 * cooldown (reuses BUTTON_DISABLED_ALPHA), gold accent border while its buff
 * is active (reuses the armed-synergy stroke). Clicking while on cooldown is
 * a no-op — `ready` gates the click handler, not just the visual.
 */
class CooldownButton {
  readonly cooldownId: string;

  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly timerText: Phaser.GameObjects.Text;
  private ready = true;
  private armed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, def: CooldownDef, onClick: (cooldownId: string) => void) {
    this.cooldownId = def.id;

    this.bg = scene.add
      .rectangle(x, y, CD_BUTTON_WIDTH, CD_BUTTON_HEIGHT, BUTTON_BG_COLOR)
      .setStrokeStyle(BUTTON_BORDER_WIDTH, BUTTON_BORDER_COLOR)
      .setInteractive({ useHandCursor: true });
    this.bg.on('pointerdown', () => {
      if (this.ready) onClick(this.cooldownId);
    });

    this.nameText = scene.add
      .text(x, y - 10, def.name, {
        fontFamily: CD_NAME_FONT,
        color: NAME_COLOR,
        align: 'center',
        wordWrap: { width: CD_NAME_WRAP_WIDTH },
      })
      .setOrigin(0.5);
    this.timerText = scene.add
      .text(x, y + 14, '', { fontFamily: CD_TIMER_FONT, color: CD_TIMER_COLOR })
      .setOrigin(0.5)
      .setVisible(false);
  }

  /** Reflects one CooldownState snapshot: dimmed + seconds while on cooldown, accent border while a buff is active. */
  update(state: CooldownState): void {
    this.ready = state.remainingCooldownMs <= 0;
    const alpha = this.ready ? 1 : BUTTON_DISABLED_ALPHA;
    this.bg.setAlpha(alpha);
    this.nameText.setAlpha(alpha);
    this.timerText.setVisible(!this.ready);
    if (!this.ready) this.timerText.setText(`${Math.ceil(state.remainingCooldownMs / 1000)}s`);

    const armed = state.activeRemainingMs > 0;
    if (armed !== this.armed) {
      this.armed = armed;
      this.bg.setStrokeStyle(armed ? ARMED_BORDER_WIDTH : BUTTON_BORDER_WIDTH, armed ? ARMED_BORDER_COLOR : BUTTON_BORDER_COLOR);
    }
  }

  destroy(): void {
    this.bg.destroy();
    this.nameText.destroy();
    this.timerText.destroy();
  }
}

/** A centered row of spell buttons; index order also drives 1..N hotkeys. Cooldown buttons
 *  (Alpha 0.1 §D6), if any, sit in a compact group to the right — absent entirely (zero layout
 *  shift) when the loadout grants none, e.g. Ash Gate before any CD-granting node is bought. */
export class SpellBar {
  private readonly buttons: SpellButton[] = [];
  private readonly cooldownButtons: CooldownButton[] = [];
  private readonly tooltip: SpellTooltip;

  constructor(
    scene: Phaser.Scene,
    centerX: number,
    y: number,
    spells: SpellDef[],
    loadout: CombatMods,
    onCast: (spellId: string) => void,
    screenWidth = 960,
    cooldowns: CooldownDef[] = [],
    onCooldownClick: (cooldownId: string) => void = () => {},
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

    if (cooldowns.length > 0) {
      const lastSpellRightEdge = startX + (spells.length - 1) * (BUTTON_WIDTH + BUTTON_GAP) + BUTTON_WIDTH / 2;
      const cdStartX = lastSpellRightEdge + CD_GROUP_GAP + CD_BUTTON_WIDTH / 2;
      cooldowns.forEach((def, i) => {
        const x = cdStartX + i * (CD_BUTTON_WIDTH + CD_BUTTON_GAP);
        this.cooldownButtons.push(new CooldownButton(scene, x, y, def, onCooldownClick));
      });
    }
  }

  /** Toggle each button's look from healer mana / target / running state. */
  setState(healerMana: number, hasTarget: boolean, isRunning: boolean): void {
    for (const button of this.buttons) {
      const canAfford = healerMana >= button.mana;
      const enabled = isRunning && hasTarget && canAfford;
      button.setCastability(enabled, canAfford);
    }
  }

  /** Accent border on buttons whose spell id has an armed synergy buffing it (handoff §E). */
  setArmedSpellIds(ids: Iterable<string>): void {
    const armedSet = ids instanceof Set ? ids : new Set(ids);
    for (const button of this.buttons) button.setArmed(armedSet.has(button.spellId));
  }

  /** Per-frame sync for the cooldown buttons (Alpha 0.1 §D6); no-op when none were constructed. */
  updateCooldowns(states: CooldownState[]): void {
    for (const button of this.cooldownButtons) {
      const state = states.find((s) => s.id === button.cooldownId);
      if (state) button.update(state);
    }
  }

  destroy(): void {
    for (const button of this.buttons) button.destroy();
    for (const button of this.cooldownButtons) button.destroy();
    this.tooltip.destroy();
  }
}
