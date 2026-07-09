/**
 * A single combat unit rendered as a colored rectangle + name label + HP bar
 * (+ mana bar for the healer) + optional click-to-target marker. Temp art
 * only (poc-spec §4, tech-options.md "Temp art plan"): geometric placeholders,
 * dark palette, readability over beauty.
 */

import Phaser from 'phaser';
import type { Unit } from '../combat/types';
import { Bar } from './bar';

const HP_BAR_HEIGHT = 8;
const HP_BAR_OFFSET_Y = 10;
const MANA_BAR_HEIGHT = 6;
const MANA_BAR_GAP = 4;
const NAME_LABEL_GAP = 8;
const HP_TEXT_GAP = 2;

const HP_FILL_COLOR = 0x4caf50;
const MANA_FILL_COLOR = 0x3b82f6;
const DEAD_TINT = 0x3a3a3a;
const DEAD_ALPHA = 0.4;
const DEAD_SCALE = 0.85;

const NAME_FONT = '11px monospace';
const NAME_COLOR = '#d8c8b8';
const HP_FONT = '10px monospace';
const HP_COLOR = '#e8d8c8';

const DAMAGE_FLASH_COLOR = 0xff3b30;
const HEAL_FLASH_COLOR = 0x3ce06a;
const FLASH_ALPHA = 0.65;
const FLASH_DURATION_MS = 260;

const TARGET_MARKER_WIDTH = 14;
const TARGET_MARKER_HEIGHT = 10;
const TARGET_MARKER_GAP = 6;
const TARGET_MARKER_COLOR = 0xf2c14e;

export interface UnitSpriteConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
  showMana: boolean;
  clickable: boolean;
  onClick?: (unitId: string) => void;
}

/** Colored-rect placeholder for one combat unit, with bars/labels/marker layered above it. */
export class UnitSprite {
  readonly id: string;

  private readonly scene: Phaser.Scene;
  private readonly x: number;
  private readonly y: number;
  private readonly width: number;
  private readonly height: number;
  private readonly baseColor: number;

  private readonly rect: Phaser.GameObjects.Rectangle;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly hpBar: Bar;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly manaBar: Bar | null;
  private readonly manaText: Phaser.GameObjects.Text | null;
  private readonly targetMarker: Phaser.GameObjects.Triangle;

  private alive = true;

  constructor(unit: Unit, config: UnitSpriteConfig) {
    const { scene, x, y, width, height, color, showMana, clickable, onClick } = config;
    this.id = unit.id;
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.baseColor = color;

    this.rect = scene.add.rectangle(x, y, width, height, color).setStrokeStyle(1, 0x0a0605);
    if (clickable) {
      this.rect.setInteractive({ useHandCursor: true });
      this.rect.on('pointerdown', () => {
        if (this.alive) onClick?.(this.id);
      });
    }

    this.nameText = scene.add
      .text(x, y + height / 2 + NAME_LABEL_GAP, unit.name, { fontFamily: NAME_FONT, color: NAME_COLOR })
      .setOrigin(0.5, 0);

    const hpY = y - height / 2 - HP_BAR_OFFSET_Y;
    this.hpBar = new Bar(scene, x - width / 2, hpY, width, HP_BAR_HEIGHT, HP_FILL_COLOR);
    this.hpText = scene.add
      .text(x, hpY - HP_BAR_HEIGHT / 2 - HP_TEXT_GAP, '', { fontFamily: HP_FONT, color: HP_COLOR })
      .setOrigin(0.5, 1);

    if (showMana) {
      const manaY = hpY - HP_BAR_HEIGHT / 2 - MANA_BAR_GAP - MANA_BAR_HEIGHT / 2;
      this.manaBar = new Bar(scene, x - width / 2, manaY, width, MANA_BAR_HEIGHT, MANA_FILL_COLOR);
      this.manaText = scene.add
        .text(x, manaY - MANA_BAR_HEIGHT / 2 - HP_TEXT_GAP, '', { fontFamily: HP_FONT, color: '#a8c8f0' })
        .setOrigin(0.5, 1);
    } else {
      this.manaBar = null;
      this.manaText = null;
    }

    const markerTop = hpY - HP_BAR_HEIGHT / 2 - (showMana ? MANA_BAR_HEIGHT + MANA_BAR_GAP : 0) - TARGET_MARKER_GAP;
    this.targetMarker = scene.add
      .triangle(
        x,
        markerTop,
        -TARGET_MARKER_WIDTH / 2,
        -TARGET_MARKER_HEIGHT,
        TARGET_MARKER_WIDTH / 2,
        -TARGET_MARKER_HEIGHT,
        0,
        0,
        TARGET_MARKER_COLOR,
      )
      .setVisible(false);

    this.update(unit);
  }

  /** Sync visuals to the latest engine unit snapshot. Cheap — call every frame. */
  update(unit: Unit): void {
    this.alive = unit.alive;
    this.hpBar.setRatio(unit.maxHp > 0 ? unit.hp / unit.maxHp : 0);
    this.hpText.setText(`${Math.max(0, Math.ceil(unit.hp))}/${unit.maxHp}`);
    if (this.manaBar && this.manaText) {
      this.manaBar.setRatio(unit.maxMana > 0 ? unit.mana / unit.maxMana : 0);
      this.manaText.setText(`${Math.max(0, Math.ceil(unit.mana))}/${unit.maxMana}`);
    }

    if (unit.alive) {
      this.rect.setFillStyle(this.baseColor);
      this.rect.setAlpha(1);
      this.rect.setScale(1);
      this.hpBar.setVisible(true);
      this.manaBar?.setVisible(true);
    } else {
      this.rect.setFillStyle(DEAD_TINT);
      this.rect.setAlpha(DEAD_ALPHA);
      this.rect.setScale(DEAD_SCALE);
      this.hpBar.setVisible(false);
      this.manaBar?.setVisible(false);
      this.targetMarker.setVisible(false);
    }
  }

  setTargeted(isTargeted: boolean): void {
    this.targetMarker.setVisible(isTargeted && this.alive);
  }

  /** Brief red flash for a damage event on this unit. */
  flashDamage(): void {
    this.flash(DAMAGE_FLASH_COLOR);
  }

  /** Brief green flash for a heal event on this unit. */
  flashHeal(): void {
    this.flash(HEAL_FLASH_COLOR);
  }

  private flash(color: number): void {
    const overlay = this.scene.add
      .rectangle(this.x, this.y, this.width, this.height, color, FLASH_ALPHA)
      .setDepth(10);
    this.scene.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: FLASH_DURATION_MS,
      onComplete: () => overlay.destroy(),
    });
  }

  destroy(): void {
    this.rect.destroy();
    this.nameText.destroy();
    this.hpBar.destroy();
    this.hpText.destroy();
    this.manaBar?.destroy();
    this.manaText?.destroy();
    this.targetMarker.destroy();
  }
}
