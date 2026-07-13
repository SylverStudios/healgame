/**
 * Bottom-corner combat pace control (handoff §S). Cycles available multipliers.
 */

import Phaser from 'phaser';

const TOGGLE_WIDTH = 56;
const TOGGLE_HEIGHT = 32;
const BG_COLOR = 0x3a2a22;
const BORDER_COLOR = 0x0a0605;
const LABEL_COLOR = '#e8d8c8';
const FONT = 'monospace';

export class PaceToggle {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private available: number[] = [10];
  private current = 10;
  private readonly onChange: (tenths: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number, onChange: (tenths: number) => void) {
    this.onChange = onChange;
    this.bg = scene.add
      .rectangle(x, y, TOGGLE_WIDTH, TOGGLE_HEIGHT, BG_COLOR)
      .setStrokeStyle(1, BORDER_COLOR)
      .setOrigin(0, 1)
      .setVisible(false)
      .setName('combatPaceToggle');
    this.label = scene.add
      .text(x + TOGGLE_WIDTH / 2, y - TOGGLE_HEIGHT / 2, '1x', {
        fontFamily: FONT,
        fontSize: '14px',
        color: LABEL_COLOR,
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on('pointerdown', () => this.cycle());
  }

  setAvailable(multipliersTenths: readonly number[]): void {
    const unique = [...new Set(multipliersTenths)].sort((a, b) => a - b);
    this.available = unique.length > 0 ? unique : [10];
    const show = this.available.length > 1;
    this.bg.setVisible(show);
    this.label.setVisible(show);
    if (!this.available.includes(this.current)) {
      this.setCurrent(this.available[0]!);
    }
  }

  setCurrent(tenths: number): void {
    this.current = tenths;
    this.label.setText(tenths === 15 ? '1.5x' : '1x');
  }

  private cycle(): void {
    const idx = this.available.indexOf(this.current);
    const next = this.available[(idx + 1) % this.available.length]!;
    this.setCurrent(next);
    this.onChange(next);
  }

  destroy(): void {
    this.bg.destroy();
    this.label.destroy();
  }
}
