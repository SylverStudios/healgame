/**
 * Settings: music volume slider (0..100) + Back to Hub. Temp art only — dark
 * palette, pixel font, matches Hub/Tree/Loadout styling (v0.3 chunk H).
 *
 * Live-apply: dragging or clicking the track calls setMusicVolumePct()
 * immediately (audible feedback while adjusting); the chosen integer is
 * persisted to SaveData on pointer release (debounce not needed — one write
 * per drag gesture).
 */

import Phaser from 'phaser';
import { SceneKeys } from './keys';
import { loadSave, saveGame } from '../save/save';
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
const TEXT_COLOR = '#e8d8c8';
const ACCENT_COLOR = '#f2c14e';
const DIM_COLOR = '#a89888';

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

  constructor() {
    super(SceneKeys.Settings);
  }

  create(): void {
    this.dragging = false;
    this.cameras.main.setBackgroundColor(BG_COLOR);
    // Chunk 6 (bible item 6): fade in on scene entry.
    fadeInOnCreate(this);
    const { width, height } = this.scale;
    const centerX = width / 2;

    this.add
      .text(centerX, 60, 'Settings', { fontFamily: FONT, fontSize: FONT_SIZE_LG, color: TEXT_COLOR })
      .setOrigin(0.5);

    const save = loadSave();
    this.currentPct = clampMusicPct(save.musicVolumePct);

    // Chunk 4 (bible item 4): settings panel — ui/panels.ts. The volume
    // track itself stays an unframed flat sliver (10px tall — same "too thin
    // for a border to read as anything but noise" finding chunk 3 recorded
    // for the GCD/boss-cast micro-bars; see artifacts/pixellab-4/README.md).
    addPanel(this, centerX, 193, 460, 130);

    this.add
      .text(centerX, 156, 'Music Volume', { fontFamily: FONT, fontSize: FONT_SIZE_SM, color: DIM_COLOR })
      .setOrigin(0.5);

    this.trackY = 196;
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
      .text(centerX, this.trackY + 34, `${this.currentPct}%`, {
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
    // A drag that ends off-canvas never sees this scene's pointerup — also
    // persist on shutdown so the last live-applied value is never lost.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.dragging) this.persist();
    });

    this.makeButton(
      centerX,
      height - 60,
      200,
      44,
      'Back',
      () => fadeToScene(this, SceneKeys.Hub),
      'settingsBack',
    );
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
