import Phaser from 'phaser';
import { SceneKeys } from './keys';

/** Stub — Chunk 2 builds the facing-line combat view here, wired to src/combat. */
export class CombatScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Combat);
  }

  create(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, 'Combat scene (stub)', { fontSize: '16px', color: '#a89888' })
      .setOrigin(0.5);
  }
}
