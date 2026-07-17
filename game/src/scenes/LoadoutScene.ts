/**
 * Spellbook: four QWER slots with Shift+QWER finger hints above each.
 * Click a slot → pick an owned spell. Duplicates allowed (keeps the picker
 * trivial). Empty slots stay vacant. Temp art only — Hub palette.
 */

import Phaser from 'phaser';
import { SceneKeys } from './keys';
import { loadSave, saveGame, emptyActionBar } from '../save/save';
import { ownedSpellsFromSave } from '../data/talentTree';
import { ACTION_BAR_SLOTS } from '../data/constants';
import { ACTION_HOTKEY_LETTERS, actionHotkeyLabel } from '../ui/actionHotkeys';
import { glyphChar } from '../ui/glyph';
import type { SpellDef } from '../combat/types';

const BG_COLOR = 0x1a1210;
const BUTTON_COLOR = 0x3a2a22;
const BUTTON_HOVER = 0x4a3a2e;
const BORDER_COLOR = 0x0a0605;
const ACCENT_BORDER = 0xf2c14e;
const TEXT_COLOR = '#e8d8c8';
const ACCENT_COLOR = '#f2c14e';
const DIM_COLOR = '#a89888';
const FONT = 'monospace';

const SLOT_W = 110;
const SLOT_H = 88;
const SLOT_GAP = 16;
const PICK_W = 220;
const PICK_H = 36;
const PICK_GAP = 8;

export class LoadoutScene extends Phaser.Scene {
  private selectedSlot: number | null = null;

  constructor() {
    super(SceneKeys.Loadout);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BG_COLOR);
    this.selectedSlot = null;
    this.rebuild();
  }

  private rebuild(): void {
    this.children.removeAll(true);

    const { width, height } = this.scale;
    const save = loadSave();
    const owned = ownedSpellsFromSave(save);
    const bar =
      save.actionBar.length === ACTION_BAR_SLOTS ? [...save.actionBar] : emptyActionBar();

    this.add
      .text(width / 2, 40, 'Spellbook', { fontFamily: FONT, fontSize: '28px', color: TEXT_COLOR })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 72, 'Click a slot, then pick a spell. Shift row = same finger (major CDs).', {
        fontFamily: FONT,
        fontSize: '14px',
        color: DIM_COLOR,
      })
      .setOrigin(0.5);

    const totalW = ACTION_BAR_SLOTS * SLOT_W + (ACTION_BAR_SLOTS - 1) * SLOT_GAP;
    const startX = width / 2 - totalW / 2 + SLOT_W / 2;
    const slotY = 168;

    for (let i = 0; i < ACTION_BAR_SLOTS; i++) {
      const x = startX + i * (SLOT_W + SLOT_GAP);
      const spellId = bar[i] ?? '';
      const spell = owned.find((s) => s.id === spellId);
      const selected = this.selectedSlot === i;
      const bg = this.add
        .rectangle(x, slotY, SLOT_W, SLOT_H, selected ? BUTTON_HOVER : BUTTON_COLOR)
        .setStrokeStyle(selected ? 3 : 2, selected ? ACCENT_BORDER : BORDER_COLOR)
        .setInteractive({ useHandCursor: true })
        .setName(`loadoutSlot:${i}`);
      const letter = ACTION_HOTKEY_LETTERS[i] ?? '?';
      const shiftLabel = actionHotkeyLabel(ACTION_HOTKEY_LETTERS.length + i) ?? `s${letter}`;
      this.add
        .text(x, slotY - SLOT_H / 2 + 14, shiftLabel, {
          fontFamily: FONT,
          fontSize: '12px',
          color: DIM_COLOR,
        })
        .setOrigin(0.5);
      this.add
        .text(x, slotY - SLOT_H / 2 + 30, letter, {
          fontFamily: FONT,
          fontSize: '14px',
          color: ACCENT_COLOR,
        })
        .setOrigin(0.5);
      this.add
        .text(x, slotY + 8, spell ? glyphChar(spell) : '·', {
          fontFamily: FONT,
          fontSize: '26px',
          fontStyle: 'bold',
          color: spell ? TEXT_COLOR : DIM_COLOR,
        })
        .setOrigin(0.5);
      this.add
        .text(x, slotY + 30, spell?.name ?? '(empty)', {
          fontFamily: FONT,
          fontSize: '11px',
          color: DIM_COLOR,
        })
        .setOrigin(0.5);
      bg.on('pointerdown', () => {
        this.selectedSlot = i;
        this.rebuild();
      });
    }

    if (this.selectedSlot !== null) {
      this.buildPicker(owned, this.selectedSlot);
    }

    this.makeButton(width / 2, height - 40, 200, 44, 'Back', () => {
      this.scene.start(SceneKeys.Hub);
    }, 'loadoutBack');
  }

  private buildPicker(owned: SpellDef[], slotIndex: number): void {
    const { width } = this.scale;
    const letter = ACTION_HOTKEY_LETTERS[slotIndex] ?? '?';
    this.add
      .text(width / 2, 240, `Assign ${letter} (Shift+${letter} is the CD finger)`, {
        fontFamily: FONT,
        fontSize: '16px',
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5);

    const choices: Array<{ id: string; label: string; glyph: string }> = [
      { id: '', label: '(empty)', glyph: '·' },
      ...owned.map((s) => ({ id: s.id, label: s.name, glyph: glyphChar(s) })),
    ];

    const cols = 2;
    const gridW = cols * PICK_W + (cols - 1) * PICK_GAP;
    const startX = width / 2 - gridW / 2 + PICK_W / 2;
    const startY = 280;

    choices.forEach((choice, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (PICK_W + PICK_GAP);
      const y = startY + row * (PICK_H + PICK_GAP);
      const bg = this.add
        .rectangle(x, y, PICK_W, PICK_H, BUTTON_COLOR)
        .setStrokeStyle(1, BORDER_COLOR)
        .setInteractive({ useHandCursor: true })
        .setName(choice.id ? `loadoutPick:${choice.id}` : 'loadoutPick:empty');
      this.add
        .text(x, y, `${choice.glyph}  ${choice.label}`, {
          fontFamily: FONT,
          fontSize: '14px',
          color: TEXT_COLOR,
        })
        .setOrigin(0.5);
      bg.on('pointerover', () => bg.setFillStyle(BUTTON_HOVER).setStrokeStyle(2, ACCENT_BORDER));
      bg.on('pointerout', () => bg.setFillStyle(BUTTON_COLOR).setStrokeStyle(1, BORDER_COLOR));
      bg.on('pointerdown', () => {
        const save = loadSave();
        const next =
          save.actionBar.length === ACTION_BAR_SLOTS ? [...save.actionBar] : emptyActionBar();
        next[slotIndex] = choice.id;
        save.actionBar = next;
        saveGame(save);
        this.selectedSlot = null;
        this.rebuild();
      });
    });
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
    this.add.text(x, y, label, { fontFamily: FONT, fontSize: '18px', color: TEXT_COLOR }).setOrigin(0.5);
    rect.on('pointerdown', onClick);
  }
}
