/**
 * Spellbook: assign owned spells to four QWER action-bar slots.
 * Bottom row echoes the combat spell bar (keycap chip + spell icon + mana
 * orb cost) — not the old hotkey / shift / glyph triple-letter stack.
 * Click a slot → pick an owned spell. Duplicates allowed. Empty slots stay
 * vacant. Temp art only — Hub palette + combat framing textures.
 */

import Phaser from 'phaser';
import { SceneKeys } from './keys';
import { loadSave, saveGame, emptyActionBar } from '../save/save';
import { ACTION_BAR_SLOTS } from '../data/constants';
import { ACTION_HOTKEY_LETTERS } from '../ui/actionHotkeys';
import { glyphChar } from '../ui/glyph';
import type { SpellDef } from '../combat/types';
import { loadoutFromSave, ownedSpellsFromSave, type CombatMods } from '../data/talentTree';
import { FONT, FONT_SIZE_XS, FONT_SIZE_SM, FONT_SIZE_MD, FONT_SIZE_LG } from '../ui/theme';
import { addButton } from '../ui/panels';
import { fadeInOnCreate, fadeToScene } from '../ui/transitions';
import { buildSpellCard } from '../ui/spellCard';
import { SpellTooltip } from '../ui/spellTooltip';
import { addManaCostAffordance, MANA_BLUE_CSS } from '../ui/manaAffordance';
import {
  BUTTON_FRAME_TEXTURE_KEY,
  KEYCAP_FRAME_TEXTURE_KEY,
  SPELL_ICON_SIZE,
  spellIconTextureKey,
} from '../ui/spellSprites';

const BG_COLOR = 0x1a1210;
const BUTTON_COLOR = 0x3a2a22;
const BUTTON_HOVER = 0x4a3a2e;
const BORDER_COLOR = 0x0a0605;
const ACCENT_BORDER = 0xf2c14e;
const TEXT_COLOR = '#e8d8c8';
const ACCENT_COLOR = '#f2c14e';
const DIM_COLOR = '#a89888';
const KEYCAP_BG = 0x241a15;
const KEYCAP_BORDER = 0x8a7868;

/** Combat spell-bar footprint (mirrored locally — spellBar.ts is owned by 2A). */
const SLOT_W = 100;
const SLOT_H = 52;
const SLOT_GAP = 10;
const KEYCAP_W = 18;
const KEYCAP_H = 14;

const PICK_W = 220;
const PICK_H = 40;
const PICK_GAP = 8;
const PICK_ICON = SPELL_ICON_SIZE * 2;

export class LoadoutScene extends Phaser.Scene {
  private selectedSlot: number | null = null;
  private tooltip: SpellTooltip | null = null;

  constructor() {
    super(SceneKeys.Loadout);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BG_COLOR);
    this.selectedSlot = null;
    this.tooltip = null;
    // Chunk 6 (bible item 6): fade in once, on scene entry — not inside
    // rebuild(), which also re-runs on every in-scene slot/pick click.
    fadeInOnCreate(this);
    this.rebuild();
  }

  private rebuild(): void {
    this.children.removeAll(true);
    this.tooltip = null;

    const { width, height } = this.scale;
    const save = loadSave();
    const owned = ownedSpellsFromSave(save);
    const loadout = loadoutFromSave(save);
    const bar =
      save.actionBar.length === ACTION_BAR_SLOTS ? [...save.actionBar] : emptyActionBar();

    this.add
      .text(width / 2, 36, 'Spellbook', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_LG,
        color: TEXT_COLOR,
      })
      .setOrigin(0.5);

    // Instruction line — "mana" tagged in mana blue (Wave 2 affordance).
    this.addInstructionLine(width / 2, 68);

    this.makeButton(width - 75, 26, 100, 34, 'Back', () => {
      fadeToScene(this, SceneKeys.Hub, {});
    }, 'loadoutBack');

    this.tooltip = new SpellTooltip(this, { screenWidth: width, depth: 400 });

    const totalW = ACTION_BAR_SLOTS * SLOT_W + (ACTION_BAR_SLOTS - 1) * SLOT_GAP;
    const startX = width / 2 - totalW / 2 + SLOT_W / 2;
    // Combat-like bottom row, clear of the top chrome / picker.
    const slotY = height - 72;

    for (let i = 0; i < ACTION_BAR_SLOTS; i++) {
      const x = startX + i * (SLOT_W + SLOT_GAP);
      const spellId = bar[i] ?? '';
      const spell = owned.find((s) => s.id === spellId);
      this.buildSlot(x, slotY, i, spell, loadout);
    }

    if (this.selectedSlot !== null) {
      this.buildPicker(owned, this.selectedSlot, loadout);
    } else {
      this.add
        .text(width / 2, height / 2 - 24, 'Click a slot below to assign a spell.', {
          fontFamily: FONT,
          fontSize: FONT_SIZE_SM,
          color: DIM_COLOR,
        })
        .setOrigin(0.5);
    }
  }

  /** Dim copy with a blue-tagged "mana" word. */
  private addInstructionLine(centerX: number, y: number): void {
    const left = this.add
      .text(0, 0, 'Click a slot, then pick a spell. Costs are ', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: DIM_COLOR,
      })
      .setOrigin(0, 0.5);
    const mana = this.add
      .text(0, 0, 'mana', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: MANA_BLUE_CSS,
      })
      .setOrigin(0, 0.5);
    const right = this.add
      .text(0, 0, ' orbs (Shift row = same finger for major CDs).', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: DIM_COLOR,
      })
      .setOrigin(0, 0.5);
    const totalW = left.width + mana.width + right.width;
    let x = centerX - totalW / 2;
    left.setPosition(x, y);
    x += left.width;
    mana.setPosition(x, y);
    x += mana.width;
    right.setPosition(x, y);
  }

  private buildSlot(
    x: number,
    y: number,
    index: number,
    spell: SpellDef | undefined,
    loadout: CombatMods,
  ): void {
    const selected = this.selectedSlot === index;
    const bg = this.add
      .rectangle(x, y, SLOT_W, SLOT_H, selected ? BUTTON_HOVER : BUTTON_COLOR)
      .setInteractive({ useHandCursor: true })
      .setName(`loadoutSlot:${index}`);

    const frame = this.addButtonFrame(x, y);
    if (frame) {
      bg.setFillStyle(BUTTON_COLOR, 0).setStrokeStyle(0);
    } else {
      bg.setStrokeStyle(selected ? 3 : 2, selected ? ACCENT_BORDER : BORDER_COLOR);
    }
    // Selected slot reuses the Hub CURRENT gold-outline convention.
    addButton(this, x, y, SLOT_W, SLOT_H, {
      fillColor: selected ? BUTTON_HOVER : BUTTON_COLOR,
      state: selected ? 'current' : 'normal',
      hitRect: bg,
    });

    const letter = ACTION_HOTKEY_LETTERS[index] ?? '?';
    const keycapX = x - SLOT_W / 2 + 6 + KEYCAP_W / 2;
    const keycapY = y - SLOT_H / 2 + 6 + KEYCAP_H / 2;
    this.addKeycap(keycapX, keycapY);
    this.add
      .text(keycapX, keycapY, letter, {
        fontFamily: FONT,
        fontSize: FONT_SIZE_XS,
        color: TEXT_COLOR,
      })
      .setOrigin(0.5);

    if (spell) {
      const glyph = this.add
        .text(x, y - 5, glyphChar(spell), {
          fontFamily: FONT,
          fontSize: FONT_SIZE_MD,
          fontStyle: 'bold',
          color: TEXT_COLOR,
          stroke: '#0a0605',
          strokeThickness: 2,
        })
        .setOrigin(0.5);
      const icon = this.addActionIcon(x, y - 5, spellIconTextureKey(spell.id));
      if (icon) glyph.setVisible(false);
      addManaCostAffordance(this, x, y + 15, spell.mana, {
        fontSize: FONT_SIZE_XS,
        canAfford: true,
      });
    } else {
      this.add
        .text(x, y - 2, '·', {
          fontFamily: FONT,
          fontSize: FONT_SIZE_MD,
          color: DIM_COLOR,
        })
        .setOrigin(0.5);
    }

    bg.on('pointerdown', () => {
      this.selectedSlot = index;
      this.rebuild();
    });
    bg.on('pointerover', () => {
      if (!spell || !this.tooltip) return;
      this.tooltip.showCard(x, y - SLOT_H / 2, buildSpellCard(spell, { loadout }));
    });
    bg.on('pointerout', () => this.tooltip?.hide());
  }

  private buildPicker(owned: SpellDef[], slotIndex: number, loadout: CombatMods): void {
    const { width, height } = this.scale;
    const letter = ACTION_HOTKEY_LETTERS[slotIndex] ?? '?';
    this.add
      .text(width / 2, 108, `Assign ${letter}  ·  Shift+${letter} is the CD finger`, {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5);

    const choices: Array<{ id: string; spell: SpellDef | null; label: string }> = [
      { id: '', spell: null, label: '(empty)' },
      ...owned.map((s) => ({ id: s.id, spell: s, label: s.name })),
    ];

    const cols = 2;
    const gridW = cols * PICK_W + (cols - 1) * PICK_GAP;
    const startX = width / 2 - gridW / 2 + PICK_W / 2;
    const startY = 148;
    // Keep the grid clear of the bottom action bar.
    const maxY = height - 110;

    choices.forEach((choice, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (PICK_W + PICK_GAP);
      const y = startY + row * (PICK_H + PICK_GAP);
      if (y > maxY) return;

      const bg = this.add
        .rectangle(x, y, PICK_W, PICK_H, BUTTON_COLOR)
        .setStrokeStyle(1, BORDER_COLOR)
        .setInteractive({ useHandCursor: true })
        .setName(choice.id ? `loadoutPick:${choice.id}` : 'loadoutPick:empty');
      const frame = addButton(this, x, y, PICK_W, PICK_H, {
        fillColor: BUTTON_COLOR,
        borderWidth: 1,
        hitRect: bg,
      });

      const iconX = x - PICK_W / 2 + 10 + PICK_ICON / 2;
      if (choice.spell) {
        const glyph = this.add
          .text(iconX, y, glyphChar(choice.spell), {
            fontFamily: FONT,
            fontSize: FONT_SIZE_SM,
            fontStyle: 'bold',
            color: TEXT_COLOR,
          })
          .setOrigin(0.5);
        const icon = this.addActionIcon(iconX, y, spellIconTextureKey(choice.spell.id));
        if (icon) {
          icon.setDisplaySize(PICK_ICON, PICK_ICON);
          glyph.setVisible(false);
        }
        // Compact mana orb cost on the pick row (right edge).
        addManaCostAffordance(this, x + PICK_W / 2 - 22, y, choice.spell.mana, {
          fontSize: FONT_SIZE_XS,
        });
      } else {
        this.add
          .text(iconX, y, '·', {
            fontFamily: FONT,
            fontSize: FONT_SIZE_SM,
            color: DIM_COLOR,
          })
          .setOrigin(0.5);
      }

      this.add
        .text(iconX + PICK_ICON / 2 + 10, y, choice.label, {
          fontFamily: FONT,
          fontSize: FONT_SIZE_SM,
          color: TEXT_COLOR,
        })
        .setOrigin(0, 0.5);

      bg.on('pointerover', () => {
        frame.setState('hover');
        if (choice.spell && this.tooltip) {
          this.tooltip.showCard(x, y - PICK_H / 2, buildSpellCard(choice.spell, { loadout }));
        }
      });
      bg.on('pointerout', () => {
        frame.setState('normal');
        this.tooltip?.hide();
      });
      bg.on('pointerdown', () => {
        const nextSave = loadSave();
        const next =
          nextSave.actionBar.length === ACTION_BAR_SLOTS
            ? [...nextSave.actionBar]
            : emptyActionBar();
        next[slotIndex] = choice.id;
        nextSave.actionBar = next;
        saveGame(nextSave);
        this.selectedSlot = null;
        this.rebuild();
      });
    });
  }

  private addButtonFrame(x: number, y: number): Phaser.GameObjects.Image | null {
    if (!this.textures.exists(BUTTON_FRAME_TEXTURE_KEY)) return null;
    return this.add
      .image(x, y, BUTTON_FRAME_TEXTURE_KEY)
      .setOrigin(0.5)
      .setDisplaySize(SLOT_W, SLOT_H);
  }

  private addKeycap(x: number, y: number): Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle {
    if (this.textures.exists(KEYCAP_FRAME_TEXTURE_KEY)) {
      return this.add
        .image(x, y, KEYCAP_FRAME_TEXTURE_KEY)
        .setOrigin(0.5)
        .setDisplaySize(KEYCAP_W, KEYCAP_H);
    }
    return this.add.rectangle(x, y, KEYCAP_W, KEYCAP_H, KEYCAP_BG).setStrokeStyle(1, KEYCAP_BORDER);
  }

  private addActionIcon(
    x: number,
    y: number,
    textureKey: string,
  ): Phaser.GameObjects.Image | null {
    if (!this.textures.exists(textureKey)) return null;
    return this.add
      .image(x, y, textureKey)
      .setOrigin(0.5)
      .setDisplaySize(SPELL_ICON_SIZE * 2, SPELL_ICON_SIZE * 2);
  }

  private makeButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onClick: () => void,
    name: string,
  ): void {
    const rect = this.add
      .rectangle(x, y, w, h, BUTTON_COLOR)
      .setStrokeStyle(2, BORDER_COLOR)
      .setInteractive({ useHandCursor: true })
      .setName(name);
    addButton(this, x, y, w, h, { fillColor: BUTTON_COLOR, hitRect: rect });
    this.add
      .text(x, y, label, { fontFamily: FONT, fontSize: FONT_SIZE_SM, color: TEXT_COLOR })
      .setOrigin(0.5);
    rect.on('pointerdown', onClick);
  }
}
