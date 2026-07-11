/**
 * Spell tooltip panel (phase-2-handoff Chunk 2, "Locked tooltip decisions").
 * Shown on pointerover (no delay) above the hovered spell button; hidden on
 * pointerout. One shared instance per SpellBar — showing new content just
 * replaces the panel in place, so only one tooltip is ever visible.
 */

import Phaser from 'phaser';
import type { SpellDef } from '../combat/types';
import type { CombatMods } from '../data/spellTree';
import { spellById } from '../data/spells';

const PADDING = 6;
const LINE_GAP = 3;
const BG_COLOR = 0x241a15;
const BORDER_COLOR = 0x0a0605;
const FONT = 'monospace';
const FONT_SIZE = '12px';
const DEPTH = 300;

const DEFAULT_LINE_COLOR = '#d8c8b8';
const NAME_LINE_COLOR = '#e8d8c8';
const SYNERGY_LINE_COLOR = '#f2c14e';

interface TooltipLine {
  text: string;
  color: string;
}

/** Looks up a spell's display name: resolved loadout copy first, then the static catalog. */
function spellName(id: string, loadout: CombatMods): string {
  return loadout.spells.find((s) => s.id === id)?.name ?? spellById(id)?.name ?? id;
}

/** Builds the pinned content lines (order matters — see phase-2-handoff) for one spell button. */
export function buildTooltipLines(spell: SpellDef, loadout: CombatMods): TooltipLine[] {
  const lines: TooltipLine[] = [
    { text: spell.name, color: NAME_LINE_COLOR },
    { text: `Heals ${spell.heal}`, color: DEFAULT_LINE_COLOR },
    { text: `Costs ${spell.mana} mana`, color: DEFAULT_LINE_COLOR },
    { text: `Cast: ${(spell.castMs / 1000).toFixed(1)}s`, color: DEFAULT_LINE_COLOR },
  ];

  for (const synergy of loadout.synergies) {
    if (synergy.buffedSpellId === spell.id) {
      lines.push({
        text: `+${synergy.bonusHeal} heal when armed by ${spellName(synergy.triggerSpellId, loadout)}`,
        color: SYNERGY_LINE_COLOR,
      });
    }
  }
  for (const synergy of loadout.synergies) {
    if (synergy.triggerSpellId === spell.id) {
      lines.push({
        text: `Arms +${synergy.bonusHeal} on your next ${spellName(synergy.buffedSpellId, loadout)}`,
        color: SYNERGY_LINE_COLOR,
      });
    }
  }
  for (const bonus of loadout.missingHealthBonuses) {
    if (bonus.spellId === spell.id) {
      lines.push({
        text: `+${bonus.healPer10PctMissing} per 10% target health missing`,
        color: SYNERGY_LINE_COLOR,
      });
    }
  }

  return lines;
}

/** Dark bordered panel that renders a stack of colored monospace lines above a given point. */
export class SpellTooltip {
  private readonly scene: Phaser.Scene;
  private readonly screenWidth: number;
  private readonly container: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Rectangle;
  private lineTexts: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene, screenWidth: number) {
    this.scene = scene;
    this.screenWidth = screenWidth;
    this.bg = scene.add.rectangle(0, 0, 10, 10, BG_COLOR).setOrigin(0, 0).setStrokeStyle(1, BORDER_COLOR);
    this.container = scene.add.container(0, 0, [this.bg]).setDepth(DEPTH).setVisible(false);
  }

  /** Shows the panel above the point (anchorX, buttonTopY), clamped so it stays fully on-screen. */
  show(anchorX: number, buttonTopY: number, lines: TooltipLine[]): void {
    for (const text of this.lineTexts) text.destroy();
    this.lineTexts = [];

    let cursorY = PADDING;
    let maxWidth = 0;
    for (const line of lines) {
      const text = this.scene.add.text(PADDING, cursorY, line.text, {
        fontFamily: FONT,
        fontSize: FONT_SIZE,
        color: line.color,
      });
      this.container.add(text);
      this.lineTexts.push(text);
      maxWidth = Math.max(maxWidth, text.width);
      cursorY += text.height + LINE_GAP;
    }

    const panelWidth = maxWidth + PADDING * 2;
    const panelHeight = cursorY - LINE_GAP + PADDING;
    this.bg.setSize(panelWidth, panelHeight);

    const panelX = Phaser.Math.Clamp(anchorX - panelWidth / 2, 0, this.screenWidth - panelWidth);
    const panelY = buttonTopY - panelHeight;
    this.container.setPosition(panelX, panelY);
    this.container.setVisible(true);
  }

  hide(): void {
    this.container.setVisible(false);
  }

  destroy(): void {
    this.container.destroy();
  }
}
