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
  HEAL_VFX_FRAME_SIZE,
  HEAL_VFX_TEXTURE_KEY,
  HEAL_VFX_URL,
  TANK_TEXTURE_KEY,
  TANK_TEXTURE_URL,
  UNIT_ATTACK_ANIMS,
  attackAnimFrames,
  UNIT_FRAME_SIZE,
  UNIT_TEXTURE_KEY,
  UNIT_TEXTURE_URL,
} from '../ui/sprites';
import { RELIC_TEXTURE_IDS, relicTextureKey, relicTextureUrl } from '../ui/relicSprites';
import { initMusic, MUSIC_ASSET_KEY, MUSIC_URL } from '../ui/music';
import { fontsReady } from '../ui/theme';
import { allBattlefieldTextures } from '../ui/battlefield';
import { spellBarTextures } from '../ui/spellSprites';
import { panelKitTextures } from '../ui/panels';
import { portraitTextures } from '../ui/portraitSprites';
import { treeUiTextures } from '../ui/treeSockets';
import { fadeToScene } from '../ui/transitions';

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
    // PixelLab stills — single images, authored facing (no flipX at draw time).
    this.load.image(TANK_TEXTURE_KEY, TANK_TEXTURE_URL);
    this.load.image(DPS1_TEXTURE_KEY, DPS1_TEXTURE_URL);
    this.load.image(DPS2_TEXTURE_KEY, DPS2_TEXTURE_URL);
    this.load.image(ASH_HUSK_TEXTURE_KEY, ASH_HUSK_TEXTURE_URL);
    // PixelLab relic icons (64×64) — run-mod bar + RelicScene cards.
    for (const id of RELIC_TEXTURE_IDS) {
      this.load.image(relicTextureKey(id), relicTextureUrl(id));
    }
    // Per-dungeon combat battlefields (temp-art exception): backdrop
    // structure props + platform slice per variant, deduped across all 6
    // dungeon ids (chunk 8) — see ui/battlefield.ts.
    for (const texture of allBattlefieldTextures()) {
      this.load.image(texture.key, texture.url);
    }
    // Spell-bar/HUD framing kit + spell/cooldown icons (temp-art exception,
    // bible item 3) — see ui/spellSprites.ts.
    for (const texture of spellBarTextures()) {
      this.load.image(texture.key, texture.url);
    }
    // Meta-scene panel/button/banner kit (temp-art exception, bible item 4)
    // — Hub/Tutorial/Loadout/Relic/Settings + combat result overlay/wave
    // banner. See ui/panels.ts.
    for (const texture of panelKitTextures()) {
      this.load.image(texture.key, texture.url);
    }
    // FE-style bust portraits (temp-art exception, bible item 5) — banter
    // bubbles, tutorial, combat result panel. See ui/portraitSprites.ts.
    for (const texture of portraitTextures()) {
      this.load.image(texture.key, texture.url);
    }
    // Talent-tree node socket ring + edge-groove strip (temp-art exception,
    // bible item 7) — TreeScene. See ui/treeSockets.ts.
    for (const texture of treeUiTextures()) {
      this.load.image(texture.key, texture.url);
    }
    // Attack strips: one texture key per frame (not packed into Kenney).
    for (const def of UNIT_ATTACK_ANIMS) {
      for (let i = 0; i < def.frameCount; i++) {
        this.load.image(def.frameKey(i), def.frameUrl(i));
      }
    }
    // Looped background music (see ui/music.ts MUSIC_URL).
    this.load.audio(MUSIC_ASSET_KEY, MUSIC_URL);
  }

  create(): void {
    this.registerUnitAttackAnims();
    const save = loadSave();
    initMusic(this.game, save.musicVolumePct);
    // fontsReady (ui/theme.ts) started loading the pixel font as early as
    // the module graph linked — well before this preload/create pair ran —
    // so in practice this resolves immediately here; it only actually waits
    // on a slow/cold font load, and only up to its own 2s safety timeout.
    void fontsReady.then(() => {
      // Chunk 6 (bible item 6): fade instead of a hard cut — target scenes
      // fade back in via fadeInOnCreate() at the top of their own create().
      if (save.tutorialDone) {
        fadeToScene(this, SceneKeys.Hub);
      } else {
        fadeToScene(this, SceneKeys.Tutorial);
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
}
