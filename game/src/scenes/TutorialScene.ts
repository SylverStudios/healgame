import Phaser from 'phaser';
import { SceneKeys } from './keys';

/** Stub — Chunk 3 builds the click-to-learn Solemn Mend tutorial here. */
export class TutorialScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Tutorial);
  }

  create(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2 - 20, 'healgame', { fontSize: '32px', color: '#e8d8c8' })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height / 2 + 20, 'Tutorial scene (stub)', {
        fontSize: '16px',
        color: '#a89888',
      })
      .setOrigin(0.5);
  }
}
