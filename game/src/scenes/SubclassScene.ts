import Phaser from 'phaser';
import { SceneKeys } from './keys';

/** Stub — Chunk 4 builds the ruby subclass split (Vigil vs Zealot). */
export class SubclassScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Subclass);
  }

  create(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, 'Subclass scene (stub)', {
        fontSize: '16px',
        color: '#a89888',
      })
      .setOrigin(0.5);
  }
}
