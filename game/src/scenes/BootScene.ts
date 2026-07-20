import Phaser from 'phaser';
import { SceneKeys } from './keys';
import { loadSave } from '../save/save';
import {
  ASH_HUSK_TEXTURE_KEY,
  ASH_HUSK_TEXTURE_URL,
  DPS1_TEXTURE_KEY,
  DPS1_TEXTURE_URL,
  DPS2_TEXTURE_KEY,
  DPS2_TEXTURE_URL,
  HEALER_SHEET_FRAME_SIZE,
  HEALER_SHEET_TEXTURE_KEY,
  HEALER_SHEET_URL,
  HEALER_STRIP_ANIMS,
  HEAL_VFX_FRAME_SIZE,
  HEAL_VFX_TEXTURE_KEY,
  HEAL_VFX_URL,
  TANK_TEXTURE_KEY,
  TANK_TEXTURE_URL,
  UNIT_ATTACK_ANIMS,
  UNIT_HURT_ANIMS,
  ZAP_VFX_FRAME_SIZE,
  ZAP_VFX_TEXTURE_KEY,
  ZAP_VFX_URL,
  attackAnimFrames,
  healerStripAnimFrames,
  hurtAnimFrames,
  UNIT_FRAME_SIZE,
  UNIT_TEXTURE_KEY,
  UNIT_TEXTURE_URL,
} from '../ui/sprites';
import { RELIC_TEXTURE_IDS, relicTextureKey, relicTextureUrl } from '../ui/relicSprites';
import { initMusic, MUSIC_ASSET_KEY, MUSIC_URL } from '../ui/music';
import { fontsReady } from '../ui/theme';

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
    // Healer strips (idle, zap, Solemn/Zealous charge+cast) — one texture key
    // per frame, like the merc attack strips (not packed into sheet.png).
    for (const def of HEALER_STRIP_ANIMS) {
      for (let i = 0; i < def.frameCount; i++) {
        this.load.image(def.frameKey(i), def.frameUrl(i));
      }
    }
    // Bonk impact VFX on the enemy target — mirrors heal-vfx wiring.
    this.load.spritesheet(ZAP_VFX_TEXTURE_KEY, ZAP_VFX_URL, {
      frameWidth: ZAP_VFX_FRAME_SIZE,
      frameHeight: ZAP_VFX_FRAME_SIZE,
    });
    // PixelLab stills — single images, authored facing (no flipX at draw time).
    this.load.image(TANK_TEXTURE_KEY, TANK_TEXTURE_URL);
    this.load.image(DPS1_TEXTURE_KEY, DPS1_TEXTURE_URL);
    this.load.image(DPS2_TEXTURE_KEY, DPS2_TEXTURE_URL);
    this.load.image(ASH_HUSK_TEXTURE_KEY, ASH_HUSK_TEXTURE_URL);
    // PixelLab relic icons (64×64) — run-mod bar + RelicScene cards.
    for (const id of RELIC_TEXTURE_IDS) {
      this.load.image(relicTextureKey(id), relicTextureUrl(id));
    }
    // Attack strips: one texture key per frame (not packed into Kenney).
    for (const def of UNIT_ATTACK_ANIMS) {
      for (let i = 0; i < def.frameCount; i++) {
        this.load.image(def.frameKey(i), def.frameUrl(i));
      }
    }
    // Hurt reaction strips: same per-frame texture loading as attack strips.
    for (const def of UNIT_HURT_ANIMS) {
      for (let i = 0; i < def.frameCount; i++) {
        this.load.image(def.frameKey(i), def.frameUrl(i));
      }
    }
    // Looped background music (see ui/music.ts MUSIC_URL).
    this.load.audio(MUSIC_ASSET_KEY, MUSIC_URL);
  }

  create(): void {
    this.registerUnitAttackAnims();
    this.registerUnitHurtAnims();
    this.registerHealerStripAnims();
    const save = loadSave();
    initMusic(this.game, save.musicVolumePct);
    // fontsReady (ui/theme.ts) started loading the pixel font as early as
    // the module graph linked — well before this preload/create pair ran —
    // so in practice this resolves immediately here; it only actually waits
    // on a slow/cold font load, and only up to its own 2s safety timeout.
    void fontsReady.then(() => {
      if (save.tutorialDone) {
        this.scene.start(SceneKeys.Hub);
      } else {
        this.scene.start(SceneKeys.Tutorial);
      }
    });
  }

  /** One-shot attack anims for PixelLab mercs — shared via the game AnimationManager. */
  private registerUnitAttackAnims(): void {
    for (const def of UNIT_ATTACK_ANIMS) {
      if (this.anims.exists(def.animKey)) continue;
      // Per-frame `duration` (FE exposure sheet) — not a uniform frameRate.
      this.anims.create({
        key: def.animKey,
        frames: [...attackAnimFrames(def)],
        repeat: 0,
      });
    }
  }

  /** One-shot hurt reaction anims for party mercs — mirrors registerUnitAttackAnims(). */
  private registerUnitHurtAnims(): void {
    for (const def of UNIT_HURT_ANIMS) {
      if (this.anims.exists(def.animKey)) continue;
      this.anims.create({
        key: def.animKey,
        frames: [...hurtAnimFrames(def)],
        repeat: 0,
      });
    }
  }

  /** Healer idle/charge loops (repeat: -1) + zap/cast one-shots (repeat: 0). */
  private registerHealerStripAnims(): void {
    for (const def of HEALER_STRIP_ANIMS) {
      if (this.anims.exists(def.animKey)) continue;
      this.anims.create({
        key: def.animKey,
        frames: [...healerStripAnimFrames(def)],
        repeat: def.loop ? -1 : 0,
      });
    }
  }
}
