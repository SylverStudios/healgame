import Phaser from 'phaser';
import { SceneKeys } from './keys';

/** Stub — Chunk 3 builds the hub (gold/XP/level/rubies, Enter Ash Gate, Tree, Restart). */
export class HubScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Hub);
  }

  create(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, 'Hub scene (stub)', { fontSize: '16px', color: '#a89888' })
      .setOrigin(0.5);
  }
}
