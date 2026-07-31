/**
 * A single combat unit rendered as a Tiny Dungeon tile (see ui/sprites.ts)
 * + name label + HP bar (+ mana bar for the healer) + optional heal-target
 * sky beam (gold ring high above with light fading before the sprite).
 * Bars/labels keep the temp-art style (flat bars, pixel-font labels, dark
 * palette); the unit body is a 16×16 pixel-art frame scaled up with
 * nearest-neighbor filtering (`pixelArt: true` in main.ts).
 *
 * Chunk 2 (phase-2-handoff): all visuals live inside a Phaser Container
 * anchored at the unit's fixed "home" position, so a single tween on the
 * container can lunge the whole unit toward its target and back without ever
 * drifting from its resting spot. Damage floats (`-N`) and heal floats
 * (`+N`) are independent, short-lived objects positioned at the home
 * coordinates — they never move with the container so they read correctly
 * even on a unit that both attacks and is hit in the same tick.
 */

import Phaser from 'phaser';
import type { Unit } from '../combat/types';
import { Bar } from './bar';
import {
  drawBossFocusReticle,
  FOCUS_RETICLE_MIN_ALPHA,
  FOCUS_RETICLE_PULSE_MS,
} from './bossFocusReticle';
import { UNIT_TEXTURE_KEY } from './sprites';
import { damageFloatSpawnOffsetY, damageFloatXOffset } from './hitFxLayout';
import { drawTargetSkyBeam, skyBeamLayout } from './targetSkyBeam';
import { FONT, FONT_SIZE_XS, FONT_SIZE_SM, FONT_SIZE_MD, FONT_SIZE_LG } from './theme';

/** Lerp between two 0xRRGGBB colors at `t` in [0, 1] — used by boss telegraph tint cues. */
function interpolateColor(fromHex: number, toHex: number, t: number): number {
  const result = Phaser.Display.Color.Interpolate.ColorWithColor(
    Phaser.Display.Color.ValueToColor(fromHex),
    Phaser.Display.Color.ValueToColor(toHex),
    100,
    Math.round(Phaser.Math.Clamp(t, 0, 1) * 100),
  );
  return Phaser.Display.Color.GetColor(result.r, result.g, result.b);
}

const HP_BAR_HEIGHT = 8;
const HP_BAR_OFFSET_Y = 10;
const MANA_BAR_HEIGHT = 6;
const MANA_BAR_GAP = 4;
const HP_TEXT_GAP = 2;
/** Room reserved for the HP number line so the mana bar stacks above it. */
const HP_TEXT_HEIGHT = 14;
/**
 * Cap meter width so neighboring party bars stay readable. Party slot centers
 * are ~100px apart at the current layout; body display can be wider (112).
 */
const METER_MAX_WIDTH = 72;

const HP_FILL_COLOR = 0x4caf50;
const MANA_FILL_COLOR = 0x3b82f6;
const DEAD_TINT = 0x3a3a3a;
const DEAD_ALPHA = 0.4;
const DEAD_SCALE = 0.85;
/** v0.3 §Coyote: downed-but-savable (dying) — urgent red, still fully targetable. */
const DYING_TINT = 0xcc4433;

const NAME_FONT_SIZE = FONT_SIZE_SM;
const NAME_COLOR = '#d8c8b8';
/** XS (8px), not the SM snap: HP_TEXT_HEIGHT below reserves exactly 14px for
 *  this line before the mana bar starts — a 16px line would encroach on it. */
const HP_FONT_SIZE = FONT_SIZE_XS;
const HP_COLOR = '#e8d8c8';

const DAMAGE_FLASH_COLOR = 0xff3b30;
const HEAL_FLASH_COLOR = 0x3ce06a;
const CAST_FLASH_COLOR = 0xf2c14e;
const FLASH_DURATION_MS = 180;

/** Locked visual decisions (phase-2-handoff): lunge 12px, out 90ms / back 120ms.
 *  Used by Kenney enemies / boss / healer — PixelLab party mercs play attack strips in place. */
const LUNGE_DISTANCE = 12;
const LUNGE_OUT_MS = 90;
const LUNGE_BACK_MS = 120;

/** v0.3 chunk F: boss telegraph cues (bossCastStarted → bossCastFinished window). */
const TELEGRAPH_GLOW_COLOR = 0xff8a3d;
const TELEGRAPH_RAISE_COLOR = 0xfff2c0;
const TELEGRAPH_GLOW_DURATION_MS = 420;
const TELEGRAPH_RAISE_DURATION_MS = 420;
const TELEGRAPH_PULSE_DURATION_MS = 260;
const TELEGRAPH_GLOW_SCALE = 0.05;
const TELEGRAPH_PULSE_SCALE = 0.12;
const TELEGRAPH_RAISE_PX = 8;

/** v0.3 chunk F: mana-regen tick juice — brief bar flash + a mote drifting up off it. */
const MANA_PULSE_COLOR = 0xbfe0ff;
const MANA_PULSE_ALPHA = 0.55;
const MANA_PULSE_DURATION_MS = 260;
const MANA_MOTE_COLOR = 0x8fc4ff;
const MANA_MOTE_RISE_DISTANCE = 22;
const MANA_MOTE_DURATION_MS = 520;

/** `-N` damage floats: modest rise + fade (tuned post–Phase 3 for readability).
 *  Wave 6 / R2: spawned near the top of the body (below the HP bar) with a short
 *  rise so the number stays in the gap under the bar rather than crossing it. */
const DAMAGE_FLOAT_RISE_DISTANCE = 12;
const DAMAGE_FLOAT_DURATION_MS = 550;
/** `+N` heal floats linger longer so the basic heal reads as satisfying juice. */
const HEAL_FLOAT_RISE_DISTANCE = 36;
const HEAL_FLOAT_DURATION_MS = 980;
const FLOAT_DEPTH = 50;

/**
 * Map heal/damage amount → float font size (handoff §L), snapped to the
 * pixel font's density tiers. The original scale had 5 distinct steps
 * (18/20/24/28/32); snapping collapses the middle and top pairs to 3 steps
 * (16/24/32) since 20≈24 and 28≈32 both round to the same bucket — still
 * monotonic, still reads as "small hit vs big hit."
 */
function floatFontPx(amount: number): string {
  const a = Math.abs(amount);
  if (a <= 1) return FONT_SIZE_SM;
  if (a <= 4) return FONT_SIZE_MD;
  return FONT_SIZE_LG;
}

const DAMAGE_FLOAT_COLOR = '#e05a4e';
/** Brighter mint so heal numbers pop against the ash background. */
const HEAL_FLOAT_COLOR = '#5dff7a';
const FLOAT_STROKE_COLOR = '#0a0605';
const FLOAT_STROKE_WIDTH = 3;

export interface UnitSpriteConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Tile/frame index into `bodyTextureKey` — see ui/sprites.ts frameForUnit().
   *  Omit (or pass 0) for single-image custom textures that have no frame index. */
  frame?: number;
  /** Texture key for the body sprite; defaults to the shared Kenney sheet (UNIT_TEXTURE_KEY)
   *  when omitted. Custom stills (PixelLab mercs / ash-husk) and the ragged healer sheet
   *  pass their own keys. */
  bodyTextureKey?: string;
  /** When true, the texture is already authored facing the correct combat direction
   *  (party east / husk west) — do not apply the Kenney side flipX. */
  fixedFacing?: boolean;
  /** Phaser anim key for a one-shot PixelLab attack strip (registered in BootScene). */
  attackAnimKey?: string;
  /** Phaser anim key for a one-shot hurt reaction strip (registered in BootScene). */
  hurtAnimKey?: string;
  /**
   * Healer-only (chunk 1B): continuous breathing loop (Phaser anim, `repeat: -1`)
   * played whenever not charging/casting/zapping. Restored after any one-shot
   * strip (cast-action or zap) completes instead of a static idle frame.
   */
  idleAnimKey?: string;
  /** Healer-only: one-shot Bonk zap strip (registered in BootScene). Played via `playZap()`. */
  zapAnimKey?: string;
  /** Healer-only: one-shot Vowstrike attack strip. Played via `playVowstrike()`. */
  vowstrikeAnimKey?: string;
  /**
   * Extra body Y in container space. PixelLab canvases pad ~25% below the painted
   * feet — shift the sprite down so feet meet the ground line after setDisplaySize.
   */
  bodyOffsetY?: number;
  /**
   * Healer cast pipeline: Solemn/Zealous charge loops while channeling;
   * cast-action plays once on release (or as the instant flourish).
   */
  casterAnim?: {
    styles: Record<'solemn' | 'zealous', { chargeAnimKey: string; castAnimKey: string }>;
  };
  showMana: boolean;
  /** When false, omit the role/name overlay (party sprites). Defaults to true. */
  showName?: boolean;
  clickable: boolean;
  onClick?: (unitId: string) => void;
  /** Side-view facing line (side-view-layout-handoff §A): party faces right, enemies face
   *  left. Kenney Tiny Dungeon tiles are front-facing portraits (no true native direction),
   *  so this is a stopgap flipX applied per side, not a correction of an inherent facing.
   *  Ignored when `fixedFacing` is set. */
  facing: 'left' | 'right';
}

/** Pixel-art tile for one combat unit, with bars/labels/marker layered above it. */
export class UnitSprite {
  readonly id: string;

  private readonly scene: Phaser.Scene;
  private readonly homeX: number;
  private readonly homeY: number;
  private readonly width: number;
  private readonly height: number;
  /** HP/mana bar width — capped below body width so party meters don't overlap. */
  private readonly meterWidth: number;

  private readonly container: Phaser.GameObjects.Container;
  /** Sprite (not Image) so PixelLab attack strips can `play()` multi-texture anims. */
  private readonly body: Phaser.GameObjects.Sprite;
  /** Rest texture shown when an attack anim is not playing. */
  private readonly restTextureKey: string;
  /** Rest sheet frame for Kenney / healer; undefined for single-image stills. */
  private readonly restFrame: number | undefined;
  private readonly attackAnimKey: string | null;
  /** One-shot hurt reaction strip key; null for units without one (see `hurtAnimKey` config). */
  private readonly hurtAnimKey: string | null;
  /** Healer-only continuous idle loop key; null for every other unit (see `idleAnimKey` config). */
  private readonly idleAnimKey: string | null;
  /** Healer-only Bonk zap strip key; null for every other unit. */
  private readonly zapAnimKey: string | null;
  /** Healer-only Vowstrike attack strip key; null for every other unit. */
  private readonly vowstrikeAnimKey: string | null;
  /** Resting local Y for the body (PixelLab foot-pad offset); telegraph raise adds on top. */
  private readonly bodyRestY: number;
  private readonly nameText: Phaser.GameObjects.Text | null;
  private readonly hpBar: Bar;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly manaBar: Bar | null;
  private readonly manaText: Phaser.GameObjects.Text | null;
  /** Gold sky-beam heal-target cue (ring high above; shaft behind meters). */
  private readonly targetSkyBeam: Phaser.GameObjects.Graphics;
  /** Giant crimson reticle + beady eyes while a boss focus channel targets this unit. */
  private readonly bossFocusMarker: Phaser.GameObjects.Graphics;

  /** Standalone floating texts (hit markers / heal floats) not parented to the container. */
  private readonly activeFloats = new Set<Phaser.GameObjects.Text>();

  private alive = true;

  /** Healer cast pipeline config; null for every other unit. */
  private readonly casterAnim: NonNullable<UnitSpriteConfig['casterAnim']> | null;
  private castStyle: 'solemn' | 'zealous' = 'solemn';
  private charging = false;
  private releaseActive = false;
  /** Queued next cast arrived during cast-action — start charge when release ends. */
  private pendingCharge = false;
  private readonly castAnimKeys: ReadonlySet<string>;
  private readonly chargeAnimKeys: ReadonlySet<string>;

  /** Local (container-space) Y of the mana bar, when present — used to place the regen pulse. */
  private readonly manaBarY: number | null;

  /** v0.3 chunk F: boss telegraph state — a repeating tween drives tint/scale/offset each tick. */
  private telegraphActive = false;
  private telegraphTween: Phaser.Tweens.Tween | null = null;
  /** Hit/cast juice owns body tint briefly — syncFromUnit must not clearTint mid-flash. */
  private flashActive = false;
  private flashTween: Phaser.Tweens.Tween | null = null;

  constructor(unit: Unit, config: UnitSpriteConfig) {
    const { scene, x, y, width, height, showMana, clickable, onClick, facing } = config;
    this.id = unit.id;
    this.scene = scene;
    this.homeX = x;
    this.homeY = y;
    this.width = width;
    this.height = height;
    this.meterWidth = Math.min(width, METER_MAX_WIDTH);
    this.casterAnim = config.casterAnim ?? null;
    const styleEntries = this.casterAnim ? Object.values(this.casterAnim.styles) : [];
    this.castAnimKeys = new Set(styleEntries.map((s) => s.castAnimKey));
    this.chargeAnimKeys = new Set(styleEntries.map((s) => s.chargeAnimKey));

    this.container = scene.add.container(x, y);

    // All children below use coordinates LOCAL to the container (relative to
    // the unit's home position, i.e. as if x=y=0).
    const textureKey = config.bodyTextureKey ?? UNIT_TEXTURE_KEY;
    this.restTextureKey = textureKey;
    this.restFrame = config.frame;
    this.attackAnimKey = config.attackAnimKey ?? null;
    this.hurtAnimKey = config.hurtAnimKey ?? null;
    this.idleAnimKey = config.idleAnimKey ?? null;
    this.zapAnimKey = config.zapAnimKey ?? null;
    this.vowstrikeAnimKey = config.vowstrikeAnimKey ?? null;
    this.bodyRestY = config.bodyOffsetY ?? 0;
    const bodySprite =
      config.frame === undefined
        ? scene.add.sprite(0, this.bodyRestY, textureKey)
        : scene.add.sprite(0, this.bodyRestY, textureKey, config.frame);
    this.body = bodySprite
      .setDisplaySize(width, height)
      .setFlipX(!config.fixedFacing && facing === 'left');
    // Attack strips swap textures each frame — keep display size pinned.
    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, () => {
      this.body.setDisplaySize(this.width, this.height);
    });
    this.body.on(
      Phaser.Animations.Events.ANIMATION_COMPLETE,
      (animation: Phaser.Animations.Animation) => {
        const key = animation.key;
        if (this.castAnimKeys.has(key)) {
          this.releaseActive = false;
          this.finishBodyOneShot();
          return;
        }
        // Charge loops never complete (repeat: -1). Zap / attack / other one-shots → idle
        // (or a cast that queued during the one-shot via pendingCharge).
        if (this.chargeAnimKeys.has(key)) return;
        this.finishBodyOneShot();
      },
    );
    // Cast-action interrupted by zap/vowstrike (or anything else) fires STOP, not
    // COMPLETE — without this, releaseActive stays true and every later charge/cast
    // is deferred forever (setCasting → pendingCharge; finishCast early-returns).
    this.body.on(
      Phaser.Animations.Events.ANIMATION_STOP,
      (animation: Phaser.Animations.Animation) => {
        if (animation?.key && this.castAnimKeys.has(animation.key)) {
          this.releaseActive = false;
        }
      },
    );
    if (clickable) {
      // Hit area is the full frame bounds (including transparent pixels) —
      // same clickable box the old rect gave, so journey.mjs targets hold.
      this.body.setInteractive({ useHandCursor: true });
      this.body.setName(`combatAlly:${this.id}`);
      this.body.on('pointerdown', () => {
        if (this.alive) onClick?.(this.id);
      });
    }
    this.container.add(this.body);

    // Name stays centered on the body (including PixelLab foot-pad offset).
    // Party omits names — roles are clear from sprites; enemies keep labels.
    if (config.showName === false) {
      this.nameText = null;
    } else {
      this.nameText = scene.add
        .text(0, this.bodyRestY, unit.name, { fontFamily: FONT, fontSize: NAME_FONT_SIZE, color: NAME_COLOR })
        .setStroke('#0a0605', 3)
        .setOrigin(0.5)
        .setDepth(1);
      this.container.add(this.nameText);
    }

    const hpY = -height / 2 - HP_BAR_OFFSET_Y;
    const crownY = this.bodyRestY - height / 2;

    // Wave 4b / J13: sky-beam heal-target cue. Added BEFORE HP/mana so meters
    // stay on top; shaft fades out before the sprite crown (never paints body).
    // Distinct from the crimson boss-focus reticle added last below.
    const beamLayout = skyBeamLayout({ hpBarY: hpY, crownY, bodyWidth: width });
    this.targetSkyBeam = scene.add.graphics().setVisible(false);
    drawTargetSkyBeam(this.targetSkyBeam, beamLayout);
    this.container.add(this.targetSkyBeam);

    const meterHalf = this.meterWidth / 2;
    this.hpBar = new Bar(scene, -meterHalf, hpY, this.meterWidth, HP_BAR_HEIGHT, HP_FILL_COLOR);
    this.hpBar.addToContainer(this.container);
    this.hpText = scene.add
      .text(0, hpY - HP_BAR_HEIGHT / 2 - HP_TEXT_GAP, '', { fontFamily: FONT, fontSize: HP_FONT_SIZE, color: HP_COLOR })
      .setOrigin(0.5, 1);
    this.container.add(this.hpText);

    if (showMana) {
      const manaY = hpY - HP_BAR_HEIGHT / 2 - HP_TEXT_HEIGHT - MANA_BAR_GAP - MANA_BAR_HEIGHT / 2;
      this.manaBar = new Bar(scene, -meterHalf, manaY, this.meterWidth, MANA_BAR_HEIGHT, MANA_FILL_COLOR);
      this.manaBar.addToContainer(this.container);
      this.manaText = scene.add
        .text(0, manaY - MANA_BAR_HEIGHT / 2 - HP_TEXT_GAP, '', {
          fontFamily: FONT,
          fontSize: HP_FONT_SIZE,
          color: '#a8c8f0',
        })
        .setOrigin(0.5, 1);
      this.container.add(this.manaText);
      this.manaBarY = manaY;
    } else {
      this.manaBar = null;
      this.manaText = null;
      this.manaBarY = null;
    }

    // Wave 3 / PR2 2B: giant reticle + beady eyes centered on the ally body.
    // Distinct from the gold sky-beam heal-target cue. Added last so danger sits on top.
    this.bossFocusMarker = scene.add.graphics().setPosition(0, this.bodyRestY).setVisible(false);
    drawBossFocusReticle(this.bossFocusMarker);
    this.container.add(this.bossFocusMarker);

    // Healer breathing loop starts immediately at rest; charge/cast/zap stop it
    // and restore it on completion (see restoreRestPose / returnToIdle below).
    if (this.idleAnimKey) {
      this.body.play(this.idleAnimKey, true);
      this.body.setDisplaySize(this.width, this.height);
    }

    this.update(unit);
  }

  /** Sync visuals to the latest engine unit snapshot. Cheap — call every frame. */
  update(unit: Unit): void {
    this.alive = unit.alive;
    this.hpBar.setRatio(unit.maxHp > 0 ? unit.hp / unit.maxHp : 0);
    this.hpText.setText(`${Math.max(0, Math.ceil(unit.hp))}/${unit.maxHp}`);
    if (this.manaBar && this.manaText) {
      this.manaBar.setRatio(unit.maxMana > 0 ? unit.mana / unit.maxMana : 0);
      this.manaText.setText(`${Math.max(0, Math.ceil(unit.mana))}/${unit.maxMana}`);
    }

    if (unit.alive) {
      // v0.3 chunk F: a boss telegraph tween owns tint/scale each tick while active — letting
      // this branch also clearTint()/setDisplaySize() every frame would fight it (both run once
      // per game step) and cause flicker, so skip while telegraphing; stopTelegraph() restores
      // the plain look once the window ends.
      if (!this.telegraphActive) {
        // v0.3 §Coyote: a dying unit is downed but savable — death visuals (tint/shrink below)
        // wait for true death (`alive` flipping), which the engine defers past the grace window.
        if (unit.dying) this.body.setTint(DYING_TINT);
        else if (!this.flashActive) this.body.clearTint();
        this.body.setAlpha(1);
        // setDisplaySize (not setScale) — the image is already scaled up from its 16×16 source
        // frame, so raw scale values would shrink it to tile size.
        this.body.setDisplaySize(this.width, this.height);
      }
      this.hpBar.setVisible(true);
      this.manaBar?.setVisible(true);
    } else {
      this.stopTelegraph();
      this.clearFlash();
      this.pendingCharge = false;
      this.stopChargeCycle();
      this.releaseActive = false;
      this.stopAttackAnim();
      if (this.idleAnimKey) this.body.stop();
      this.scene.tweens.killTweensOf(this.body);
      this.body.setTint(DEAD_TINT);
      this.body.setAlpha(DEAD_ALPHA);
      this.body.setDisplaySize(this.width * DEAD_SCALE, this.height * DEAD_SCALE);
      this.hpBar.setVisible(false);
      this.manaBar?.setVisible(false);
      this.targetSkyBeam.setVisible(false);
      // Engine ends the channel on target death (bossFocusEnded), but hide
      // defensively so a dead unit never wears the brand for a frame.
      this.setBossFocused(false);
    }
  }

  setTargeted(isTargeted: boolean): void {
    const show = isTargeted && this.alive;
    this.targetSkyBeam.setVisible(show);
    if (show) {
      // Sky beam stays behind meters (insertion order) — do not bringToTop.
      // If boss focus is also on, keep crimson danger on top; both cues remain
      // visible and distinct (gold sky light vs crimson reticle).
      if (this.bossFocusMarker.visible) {
        this.container.bringToTop(this.bossFocusMarker);
      }
    }
  }

  /** Show/hide the giant boss-focus reticle + eyes (Tunnel Vision channel), with a slow alpha pulse. */
  setBossFocused(isFocused: boolean): void {
    this.scene.tweens.killTweensOf(this.bossFocusMarker);
    this.bossFocusMarker.setAlpha(1);
    const show = isFocused && this.alive;
    this.bossFocusMarker.setVisible(show);
    if (show) {
      this.container.bringToTop(this.bossFocusMarker);
      this.scene.tweens.add({
        targets: this.bossFocusMarker,
        alpha: FOCUS_RETICLE_MIN_ALPHA,
        duration: FOCUS_RETICLE_PULSE_MS,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  /** Fixed home-position X, used by the scene to compute lunge direction between two sprites. */
  getHomeX(): number {
    return this.homeX;
  }

  getHomeY(): number {
    return this.homeY;
  }

  /**
   * Lunge the whole unit ~12px toward `towardX` and back (locked motion:
   * out 90ms / back 120ms). Safe to call repeatedly in the same tick (e.g. a
   * party-wide boss hit doesn't touch this — only the attacker lunges, but a
   * merc could plausibly re-lunge before its previous lunge settles): any
   * in-flight lunge tween is killed and the container snapped back to its
   * home X before starting the new one, so offsets never stack and the unit
   * always ends at rest exactly at home.
   */
  lunge(towardX: number): void {
    const direction = Math.sign(towardX - this.homeX) || 1;
    this.scene.tweens.killTweensOf(this.container);
    this.container.x = this.homeX;
    this.scene.tweens.add({
      targets: this.container,
      x: this.homeX + direction * LUNGE_DISTANCE,
      duration: LUNGE_OUT_MS,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: this.container,
          x: this.homeX,
          duration: LUNGE_BACK_MS,
          ease: 'Quad.easeIn',
        });
      },
    });
  }

  /**
   * Spawns a `-N` float for a `damage` event on this unit. Always shown —
   * including 0 and overkill raw amounts (handoff §A: no clamping to remaining
   * HP). Wave 6 / R2: floats spawn near the top of the body (below the HP bar)
   * and slightly off-center in X (presentation-only `Math.random`) so they read
   * as "the enemy took a hit" without colliding with the centered hurt VFX
   * burst. Float depth (50) sits above the arrow/zap impact (49).
   */
  spawnDamageFloat(amount: number): void {
    const startX = this.homeX + damageFloatXOffset(Math.random());
    const startY = this.homeY + damageFloatSpawnOffsetY(this.height);
    this.spawnFloatTextAt(
      `-${amount}`,
      DAMAGE_FLOAT_COLOR,
      floatFontPx(amount),
      startX,
      startY,
      DAMAGE_FLOAT_RISE_DISTANCE,
      DAMAGE_FLOAT_DURATION_MS,
    );
  }

  /** Spawns a `+N` float for the full heal cast (applied + overheal). */
  spawnHealFloat(amount: number): void {
    if (amount <= 0) return;
    this.spawnFloatText(
      `+${amount}`,
      HEAL_FLOAT_COLOR,
      floatFontPx(amount),
      HEAL_FLOAT_RISE_DISTANCE,
      HEAL_FLOAT_DURATION_MS,
    );
  }

  /** Heal floats keep spawning at the unit's home center; damage floats override
   *  the start position (see `spawnDamageFloat`) via `spawnFloatTextAt`. */
  private spawnFloatText(
    text: string,
    color: string,
    fontSize: string,
    riseDistance: number,
    durationMs: number,
  ): void {
    this.spawnFloatTextAt(text, color, fontSize, this.homeX, this.homeY, riseDistance, durationMs);
  }

  private spawnFloatTextAt(
    text: string,
    color: string,
    fontSize: string,
    startX: number,
    startY: number,
    riseDistance: number,
    durationMs: number,
  ): void {
    const obj = this.scene.add
      .text(startX, startY, text, { fontFamily: FONT, fontSize, color })
      .setStroke(FLOAT_STROKE_COLOR, FLOAT_STROKE_WIDTH)
      .setOrigin(0.5)
      .setDepth(FLOAT_DEPTH);
    this.activeFloats.add(obj);
    this.scene.tweens.add({
      targets: obj,
      y: startY - riseDistance,
      alpha: 0,
      duration: durationMs,
      onComplete: () => {
        this.activeFloats.delete(obj);
        obj.destroy();
      },
    });
  }

  /**
   * Play the PixelLab attack strip if one is wired for this unit. Rest pose is
   * restored on ANIMATION_COMPLETE (see constructor). Safe no-op for Kenney /
   * healer bodies. Restarting mid-swing replaces the in-flight strip so rapid
   * autos never stack listeners.
   */
  playAttack(): void {
    if (!this.attackAnimKey || !this.alive || !this.body.anims) return;
    // Restart if already mid-swing so rapid autos replace the strip instead of
    // being ignored (Phaser's ignoreIfPlaying=true would skip the new play).
    this.body.play(this.attackAnimKey, false);
    this.body.setDisplaySize(this.width, this.height);
  }

  /**
   * Play the hurt reaction strip if one is wired for this unit. Rest pose is
   * restored on ANIMATION_COMPLETE (see constructor). Safe no-op for units
   * without one. Mirrors `playAttack()` — either call simply restarts
   * whichever body anim was playing, so no explicit priority is needed.
   * Also no-ops if the body was destroyed (e.g. delayed arrow-hit contact
   * after a wave rebuild).
   */
  playHurt(): void {
    if (!this.hurtAnimKey || !this.alive || !this.body.anims) return;
    this.body.play(this.hurtAnimKey, false);
    this.body.setDisplaySize(this.width, this.height);
  }

  /**
   * Healer-only one-shot Bonk zap strip. Locked decision: Bonk and only Bonk
   * plays this — CombatScene's castStarted handler selects it by spell id.
   * Rest pose (idle loop) is restored on ANIMATION_COMPLETE, same as playAttack().
   */
  playZap(): void {
    if (!this.zapAnimKey || !this.alive) return;
    this.beginInstantAttackBody();
    this.body.play(this.zapAnimKey, false);
    this.body.setDisplaySize(this.width, this.height);
  }

  /** Healer-only Vowstrike oath-strike (both aspects). Snaps to idle on complete. */
  playVowstrike(): void {
    if (!this.vowstrikeAnimKey || !this.alive) return;
    this.beginInstantAttackBody();
    this.body.play(this.vowstrikeAnimKey, false);
    this.body.setDisplaySize(this.width, this.height);
  }

  /**
   * Instant damage strips may replace a live cast-action. Clear the release lock
   * up front so a STOP (not COMPLETE) on the cast strip can't leave charge/cast
   * gated forever. pendingCharge is kept — honored when this one-shot completes.
   */
  private beginInstantAttackBody(): void {
    this.releaseActive = false;
    this.stopChargeCycle();
  }

  /** After any healer one-shot: resume a queued channel, else breathing idle. */
  private finishBodyOneShot(): void {
    if (this.pendingCharge) {
      this.startChargeCycle();
    } else {
      this.restoreRestPose();
    }
  }

  private isInstantAttackPlaying(): boolean {
    const key = this.body.anims.currentAnim?.key;
    return key === this.zapAnimKey || key === this.vowstrikeAnimKey;
  }

  private restoreRestPose(): void {
    if (this.idleAnimKey) {
      this.body.play(this.idleAnimKey, true);
    } else if (this.restFrame === undefined) {
      this.body.setTexture(this.restTextureKey);
    } else {
      this.body.setTexture(this.restTextureKey, this.restFrame);
    }
    this.body.setDisplaySize(this.width, this.height);
  }

  private stopAttackAnim(): void {
    if (!this.attackAnimKey) return;
    this.body.stop();
    this.restoreRestPose();
  }

  /** Brief ember flash when the healer begins a cast (handoff §N). */
  flashCast(): void {
    this.flash(CAST_FLASH_COLOR);
  }

  /** Brief red flash for a damage event on this unit. */
  flashDamage(): void {
    this.flash(DAMAGE_FLASH_COLOR);
  }

  /** Brief green flash for a heal event on this unit. */
  flashHeal(): void {
    this.flash(HEAL_FLASH_COLOR);
  }

  /**
   * Tint only opaque body pixels — never a full-box rectangle (that reads as a
   * yellow/red/green square around transparent sprite padding).
   */
  private flash(color: number): void {
    if (this.telegraphActive) return;
    this.flashTween?.remove();
    this.flashActive = true;
    this.body.setTint(color);
    const proxy = { t: 1 };
    this.flashTween = this.scene.tweens.add({
      targets: proxy,
      t: 0,
      duration: FLASH_DURATION_MS,
      onComplete: () => {
        this.flashTween = null;
        this.flashActive = false;
        if (!this.telegraphActive) this.body.clearTint();
      },
    });
  }

  private clearFlash(): void {
    this.flashTween?.remove();
    this.flashTween = null;
    this.flashActive = false;
  }

  // ---- Healer charge / cast-action (no-op without casterAnim) ----------------------------

  /** Select Solemn vs Zealous body language before starting a cast. */
  setCastStyle(style: 'solemn' | 'zealous'): void {
    this.castStyle = style;
  }

  /**
   * Start/stop the charge loop for a channeled cast. Stopping alone returns to
   * idle (cancel path — tween/snap via idle loop; no dedicated cancel strip).
   * If a cast-action is still playing (queued spell fired same tick as finish),
   * charge is deferred until the release completes — never clip contact.
   */
  setCasting(active: boolean): void {
    if (!this.casterAnim) return;
    if (active) {
      if (this.releaseActive) {
        this.pendingCharge = true;
        return;
      }
      this.pendingCharge = false;
      this.startChargeCycle();
    } else {
      this.pendingCharge = false;
      this.stopChargeCycle();
      if (!this.releaseActive) this.restoreRestPose();
    }
  }

  /**
   * One-shot cast-action strip (charge-key → release climax). Used for instant
   * casts on start, early lead-in before cast end, and `finishCast()`.
   */
  playCastRelease(): void {
    if (!this.casterAnim || this.releaseActive) return;
    this.stopChargeCycle();
    const { castAnimKey } = this.casterAnim.styles[this.castStyle];
    this.releaseActive = true;
    this.body.play(castAnimKey, false);
    this.body.setDisplaySize(this.width, this.height);
  }

  /**
   * Begin cast-action before `castFinished` so contact lands near the heal
   * resolve. No-op unless currently charging (avoids double-start).
   */
  beginEarlyCastRelease(): void {
    if (!this.casterAnim || this.releaseActive || !this.charging) return;
    this.playCastRelease();
  }

  /**
   * Successful cast end: play the cast-action if we were still charging. No-op
   * when early release, an instant already started the strip, or a Bonk /
   * Vowstrike attack strip is up.
   */
  finishCast(): void {
    if (!this.casterAnim) return;
    if (this.releaseActive) return;
    if (this.isInstantAttackPlaying()) return;
    if (this.charging) {
      this.playCastRelease();
      return;
    }
    this.restoreRestPose();
  }

  /** Instant-cast alias — same cast-action strip as a successful channel finish. */
  playCastFlourish(): void {
    this.playCastRelease();
  }

  private startChargeCycle(): void {
    if (!this.casterAnim || this.charging) return;
    this.pendingCharge = false;
    this.charging = true;
    const { chargeAnimKey } = this.casterAnim.styles[this.castStyle];
    this.body.play(chargeAnimKey, true);
    this.body.setDisplaySize(this.width, this.height);
  }

  private stopChargeCycle(): void {
    if (!this.charging) return;
    this.charging = false;
    const key = this.body.anims.currentAnim?.key;
    if (key && this.chargeAnimKeys.has(key)) {
      this.body.stop();
    }
  }

  // ---- v0.3 chunk F: boss telegraph (bossCastStarted → bossCastFinished window) ---------

  /**
   * Begin a data-driven telegraph cue on this unit's body. A single repeating
   * tween drives a 0..1 proxy that `applyTelegraphFrame` maps to tint/scale/
   * offset each tick — `update()` skips its own tint/size writes while this
   * is active (see the `telegraphActive` guard there) so the two never fight.
   */
  startTelegraph(cue: 'glow' | 'raise' | 'pulse'): void {
    this.stopTelegraph();
    this.telegraphActive = true;
    const proxy = { t: 0 };
    const duration =
      cue === 'pulse'
        ? TELEGRAPH_PULSE_DURATION_MS
        : cue === 'raise'
          ? TELEGRAPH_RAISE_DURATION_MS
          : TELEGRAPH_GLOW_DURATION_MS;
    this.telegraphTween = this.scene.tweens.add({
      targets: proxy,
      t: 1,
      duration,
      yoyo: true,
      repeat: -1,
      ease: cue === 'pulse' ? 'Quad.easeOut' : 'Sine.easeInOut',
      onUpdate: () => this.applyTelegraphFrame(cue, proxy.t),
    });
  }

  private applyTelegraphFrame(cue: 'glow' | 'raise' | 'pulse', t: number): void {
    switch (cue) {
      case 'glow': {
        this.body.setTint(interpolateColor(0xffffff, TELEGRAPH_GLOW_COLOR, t));
        const scale = 1 + t * TELEGRAPH_GLOW_SCALE;
        this.body.setDisplaySize(this.width * scale, this.height * scale);
        break;
      }
      case 'raise': {
        this.body.setY(this.bodyRestY - t * TELEGRAPH_RAISE_PX);
        this.body.setTint(interpolateColor(0xffffff, TELEGRAPH_RAISE_COLOR, t));
        break;
      }
      case 'pulse': {
        const scale = 1 + t * TELEGRAPH_PULSE_SCALE;
        this.body.setDisplaySize(this.width * scale, this.height * scale);
        break;
      }
    }
  }

  /** Ends the telegraph and restores the plain look; safe to call when no telegraph is active. */
  stopTelegraph(): void {
    this.telegraphTween?.remove();
    this.telegraphTween = null;
    if (!this.telegraphActive) return;
    this.telegraphActive = false;
    this.body.setY(this.bodyRestY);
    this.body.clearTint();
    this.body.setDisplaySize(this.width, this.height);
  }

  // ---- v0.3 chunk F: mana-regen tick juice -----------------------------------------------

  /** Brief bright flash across the mana bar + a small mote drifting up off it (no-op if no mana bar). */
  pulseMana(): void {
    if (!this.manaBar || this.manaBarY === null) return;
    const worldY = this.homeY + this.manaBarY;
    const overlay = this.scene.add
      .rectangle(this.homeX, worldY, this.meterWidth, MANA_BAR_HEIGHT, MANA_PULSE_COLOR, MANA_PULSE_ALPHA)
      .setDepth(12);
    this.scene.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: MANA_PULSE_DURATION_MS,
      onComplete: () => overlay.destroy(),
    });

    const mote = this.scene.add.circle(this.homeX, worldY, 3, MANA_MOTE_COLOR, 0.9).setDepth(49);
    this.scene.tweens.add({
      targets: mote,
      y: worldY - MANA_MOTE_RISE_DISTANCE,
      alpha: 0,
      duration: MANA_MOTE_DURATION_MS,
      ease: 'Quad.easeOut',
      onComplete: () => mote.destroy(),
    });
  }

  /** Kills any in-flight tweens on the container/floats before destroying, so a mid-animation
   *  rebuild (waveStarted rebuilds the enemy roster) can never touch a dead game object. */
  destroy(): void {
    this.scene.tweens.killTweensOf(this.container);
    this.scene.tweens.killTweensOf(this.bossFocusMarker);
    this.scene.tweens.killTweensOf(this.body);
    this.body.stop();
    this.telegraphTween?.remove();
    this.telegraphTween = null;
    this.clearFlash();
    this.pendingCharge = false;
    this.stopChargeCycle();
    this.releaseActive = false;
    for (const float of this.activeFloats) {
      this.scene.tweens.killTweensOf(float);
      float.destroy();
    }
    this.activeFloats.clear();
    // Halo is a container child — destroyed with the container (no feet-scene object).
    this.container.destroy();
  }
}
