import Phaser from 'phaser';
import { SceneKeys } from './keys';
import { loadSave } from '../save/save';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
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
