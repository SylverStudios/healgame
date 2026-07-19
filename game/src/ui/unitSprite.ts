/**
 * A single combat unit rendered as a Tiny Dungeon tile (see ui/sprites.ts)
 * + name label + HP bar (+ mana bar for the healer) + optional
 * click-to-target marker. Bars/labels keep the temp-art style (flat bars,
 * monospace, dark palette); the unit body is a 16×16 pixel-art frame scaled
 * up with nearest-neighbor filtering (`pixelArt: true` in main.ts).
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
import { UNIT_TEXTURE_KEY } from './sprites';

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

const NAME_FONT = '11px monospace';
const NAME_COLOR = '#d8c8b8';
const HP_FONT = '10px monospace';
const HP_COLOR = '#e8d8c8';

const DAMAGE_FLASH_COLOR = 0xff3b30;
const HEAL_FLASH_COLOR = 0x3ce06a;
const FLASH_ALPHA = 0.65;
const FLASH_DURATION_MS = 260;

const TARGET_MARKER_WIDTH = 10;
const TARGET_MARKER_HEIGHT = 8;
/** Gap between the topmost bar's number line and the marker's tip. */
const TARGET_MARKER_GAP = 8;
/** Extra clearance for the number-line text glyphs above the topmost bar (10px font). */
const TARGET_MARKER_TEXT_CLEARANCE = 12;
const TARGET_MARKER_COLOR = 0xf2c14e;

/** Locked visual decisions (phase-2-handoff): lunge 12px, out 90ms / back 120ms.
 *  Used by Kenney enemies / boss / healer — PixelLab party mercs play attack strips in place. */
const LUNGE_DISTANCE = 12;
const LUNGE_OUT_MS = 90;
const LUNGE_BACK_MS = 120;

/** Fallback step when a caster strip has no per-frame exposure sheet. */
const CASTER_DEFAULT_FRAME_MS = 100;

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

/** `-N` damage floats: modest rise + fade (tuned post–Phase 3 for readability). */
const DAMAGE_FLOAT_RISE_DISTANCE = 20;
const DAMAGE_FLOAT_DURATION_MS = 550;
/** `+N` heal floats linger longer so the basic heal reads as satisfying juice. */
const HEAL_FLOAT_RISE_DISTANCE = 36;
const HEAL_FLOAT_DURATION_MS = 980;
const FLOAT_FONT = 'monospace';
const FLOAT_DEPTH = 50;

/** Map heal/damage amount → float font size (handoff §L). */
function floatFontPx(amount: number): string {
  const a = Math.abs(amount);
  let px = 18;
  if (a <= 1) px = 18;
  else if (a <= 2) px = 20;
  else if (a <= 4) px = 24;
  else if (a <= 6) px = 28;
  else px = 32;
  return `${px}px`;
}

/**
 * Boss-focus marker: a crimson crosshair hovering above the unit during
 * Tunnel Vision. Its ring-and-reticle silhouette stays unmistakably distinct
 * from the player's gold chevron/halo when both target the same ally.
 */
const FOCUS_MARKER_RADIUS = 7;
const FOCUS_MARKER_ARM = 11;
/** Gap between the heal-target chevron's slot and the focus brand. */
const FOCUS_MARKER_GAP = 6;
const FOCUS_MARKER_COLOR = 0xc23b22;
const FOCUS_MARKER_MIN_ALPHA = 0.35;
const FOCUS_PULSE_MS = 450;

const HALO_FILL_COLOR = 0xf2c14e;
const HALO_FILL_ALPHA = 0.28;
const HALO_STROKE_COLOR = 0x8a7868;
const HALO_WIDTH = 52;
const HALO_HEIGHT = 14;
const HALO_DEPTH = -2;
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
  /**
   * Healer-only (chunk 1B): continuous breathing loop (Phaser anim, `repeat: -1`)
   * played whenever not charging/casting/zapping. Restored after any one-shot
   * strip (cast-action or zap) completes instead of a static idle frame.
   */
  idleAnimKey?: string;
  /** Healer-only: one-shot Bonk zap strip (registered in BootScene). Played via `playZap()`. */
  zapAnimKey?: string;
  /**
   * Extra body Y in container space. PixelLab canvases pad ~25% below the painted
   * feet — shift the sprite down so feet meet the ground line after setDisplaySize.
   */
  bodyOffsetY?: number;
  /**
   * Healer cast pipeline: charge loops while channeling; cast-action plays once
   * on release (or as the instant flourish). `frame` above must equal `idleFrame`.
   */
  casterAnim?: {
    idleFrame: number;
    chargeFrames: readonly number[];
    chargeDurationsMs: readonly number[];
    castFrames: readonly number[];
    castDurationsMs: readonly number[];
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
  /** Healer-only continuous idle loop key; null for every other unit (see `idleAnimKey` config). */
  private readonly idleAnimKey: string | null;
  /** Healer-only Bonk zap strip key; null for every other unit. */
  private readonly zapAnimKey: string | null;
  /** Resting local Y for the body (PixelLab foot-pad offset); telegraph raise adds on top. */
  private readonly bodyRestY: number;
  private readonly nameText: Phaser.GameObjects.Text | null;
  private readonly hpBar: Bar;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly manaBar: Bar | null;
  private readonly manaText: Phaser.GameObjects.Text | null;
  private readonly targetMarker: Phaser.GameObjects.Triangle;
  /** Ember/iron ellipse under the unit's feet when targeted (handoff §M). */
  private readonly targetHalo: Phaser.GameObjects.Ellipse;
  /** Crimson crosshair shown while a boss focus channel targets this unit. */
  private readonly bossFocusMarker: Phaser.GameObjects.Graphics;

  /** Standalone floating texts (hit markers / heal floats) not parented to the container. */
  private readonly activeFloats = new Set<Phaser.GameObjects.Text>();

  private alive = true;

  /** Healer cast pipeline config; null for every other unit. */
  private readonly casterAnim: NonNullable<UnitSpriteConfig['casterAnim']> | null;
  private chargeCycleTimer: Phaser.Time.TimerEvent | null = null;
  private releaseTimer: Phaser.Time.TimerEvent | null = null;
  private releaseActive = false;
  /** Queued next cast arrived during cast-action — start charge when release ends. */
  private pendingCharge = false;

  /** Local (container-space) Y of the mana bar, when present — used to place the regen pulse. */
  private readonly manaBarY: number | null;

  /** v0.3 chunk F: boss telegraph state — a repeating tween drives tint/scale/offset each tick. */
  private telegraphActive = false;
  private telegraphTween: Phaser.Tweens.Tween | null = null;

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

    this.container = scene.add.container(x, y);

    // All children below use coordinates LOCAL to the container (relative to
    // the unit's home position, i.e. as if x=y=0).
    const textureKey = config.bodyTextureKey ?? UNIT_TEXTURE_KEY;
    this.restTextureKey = textureKey;
    this.restFrame = config.frame;
    this.attackAnimKey = config.attackAnimKey ?? null;
    this.idleAnimKey = config.idleAnimKey ?? null;
    this.zapAnimKey = config.zapAnimKey ?? null;
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
    this.body.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.restoreRestPose();
    });
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
        .text(0, this.bodyRestY, unit.name, { fontFamily: NAME_FONT, color: NAME_COLOR })
        .setStroke('#0a0605', 3)
        .setOrigin(0.5)
        .setDepth(1);
      this.container.add(this.nameText);
    }

    const hpY = -height / 2 - HP_BAR_OFFSET_Y;
    const meterHalf = this.meterWidth / 2;
    this.hpBar = new Bar(scene, -meterHalf, hpY, this.meterWidth, HP_BAR_HEIGHT, HP_FILL_COLOR);
    this.hpBar.addToContainer(this.container);
    this.hpText = scene.add
      .text(0, hpY - HP_BAR_HEIGHT / 2 - HP_TEXT_GAP, '', { fontFamily: HP_FONT, color: HP_COLOR })
      .setOrigin(0.5, 1);
    this.container.add(this.hpText);

    if (showMana) {
      const manaY = hpY - HP_BAR_HEIGHT / 2 - HP_TEXT_HEIGHT - MANA_BAR_GAP - MANA_BAR_HEIGHT / 2;
      this.manaBar = new Bar(scene, -meterHalf, manaY, this.meterWidth, MANA_BAR_HEIGHT, MANA_FILL_COLOR);
      this.manaBar.addToContainer(this.container);
      this.manaText = scene.add
        .text(0, manaY - MANA_BAR_HEIGHT / 2 - HP_TEXT_GAP, '', { fontFamily: HP_FONT, color: '#a8c8f0' })
        .setOrigin(0.5, 1);
      this.container.add(this.manaText);
      this.manaBarY = manaY;
    } else {
      this.manaBar = null;
      this.manaText = null;
      this.manaBarY = null;
    }

    // Downward-pointing chevron centered above the topmost bar (mana bar + its
    // number line when present, else the HP bar + its number line) — in the old
    // vertical roster a left-of-rect chevron pointed unambiguously at one row,
    // but in a horizontal facing line it reads as pointing at whichever
    // neighbor sits to its left. Above-the-bars is unambiguous at any spacing.
    const topBarTextY = showMana
      ? hpY - HP_BAR_HEIGHT / 2 - HP_TEXT_HEIGHT - MANA_BAR_GAP - MANA_BAR_HEIGHT - HP_TEXT_GAP
      : hpY - HP_BAR_HEIGHT / 2 - HP_TEXT_GAP;
    const markerTipY = topBarTextY - TARGET_MARKER_TEXT_CLEARANCE - TARGET_MARKER_GAP;
    // Position (0, markerTipY) places the shape's local origin; the 3 points below are
    // relative to THAT origin (0,0), matching the pre-side-view marker's pattern — they
    // must not also carry markerTipY, or the offset compounds through Phaser's own
    // bounding-box-based origin math into a much larger on-screen gap than intended.
    this.targetMarker = scene.add
      .triangle(
        0,
        markerTipY,
        -TARGET_MARKER_WIDTH / 2,
        -TARGET_MARKER_HEIGHT,
        TARGET_MARKER_WIDTH / 2,
        -TARGET_MARKER_HEIGHT,
        0,
        0,
        TARGET_MARKER_COLOR,
      )
      .setVisible(false);
    this.container.add(this.targetMarker);

    // Above the chevron's slot so a heal-targeted AND boss-focused unit shows both.
    const focusY = markerTipY - TARGET_MARKER_HEIGHT - FOCUS_MARKER_GAP - FOCUS_MARKER_ARM;
    this.bossFocusMarker = scene.add.graphics().setPosition(0, focusY).setVisible(false);
    this.bossFocusMarker.lineStyle(2, FOCUS_MARKER_COLOR, 1);
    this.bossFocusMarker.strokeCircle(0, 0, FOCUS_MARKER_RADIUS);
    this.bossFocusMarker.lineBetween(-FOCUS_MARKER_ARM, 0, FOCUS_MARKER_ARM, 0);
    this.bossFocusMarker.lineBetween(0, -FOCUS_MARKER_ARM, 0, FOCUS_MARKER_ARM);
    this.bossFocusMarker.fillStyle(FOCUS_MARKER_COLOR, 1).fillCircle(0, 0, 2);
    this.container.add(this.bossFocusMarker);

    const feetY = y + height / 2;
    const haloWidth = Math.max(HALO_WIDTH, Math.round(width * 0.85));
    this.targetHalo = scene.add
      .ellipse(x, feetY + 4, haloWidth, HALO_HEIGHT, HALO_FILL_COLOR, HALO_FILL_ALPHA)
      .setStrokeStyle(1, HALO_STROKE_COLOR)
      .setDepth(HALO_DEPTH)
      .setVisible(false);

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
        else this.body.clearTint();
        this.body.setAlpha(1);
        // setDisplaySize (not setScale) — the image is already scaled up from its 16×16 source
        // frame, so raw scale values would shrink it to tile size.
        this.body.setDisplaySize(this.width, this.height);
      }
      this.hpBar.setVisible(true);
      this.manaBar?.setVisible(true);
    } else {
      this.stopTelegraph();
      this.pendingCharge = false;
      this.stopChargeCycle();
      this.stopReleaseTimer();
      this.stopAttackAnim();
      if (this.idleAnimKey) this.body.stop();
      this.scene.tweens.killTweensOf(this.body);
      this.body.setTint(DEAD_TINT);
      this.body.setAlpha(DEAD_ALPHA);
      this.body.setDisplaySize(this.width * DEAD_SCALE, this.height * DEAD_SCALE);
      this.hpBar.setVisible(false);
      this.manaBar?.setVisible(false);
      this.targetMarker.setVisible(false);
      this.targetHalo.setVisible(false);
      // Engine ends the channel on target death (bossFocusEnded), but hide
      // defensively so a dead unit never wears the brand for a frame.
      this.setBossFocused(false);
    }
  }

  setTargeted(isTargeted: boolean): void {
    this.targetMarker.setVisible(isTargeted && this.alive);
    this.targetHalo.setVisible(isTargeted && this.alive);
  }

  /** Show/hide the crimson boss-focus crosshair (Tunnel Vision channel), with a slow alpha pulse. */
  setBossFocused(isFocused: boolean): void {
    this.scene.tweens.killTweensOf(this.bossFocusMarker);
    this.bossFocusMarker.setAlpha(1);
    const show = isFocused && this.alive;
    this.bossFocusMarker.setVisible(show);
    if (show) {
      this.scene.tweens.add({
        targets: this.bossFocusMarker,
        alpha: FOCUS_MARKER_MIN_ALPHA,
        duration: FOCUS_PULSE_MS,
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

  /** Spawns a `-N` float at this unit's home position for a `damage` event on it. Always
   *  shown — including 0 and overkill raw amounts (handoff §A: no clamping to remaining HP). */
  spawnDamageFloat(amount: number): void {
    this.spawnFloatText(
      `-${amount}`,
      DAMAGE_FLOAT_COLOR,
      floatFontPx(amount),
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

  private spawnFloatText(
    text: string,
    color: string,
    fontSize: string,
    riseDistance: number,
    durationMs: number,
  ): void {
    const obj = this.scene.add
      .text(this.homeX, this.homeY, text, { fontFamily: FLOAT_FONT, fontSize, color })
      .setStroke(FLOAT_STROKE_COLOR, FLOAT_STROKE_WIDTH)
      .setOrigin(0.5)
      .setDepth(FLOAT_DEPTH);
    this.activeFloats.add(obj);
    this.scene.tweens.add({
      targets: obj,
      y: this.homeY - riseDistance,
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
    if (!this.attackAnimKey || !this.alive) return;
    // Restart if already mid-swing so rapid autos replace the strip instead of
    // being ignored (Phaser's ignoreIfPlaying=true would skip the new play).
    this.body.play(this.attackAnimKey, false);
    this.body.setDisplaySize(this.width, this.height);
  }

  /**
   * Healer-only one-shot Bonk zap strip. Locked decision: Bonk and only Bonk
   * plays this — CombatScene's castStarted handler selects it by spell id.
   * Rest pose (idle loop) is restored on ANIMATION_COMPLETE, same as playAttack().
   */
  playZap(): void {
    if (!this.zapAnimKey || !this.alive) return;
    this.body.play(this.zapAnimKey, false);
    this.body.setDisplaySize(this.width, this.height);
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

  /**
   * Returns the healer body to its resting look after a manual (non-Phaser-anim)
   * frame strip completes — the breathing loop if wired, else the static caster
   * idle frame. Used by the charge/cast-action pipeline below.
   */
  private returnToIdle(): void {
    if (this.idleAnimKey) {
      this.body.play(this.idleAnimKey, true);
      this.body.setDisplaySize(this.width, this.height);
    } else if (this.casterAnim) {
      this.body.setFrame(this.casterAnim.idleFrame);
    }
  }

  private stopAttackAnim(): void {
    if (!this.attackAnimKey) return;
    this.body.stop();
    this.restoreRestPose();
  }

  /** Brief ember flash when the healer begins a cast (handoff §N). */
  flashCast(): void {
    this.flash(0xf2c14e);
  }

  /** Brief red flash for a damage event on this unit. */
  flashDamage(): void {
    this.flash(DAMAGE_FLASH_COLOR);
  }

  /** Brief green flash for a heal event on this unit. */
  flashHeal(): void {
    this.flash(HEAL_FLASH_COLOR);
  }

  private flash(color: number): void {
    const overlay = this.scene.add
      .rectangle(this.homeX, this.homeY, this.width, this.height, color, FLASH_ALPHA)
      .setDepth(10);
    this.scene.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: FLASH_DURATION_MS,
      onComplete: () => overlay.destroy(),
    });
  }

  // ---- Healer charge / cast-action (no-op without casterAnim) ----------------------------

  /**
   * Start/stop the charge loop for a channeled cast. Stopping alone returns to
   * idle (cancel path). If a cast-action is still playing (queued spell fired
   * same tick as finish), charge is deferred until the release completes —
   * never clip the flash/contact.
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
      if (!this.releaseActive) this.returnToIdle();
    }
  }

  /**
   * One-shot cast-action strip (orb → flash → recover). Used for instant casts
   * on start, early lead-in before cast end, and `finishCast()`. Self-timed.
   */
  playCastRelease(): void {
    if (!this.casterAnim) return;
    if (this.releaseActive) return;
    this.stopChargeCycle();
    this.playFrameStrip(
      this.casterAnim.castFrames,
      this.casterAnim.castDurationsMs,
      /* markRelease */ true,
    );
  }

  /**
   * Begin cast-action before `castFinished` so flash/contact land near the heal
   * resolve. No-op unless currently charging (avoids double-start).
   */
  beginEarlyCastRelease(): void {
    if (!this.casterAnim || this.releaseActive || !this.chargeCycleTimer) return;
    this.playCastRelease();
  }

  /**
   * Successful cast end: play the cast-action if we were still charging. No-op
   * when early release or an instant cast already started the strip.
   */
  finishCast(): void {
    if (!this.casterAnim) return;
    if (this.releaseActive) return;
    if (this.chargeCycleTimer) {
      this.playCastRelease();
      return;
    }
    this.returnToIdle();
  }

  /** Instant-cast alias — same cast-action strip as a successful channel finish. */
  playCastFlourish(): void {
    this.playCastRelease();
  }

  private startChargeCycle(): void {
    if (this.chargeCycleTimer || !this.casterAnim) return;
    this.pendingCharge = false;
    // Manual setFrame() below fights a running Phaser anim (idle loop) — stop it first.
    if (this.idleAnimKey) this.body.stop();
    const frames = this.casterAnim.chargeFrames;
    const durations = this.casterAnim.chargeDurationsMs;
    let i = 0;
    this.body.setFrame(frames[0]!);
    const step = () => {
      i = (i + 1) % frames.length;
      this.body.setFrame(frames[i]!);
      this.chargeCycleTimer = this.scene.time.delayedCall(
        durations[i] ?? CASTER_DEFAULT_FRAME_MS,
        step,
      );
    };
    this.chargeCycleTimer = this.scene.time.delayedCall(
      durations[0] ?? CASTER_DEFAULT_FRAME_MS,
      step,
    );
  }

  private stopChargeCycle(): void {
    this.chargeCycleTimer?.remove(false);
    this.chargeCycleTimer = null;
  }

  private playFrameStrip(
    frames: readonly number[],
    durationsMs: readonly number[],
    markRelease: boolean,
  ): void {
    this.stopReleaseTimer();
    if (frames.length === 0) return;
    // Manual setFrame() below fights a running Phaser anim (idle loop) — stop it first.
    if (this.idleAnimKey) this.body.stop();
    let i = 0;
    this.body.setFrame(frames[0]!);
    if (markRelease) this.releaseActive = true;

    const advance = () => {
      i++;
      if (i >= frames.length) {
        this.releaseActive = false;
        this.releaseTimer = null;
        if (this.pendingCharge) {
          this.startChargeCycle();
        } else {
          this.returnToIdle();
        }
        return;
      }
      this.body.setFrame(frames[i]!);
      this.releaseTimer = this.scene.time.delayedCall(
        durationsMs[i] ?? CASTER_DEFAULT_FRAME_MS,
        advance,
      );
    };

    this.releaseTimer = this.scene.time.delayedCall(
      durationsMs[0] ?? CASTER_DEFAULT_FRAME_MS,
      advance,
    );
  }

  private stopReleaseTimer(): void {
    this.releaseTimer?.remove(false);
    this.releaseTimer = null;
    this.releaseActive = false;
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
    this.pendingCharge = false;
    this.stopChargeCycle();
    this.stopReleaseTimer();
    for (const float of this.activeFloats) {
      this.scene.tweens.killTweensOf(float);
      float.destroy();
    }
    this.activeFloats.clear();
    this.targetHalo.destroy();
    this.container.destroy();
  }
}
