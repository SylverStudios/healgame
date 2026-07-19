import Phaser from 'phaser';
import { SceneKeys } from './keys';
import { loadSave } from '../save/save';
import {
  HEALER_SHEET_FRAME_SIZE,
  HEALER_SHEET_TEXTURE_KEY,
  HEALER_SHEET_URL,
  HEAL_VFX_FRAME_SIZE,
  HEAL_VFX_TEXTURE_KEY,
  HEAL_VFX_URL,
  UNIT_FRAME_SIZE,
  UNIT_TEXTURE_KEY,
  UNIT_TEXTURE_URL,
} from '../ui/sprites';
import { initMusic, MUSIC_ASSET_KEY, MUSIC_URL } from '../ui/music';

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
    // v0.3 chunk F: healer caster sheet + heal-target sparkle (temp-art exception).
    this.load.spritesheet(HEALER_SHEET_TEXTURE_KEY, HEALER_SHEET_URL, {
      frameWidth: HEALER_SHEET_FRAME_SIZE,
      frameHeight: HEALER_SHEET_FRAME_SIZE,
    });
    this.load.spritesheet(HEAL_VFX_TEXTURE_KEY, HEAL_VFX_URL, {
      frameWidth: HEAL_VFX_FRAME_SIZE,
      frameHeight: HEAL_VFX_FRAME_SIZE,
    });
    // v0.3 chunk H: looped background music (placeholder asset; see ui/music.ts).
    this.load.audio(MUSIC_ASSET_KEY, MUSIC_URL);
  }

  create(): void {
    const save = loadSave();
    initMusic(this.game, save.musicVolumePct);
    if (save.tutorialDone) {
      this.scene.start(SceneKeys.Hub);
    } else {
      this.scene.start(SceneKeys.Tutorial);
    }
  }
}
