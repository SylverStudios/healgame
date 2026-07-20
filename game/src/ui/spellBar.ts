/**
 * Bottom row of spell buttons (poc-spec §4: click ally -> click spell/hotkey).
 * One button per unlocked spell; dimmed + crimson cost when mana is short;
 * dimmed when nothing is targeted or combat ended.
 * Alpha 0.2 §D8: glyph (single char) is the primary label; full name + stats
 * live in the hover tooltip. Compact sizing to fit up to 8 buttons on 960px.
 */

import Phaser from 'phaser';
import type { CooldownDef, CooldownState, SpellDef } from '../combat/types';
import type { CombatMods } from '../data/talentTree';
import { actionHotkeyLabel } from './actionHotkeys';
import { buildCooldownTooltipLines } from './cooldownTooltip';
import { buildSpellCard } from './spellCard';
import { SpellTooltip } from './spellTooltip';
import { glyphChar } from './glyph';
import { FONT, FONT_SIZE_XS, FONT_SIZE_MD } from './theme';

/** Alpha 0.2 §D8: compact width so up to 4 QWER columns fit on 960px.
 *  Shift+QWER major CDs sit in a matching row above (same finger columns). */
const BUTTON_WIDTH = 100;
const BUTTON_HEIGHT = 52;
const BUTTON_GAP = 10;
const ROW_GAP = 10;
const BUTTON_BG_COLOR = 0x3a2a22;
const BUTTON_BG_OOM_COLOR = 0x2a1a18;
const BUTTON_BORDER_COLOR = 0x0a0605;
const BUTTON_BORDER_WIDTH = 1;
const BUTTON_DISABLED_ALPHA = 0.28;

/** Armed-synergy accent border (handoff §E): thicker gold stroke, no other feedback.
 *  Reused for cooldowns (Alpha 0.1 §D6): active manaCostReduction window / armed freeNextHeal charge. */
const ARMED_BORDER_COLOR = 0xf2c14e;
const ARMED_BORDER_WIDTH = 3;

/** Glyph: large single-char primary label (§D8 temp art exception). MD (24px)
 *  — the button is only 100×52, but this is the primary visual, close to
 *  its old 22px size. */
const GLYPH_FONT_SIZE = FONT_SIZE_MD;
const GLYPH_COLOR = '#e8d8c8';
/** XS (8px): cost/hotkey/timer text all live in a ≤52px-tall button
 *  alongside the glyph and an 18×14 keycap chip — the SM (16px) snap would
 *  overflow both. */
const COST_FONT_SIZE = FONT_SIZE_XS;
const COST_COLOR = '#a8c8f0';
const COST_OOM_COLOR = '#e05a4e';
const HOTKEY_FONT_SIZE = FONT_SIZE_XS;
const HOTKEY_COLOR = '#e8d8c8';
/** Wide enough for two-char Shift labels (`sQ`); height stays compact. */
const KEYCAP_WIDTH = 18;
const KEYCAP_HEIGHT = 14;
const KEYCAP_BG = 0x241a15;
const KEYCAP_BORDER = 0x8a7868;

/** Cooldown buttons (Alpha 0.1 §D6): same footprint as spell buttons so the
 *  Shift row lines up with QWER columns. */
const CD_BUTTON_WIDTH = BUTTON_WIDTH;
const CD_BUTTON_HEIGHT = BUTTON_HEIGHT;
const CD_GLYPH_FONT_SIZE = FONT_SIZE_MD;
const CD_TIMER_FONT_SIZE = FONT_SIZE_XS;
const CD_TIMER_COLOR = '#a8c8f0';
const SPELL_TIMER_FONT_SIZE = FONT_SIZE_XS;
const SPELL_TIMER_COLOR = '#a8c8f0';

class SpellButton {
  readonly spellId: string;
  readonly mana: number;
  readonly requiresAllyTarget: boolean;
  readonly centerX: number;
  readonly topY: number;

  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly keycap: Phaser.GameObjects.Rectangle;
  /** Large glyph char — primary visual (§D8). */
  private readonly glyphText: Phaser.GameObjects.Text;
  private readonly costText: Phaser.GameObjects.Text;
  private readonly hotkeyText: Phaser.GameObjects.Text;
  private readonly timerText: Phaser.GameObjects.Text;
  private enabled = true;
  private armed = false;
  private onSpellCooldown = false;
  private lastCanAfford = true;

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
    this.requiresAllyTarget = (spell.damage ?? 0) <= 0;
    this.centerX = x;
    this.topY = y - BUTTON_HEIGHT / 2;

    this.bg = scene.add
      .rectangle(x, y, BUTTON_WIDTH, BUTTON_HEIGHT, BUTTON_BG_COLOR)
      .setStrokeStyle(BUTTON_BORDER_WIDTH, BUTTON_BORDER_COLOR)
      .setInteractive({ useHandCursor: true })
      .setName(`combatSpell:${spell.id}`);
    this.bg.on('pointerdown', () => {
      if (this.enabled && !this.onSpellCooldown) onClick(this.spellId);
    });
    this.bg.on('pointerover', () => onHoverStart(this.spellId, this.centerX, this.topY));
    this.bg.on('pointerout', () => onHoverEnd());

    const keycapX = x - BUTTON_WIDTH / 2 + 6 + KEYCAP_WIDTH / 2;
    const keycapY = y - BUTTON_HEIGHT / 2 + 6 + KEYCAP_HEIGHT / 2;
    this.keycap = scene.add
      .rectangle(keycapX, keycapY, KEYCAP_WIDTH, KEYCAP_HEIGHT, KEYCAP_BG)
      .setStrokeStyle(1, KEYCAP_BORDER);

    this.glyphText = scene.add
      .text(x, y - 5, glyphChar(spell), {
        fontFamily: FONT,
        fontSize: GLYPH_FONT_SIZE,
        fontStyle: 'bold',
        color: GLYPH_COLOR,
        stroke: '#0a0605',
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    this.costText = scene.add
      .text(x, y + 15, `${spell.mana}m`, { fontFamily: FONT, fontSize: COST_FONT_SIZE, color: COST_COLOR })
      .setOrigin(0.5);
    this.timerText = scene.add
      .text(x, y + 15, '', { fontFamily: FONT, fontSize: SPELL_TIMER_FONT_SIZE, color: SPELL_TIMER_COLOR })
      .setOrigin(0.5)
      .setVisible(false);
    this.hotkeyText = scene.add
      .text(keycapX, keycapY, hotkeyLabel, {
        fontFamily: FONT,
        fontSize: HOTKEY_FONT_SIZE,
        color: HOTKEY_COLOR,
      })
      .setOrigin(0.5);
  }

  /** Enabled = clickable (running + target + affordable + not on personal CD). OOM paints crimson. */
  setCastability(enabled: boolean, canAfford: boolean): void {
    this.enabled = enabled;
    this.lastCanAfford = canAfford;
    this.refreshAlpha(canAfford);
  }

  /** Personal spell CD (Vowstrike): shows seconds and blocks clicks. */
  setSpellCooldown(remainingMs: number): void {
    this.onSpellCooldown = remainingMs > 0;
    this.timerText.setVisible(this.onSpellCooldown);
    if (this.onSpellCooldown) {
      this.timerText.setText(`${Math.ceil(remainingMs / 1000)}s`);
      this.costText.setVisible(false);
    } else {
      this.costText.setVisible(true);
    }
    this.refreshAlpha(this.lastCanAfford);
  }

  private refreshAlpha(canAfford: boolean): void {
    const alpha = this.enabled && !this.onSpellCooldown ? 1 : BUTTON_DISABLED_ALPHA;
    this.bg.setFillStyle(canAfford ? BUTTON_BG_COLOR : BUTTON_BG_OOM_COLOR);
    this.bg.setAlpha(alpha);
    this.keycap.setAlpha(alpha);
    this.glyphText.setAlpha(alpha);
    this.costText.setAlpha(canAfford ? alpha : Math.max(alpha, 0.55));
    this.costText.setColor(canAfford ? COST_COLOR : COST_OOM_COLOR);
    this.hotkeyText.setAlpha(alpha);
    this.timerText.setAlpha(alpha);
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
    this.glyphText.destroy();
    this.costText.destroy();
    this.timerText.destroy();
    this.hotkeyText.destroy();
  }
}

/**
 * Cooldown button (Alpha 0.1 §D6): glyph primary label (§D8), timer readout
 * while on cooldown, dimmed alpha while on cooldown, gold accent border while
 * buff is active. Clicking while on cooldown is a no-op — `ready` gates it.
 * Lives on the Shift+QWER row above the spell buttons (same finger columns).
 */
class CooldownButton {
  readonly cooldownId: string;
  readonly centerX: number;
  readonly topY: number;

  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly keycap: Phaser.GameObjects.Rectangle;
  /** Large glyph char — primary visual (§D8 temp art exception). */
  private readonly glyphText: Phaser.GameObjects.Text;
  private readonly timerText: Phaser.GameObjects.Text;
  private readonly hotkeyText: Phaser.GameObjects.Text;
  private ready = true;
  private combatRunning = true;
  private armed = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    def: CooldownDef,
    hotkeyLabel: string,
    onClick: (cooldownId: string) => void,
    onHoverStart: (cooldownId: string, centerX: number, topY: number) => void,
    onHoverEnd: () => void,
  ) {
    this.cooldownId = def.id;
    this.centerX = x;
    this.topY = y - CD_BUTTON_HEIGHT / 2;

    this.bg = scene.add
      .rectangle(x, y, CD_BUTTON_WIDTH, CD_BUTTON_HEIGHT, BUTTON_BG_COLOR)
      .setStrokeStyle(BUTTON_BORDER_WIDTH, BUTTON_BORDER_COLOR)
      .setInteractive({ useHandCursor: true })
      .setName(`combatCooldown:${def.id}`);
    this.bg.on('pointerdown', () => {
      if (this.ready && this.combatRunning) onClick(this.cooldownId);
    });
    this.bg.on('pointerover', () => onHoverStart(this.cooldownId, this.centerX, this.topY));
    this.bg.on('pointerout', () => onHoverEnd());

    const keycapX = x - CD_BUTTON_WIDTH / 2 + 6 + KEYCAP_WIDTH / 2;
    const keycapY = y - CD_BUTTON_HEIGHT / 2 + 6 + KEYCAP_HEIGHT / 2;
    this.keycap = scene.add
      .rectangle(keycapX, keycapY, KEYCAP_WIDTH, KEYCAP_HEIGHT, KEYCAP_BG)
      .setStrokeStyle(1, KEYCAP_BORDER);

    this.glyphText = scene.add
      .text(x, y - 5, glyphChar(def), {
        fontFamily: FONT,
        fontSize: CD_GLYPH_FONT_SIZE,
        fontStyle: 'bold',
        color: GLYPH_COLOR,
        stroke: '#0a0605',
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    this.timerText = scene.add
      .text(x, y + 14, '', { fontFamily: FONT, fontSize: CD_TIMER_FONT_SIZE, color: CD_TIMER_COLOR })
      .setOrigin(0.5)
      .setVisible(false);
    this.hotkeyText = scene.add
      .text(keycapX, keycapY, hotkeyLabel, {
        fontFamily: FONT,
        fontSize: HOTKEY_FONT_SIZE,
        color: HOTKEY_COLOR,
      })
      .setOrigin(0.5);
  }

  /** Reflects one CooldownState snapshot: dimmed + seconds while on cooldown, accent border while a buff is active. */
  update(state: CooldownState): void {
    this.ready = state.remainingCooldownMs <= 0;
    this.updateAvailability();
    this.timerText.setVisible(!this.ready);
    if (!this.ready) this.timerText.setText(`${Math.ceil(state.remainingCooldownMs / 1000)}s`);

    const armed = state.activeRemainingMs > 0;
    if (armed !== this.armed) {
      this.armed = armed;
      this.bg.setStrokeStyle(armed ? ARMED_BORDER_WIDTH : BUTTON_BORDER_WIDTH, armed ? ARMED_BORDER_COLOR : BUTTON_BORDER_COLOR);
    }
  }

  setCombatRunning(isRunning: boolean): void {
    this.combatRunning = isRunning;
    this.updateAvailability();
  }

  private updateAvailability(): void {
    const alpha = this.ready && this.combatRunning ? 1 : BUTTON_DISABLED_ALPHA;
    this.bg.setAlpha(alpha);
    this.keycap.setAlpha(alpha);
    this.glyphText.setAlpha(alpha);
    this.timerText.setAlpha(this.combatRunning ? 1 : BUTTON_DISABLED_ALPHA);
    this.hotkeyText.setAlpha(alpha);
  }

  destroy(): void {
    this.bg.destroy();
    this.keycap.destroy();
    this.glyphText.destroy();
    this.timerText.destroy();
    this.hotkeyText.destroy();
  }
}

/** Two-row action bar: QWER spells on the bottom, Shift+QWER major CDs above
 *  (same finger columns). Empty CD row is omitted entirely when the loadout
 *  grants none. */
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
      this.tooltip.showCard(buttonCenterX, buttonTopY, buildSpellCard(spell, { loadout }));
    };
    const hideTooltip = (): void => this.tooltip.hide();
    const showCooldownTooltip = (cooldownId: string, buttonCenterX: number, buttonTopY: number): void => {
      const cooldown = cooldowns.find((c) => c.id === cooldownId);
      if (!cooldown) return;
      this.tooltip.show(buttonCenterX, buttonTopY, buildCooldownTooltipLines(cooldown));
    };

    const columns = Math.max(spells.length, cooldowns.length, 1);
    const totalWidth = columns * BUTTON_WIDTH + Math.max(0, columns - 1) * BUTTON_GAP;
    const startX = centerX - totalWidth / 2 + BUTTON_WIDTH / 2;
    const spellY = y;
    const cdY = y - BUTTON_HEIGHT - ROW_GAP;

    spells.forEach((spell, i) => {
      const x = startX + i * (BUTTON_WIDTH + BUTTON_GAP);
      const label = actionHotkeyLabel(i) ?? '';
      this.buttons.push(new SpellButton(scene, x, spellY, spell, label, onCast, showTooltip, hideTooltip));
    });

    cooldowns.forEach((def, i) => {
      const x = startX + i * (BUTTON_WIDTH + BUTTON_GAP);
      // Shift row always maps to slots 4–7 (finger columns), not "after spells".
      const label = actionHotkeyLabel(4 + i) ?? '';
      this.cooldownButtons.push(
        new CooldownButton(
          scene,
          x,
          cdY,
          def,
          label,
          onCooldownClick,
          showCooldownTooltip,
          hideTooltip,
        ),
      );
    });
  }

  /** Toggle each button's look from healer mana / target / running state.
   *  Damage spells need a living enemy instead of an ally heal target. */
  setState(
    healerMana: number,
    hasAllyTarget: boolean,
    isRunning: boolean,
    hasEnemyTarget = true,
  ): void {
    for (const button of this.buttons) {
      const canAfford = healerMana >= button.mana;
      const hasTarget = button.requiresAllyTarget ? hasAllyTarget : hasEnemyTarget;
      const enabled = isRunning && hasTarget && canAfford;
      button.setCastability(enabled, canAfford);
    }
    for (const button of this.cooldownButtons) button.setCombatRunning(isRunning);
  }

  /** Accent border on buttons whose spell id has an armed synergy buffing it (handoff §E). */
  setArmedSpellIds(ids: Iterable<string>): void {
    const armedSet = ids instanceof Set ? ids : new Set(ids);
    for (const button of this.buttons) button.setArmed(armedSet.has(button.spellId));
  }

  /** Per-frame sync for major CD buttons (Alpha 0.1 §D6). */
  updateCooldowns(states: CooldownState[]): void {
    for (const button of this.cooldownButtons) {
      const state = states.find((s) => s.id === button.cooldownId);
      if (state) button.update(state);
    }
  }

  /** Per-frame sync for personal spell reuse timers (Vowstrike). */
  updateSpellCooldowns(states: Array<{ spellId: string; remainingMs: number }>): void {
    for (const button of this.buttons) {
      const state = states.find((s) => s.spellId === button.spellId);
      button.setSpellCooldown(state?.remainingMs ?? 0);
    }
  }

  destroy(): void {
    for (const button of this.buttons) button.destroy();
    for (const button of this.cooldownButtons) button.destroy();
    this.tooltip.destroy();
  }
}
