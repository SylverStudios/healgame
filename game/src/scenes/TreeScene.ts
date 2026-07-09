import Phaser from 'phaser';
import { SceneKeys } from './keys';

/** Stub — Chunk 3 builds the gold spell tree; Chunk 4 adds subclass branches. */
export class TreeScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Tree);
  }

  create(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, 'Spell tree scene (stub)', {
        fontSize: '16px',
        color: '#a89888',
      })
      .setOrigin(0.5);
  }
}
