import Phaser from 'phaser';
import { SceneKeys } from './keys';
import { loadSave } from '../save/save';
import { UNIT_FRAME_SIZE, UNIT_TEXTURE_KEY, UNIT_TEXTURE_URL } from '../ui/sprites';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  preload(): void {
    // Loaded once here; Phaser textures are global across scenes.
    this.load.spritesheet(UNIT_TEXTURE_KEY, UNIT_TEXTURE_URL, {
      frameWidth: UNIT_FRAME_SIZE,
      frameHeight: UNIT_FRAME_SIZE,
    });
  }

  create(): void {
    const save = loadSave();
    if (save.tutorialDone) {
      this.scene.start(SceneKeys.Hub);
    } else {
      this.scene.start(SceneKeys.Tutorial);
    }
  }
}
