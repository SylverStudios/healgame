/**
 * Settings: music volume + Talent tree mode (Classic / Radial / Spell cards)
 * + Catalogue (cards-mode spell/chip review).
 * Switching mode confirms, wipes the save, and restarts Tutorial in that mode.
 */

import Phaser from 'phaser';
import { SceneKeys } from './keys';
import {
  loadSave,
  resetSaveToMode,
  saveGame,
  type ProgressionMode,
} from '../save/save';
import { clampMusicPct, setMusicVolumePct } from '../ui/music';
import { FONT, FONT_SIZE_SM, FONT_SIZE_LG } from '../ui/theme';
import { addButton, addPanel } from '../ui/panels';
import { fadeInOnCreate, fadeToScene } from '../ui/transitions';

const BG_COLOR = 0x1a1210;
const TRACK_COLOR = 0x3a2a22;
const FILL_COLOR = 0xf2c14e;
const KNOB_COLOR = 0xfff2df;
const BORDER_COLOR = 0x0a0605;
const BUTTON_COLOR = 0x3a2a22;
const BUTTON_ACTIVE = 0x5a4030;
const TEXT_COLOR = '#e8d8c8';
const ACCENT_COLOR = '#f2c14e';
const DIM_COLOR = '#a89888';
const DANGER_COLOR = '#e07070';

/** Track pixel width — also the relative offset journey.mjs uses (-TRACK_WIDTH/2
 *  from the located center) to reach the track's left edge without a
 *  hard-coded layout coordinate. Keep the two in sync if this changes. */
const TRACK_WIDTH = 400;
const TRACK_HEIGHT = 10;
const KNOB_RADIUS = 10;

export class SettingsScene extends Phaser.Scene {
  private trackLeftX = 0;
  private trackY = 0;
  private dragging = false;
  private currentPct = 0;
  private fill: Phaser.GameObjects.Rectangle | null = null;
  private knob: Phaser.GameObjects.Arc | null = null;
  private pctLabel: Phaser.GameObjects.Text | null = null;
  private confirmLayer: { destroy: () => void }[] = [];

  constructor() {
    super(SceneKeys.Settings);
  }

  create(): void {
    this.dragging = false;
    this.confirmLayer = [];
    this.cameras.main.setBackgroundColor(BG_COLOR);
    fadeInOnCreate(this);
    const { width, height } = this.scale;
    const centerX = width / 2;

    this.add
      .text(centerX, 40, 'Settings', { fontFamily: FONT, fontSize: FONT_SIZE_LG, color: TEXT_COLOR })
      .setOrigin(0.5);

    const save = loadSave();
    this.currentPct = clampMusicPct(save.musicVolumePct);

    addPanel(this, centerX, 140, 460, 110);

    this.add
      .text(centerX, 108, 'Music Volume', { fontFamily: FONT, fontSize: FONT_SIZE_SM, color: DIM_COLOR })
      .setOrigin(0.5);

    this.trackY = 148;
    this.trackLeftX = centerX - TRACK_WIDTH / 2;

    const track = this.add
      .rectangle(centerX, this.trackY, TRACK_WIDTH, TRACK_HEIGHT, TRACK_COLOR)
      .setStrokeStyle(1, BORDER_COLOR)
      .setInteractive({ useHandCursor: true })
      .setName('settingsVolumeSlider');

    this.fill = this.add
      .rectangle(this.trackLeftX, this.trackY, this.fillWidthFor(this.currentPct), TRACK_HEIGHT, FILL_COLOR)
      .setOrigin(0, 0.5);

    this.knob = this.add
      .circle(this.knobXFor(this.currentPct), this.trackY, KNOB_RADIUS, KNOB_COLOR)
      .setStrokeStyle(2, BORDER_COLOR);

    this.pctLabel = this.add
      .text(centerX, this.trackY + 28, `${this.currentPct}%`, {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5);

    track.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.dragging = true;
      this.applyPointerX(pointer.x);
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.dragging) this.applyPointerX(pointer.x);
    });
    this.input.on('pointerup', () => {
      if (!this.dragging) return;
      this.dragging = false;
      this.persist();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.dragging) this.persist();
    });

    addPanel(this, centerX, 310, 700, 160);
    this.add
      .text(centerX, 250, 'Talent tree', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: DIM_COLOR,
      })
      .setOrigin(0.5);
    this.add
      .text(centerX, 278, 'Switching wipes your save and restarts.', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: DANGER_COLOR,
      })
      .setOrigin(0.5);

    const mode = save.progressionMode;
    this.makeModeButton(centerX - 220, 330, 'Classic', 'lattice', mode === 'lattice', 'settingsProgressionLattice');
    this.makeModeButton(centerX, 330, 'Radial', 'radial', mode === 'radial', 'settingsProgressionRadial');
    this.makeModeButton(centerX + 220, 330, 'Spell cards', 'cards', mode === 'cards', 'settingsProgressionCards');

    this.makeButton(
      centerX,
      430,
      240,
      44,
      'Catalogue',
      () => fadeToScene(this, SceneKeys.Catalogue, {}),
      'settingsCatalogue',
    );

    this.makeButton(
      centerX,
      height - 48,
      200,
      44,
      'Back',
      () => fadeToScene(this, SceneKeys.Hub, {}),
      'settingsBack',
    );
  }

  private makeModeButton(
    x: number,
    y: number,
    label: string,
    mode: ProgressionMode,
    active: boolean,
    name: string,
  ): void {
    const fill = active ? BUTTON_ACTIVE : BUTTON_COLOR;
    const rect = this.add
      .rectangle(x, y, 180, 48, fill)
      .setStrokeStyle(2, active ? FILL_COLOR : BORDER_COLOR)
      .setInteractive({ useHandCursor: true })
      .setName(name);
    addButton(this, x, y, 180, 48, { fillColor: fill, hitRect: rect });
    this.add
      .text(x, y, label, {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: active ? ACCENT_COLOR : TEXT_COLOR,
      })
      .setOrigin(0.5);
    rect.on('pointerdown', () => {
      if (loadSave().progressionMode === mode) return;
      this.openModeConfirm(mode);
    });
  }

  private openModeConfirm(mode: ProgressionMode): void {
    this.clearConfirm();
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    const dim = this.add.rectangle(cx, cy, width, height, 0x000000, 0.65).setInteractive();
    const panel = addPanel(this, cx, cy, 520, 200);
    const title = this.add
      .text(cx, cy - 60, `Switch to ${modeLabel(mode)}?`, {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5);
    const body = this.add
      .text(cx, cy - 20, 'This wipes your save and restarts the tutorial.', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: TEXT_COLOR,
        align: 'center',
      })
      .setOrigin(0.5);

    const confirm = this.add
      .rectangle(cx - 100, cy + 50, 180, 44, BUTTON_COLOR)
      .setStrokeStyle(2, FILL_COLOR)
      .setInteractive({ useHandCursor: true })
      .setName('settingsProgressionConfirm');
    addButton(this, cx - 100, cy + 50, 180, 44, { fillColor: BUTTON_COLOR, hitRect: confirm });
    const confirmLabel = this.add
      .text(cx - 100, cy + 50, 'Wipe & restart', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: DANGER_COLOR,
      })
      .setOrigin(0.5);
    confirm.on('pointerdown', () => {
      this.persist();
      resetSaveToMode(mode);
      fadeToScene(this, SceneKeys.Tutorial, {});
    });

    const cancel = this.add
      .rectangle(cx + 100, cy + 50, 160, 44, BUTTON_COLOR)
      .setStrokeStyle(2, BORDER_COLOR)
      .setInteractive({ useHandCursor: true })
      .setName('settingsProgressionCancel');
    addButton(this, cx + 100, cy + 50, 160, 44, { fillColor: BUTTON_COLOR, hitRect: cancel });
    const cancelLabel = this.add
      .text(cx + 100, cy + 50, 'Cancel', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: TEXT_COLOR,
      })
      .setOrigin(0.5);
    cancel.on('pointerdown', () => this.clearConfirm());

    this.confirmLayer = [dim, panel, title, body, confirm, confirmLabel, cancel, cancelLabel];
  }

  private clearConfirm(): void {
    for (const obj of this.confirmLayer) obj.destroy();
    this.confirmLayer = [];
  }

  private fillWidthFor(pct: number): number {
    return (TRACK_WIDTH * pct) / 100;
  }

  private knobXFor(pct: number): number {
    return this.trackLeftX + this.fillWidthFor(pct);
  }

  private applyPointerX(pointerX: number): void {
    const ratio = Phaser.Math.Clamp((pointerX - this.trackLeftX) / TRACK_WIDTH, 0, 1);
    this.setPct(clampMusicPct(ratio * 100));
  }

  private setPct(pct: number): void {
    this.currentPct = pct;
    setMusicVolumePct(pct);
    this.fill?.setSize(this.fillWidthFor(pct), TRACK_HEIGHT);
    this.knob?.setX(this.knobXFor(pct));
    this.pctLabel?.setText(`${pct}%`);
  }

  private persist(): void {
    const save = loadSave();
    save.musicVolumePct = this.currentPct;
    saveGame(save);
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
    this.add.text(x, y, label, { fontFamily: FONT, fontSize: FONT_SIZE_SM, color: TEXT_COLOR }).setOrigin(0.5);
    rect.on('pointerdown', onClick);
  }
}

function modeLabel(mode: ProgressionMode): string {
  if (mode === 'radial') return 'Radial';
  if (mode === 'cards') return 'Spell cards';
  return 'Classic';
}
