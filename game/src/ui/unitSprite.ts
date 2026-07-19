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

/** Locked visual decisions (phase-2-handoff): lunge 12px, out 90ms / back 120ms. */
const LUNGE_DISTANCE = 12;
const LUNGE_OUT_MS = 90;
const LUNGE_BACK_MS = 120;

/** v0.3 chunk F: tank swing is a heavier shove — bigger lunge + a squash/stretch beat. */
const SHOVE_DISTANCE = 20;
const SHOVE_OUT_MS = 110;
const SHOVE_BACK_MS = 150;
const SHOVE_SQUASH_SCALE_X = 1.12;
const SHOVE_SQUASH_SCALE_Y = 0.9;

/** v0.3 chunk F: DPS swing is a quick double-jab — two small lunges back to back. */
const JAB_DISTANCE = 9;
const JAB_OUT_MS = 55;
const JAB_BACK_MS = 55;
const JAB_GAP_MS = 30;

/** v0.3 chunk F: healer cast-pose cycle (long casts) and instant-cast flourish timing. */
const CAST_CYCLE_FRAME_MS = 140;
const INSTANT_CAST_FLOURISH_MS = 250;

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
  /** Tile/frame index into `bodyTextureKey` — see ui/sprites.ts frameForUnit(). */
  frame: number;
  /** Texture key for the body image; defaults to the shared Kenney sheet (UNIT_TEXTURE_KEY)
   *  when omitted. v0.3 chunk F: the party healer renders from a different sheet instead. */
  bodyTextureKey?: string;
  /** v0.3 chunk F: healer-only cast-pose animation. `frame` above must equal `idleFrame`. */
  casterAnim?: { idleFrame: number; castFrames: readonly number[] };
  showMana: boolean;
  clickable: boolean;
  onClick?: (unitId: string) => void;
  /** Side-view facing line (side-view-layout-handoff §A): party faces right, enemies face
   *  left. Kenney Tiny Dungeon tiles are front-facing portraits (no true native direction),
   *  so this is a stopgap flipX applied per side, not a correction of an inherent facing. */
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

  private readonly container: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Image;
  private readonly nameText: Phaser.GameObjects.Text;
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

  /** v0.3 chunk F: healer-only cast-pose config; null for every other unit. */
  private readonly casterAnim: { idleFrame: number; castFrames: readonly number[] } | null;
  private castCycleTimer: Phaser.Time.TimerEvent | null = null;
  private flourishTimer: Phaser.Time.TimerEvent | null = null;
  private flourishActive = false;

  /** Local (container-space) Y of the mana bar, when present — used to place the regen pulse. */
  private readonly manaBarY: number | null;

  /** v0.3 chunk F: pending "second jab" callback from an in-flight lungeJab(), cancelled if a
   *  new jab starts before it fires (rapid DPS swings should never stack more than 2 jabs). */
  private pendingJabTimer: Phaser.Time.TimerEvent | null = null;

  /** v0.3 chunk F: boss telegraph state — a repeating tween drives tint/scale/offset each tick. */
  private telegraphActive = false;
  private telegraphTween: Phaser.Tweens.Tween | null = null;

  /** v0.3 chunk F: true while a tank shove's squash/stretch tween owns the body's display size. */
  private squashActive = false;

  constructor(unit: Unit, config: UnitSpriteConfig) {
    const { scene, x, y, width, height, frame, showMana, clickable, onClick, facing } = config;
    this.id = unit.id;
    this.scene = scene;
    this.homeX = x;
    this.homeY = y;
    this.width = width;
    this.height = height;
    this.casterAnim = config.casterAnim ?? null;

    this.container = scene.add.container(x, y);

    // All children below use coordinates LOCAL to the container (relative to
    // the unit's home position, i.e. as if x=y=0).
    this.body = scene.add
      .image(0, 0, config.bodyTextureKey ?? UNIT_TEXTURE_KEY, frame)
      .setDisplaySize(width, height)
      .setFlipX(facing === 'left');
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

    // Name stays centered on the body: units now sit side-by-side on the ground
    // line with room between slots, and the front-facing Tiny Dungeon portraits
    // read fine with text overlaid (unchanged from the pre–side-view layout).
    this.nameText = scene.add
      .text(0, 0, unit.name, { fontFamily: NAME_FONT, color: NAME_COLOR })
      .setStroke('#0a0605', 3)
      .setOrigin(0.5)
      .setDepth(1);
    this.container.add(this.nameText);

    const hpY = -height / 2 - HP_BAR_OFFSET_Y;
    this.hpBar = new Bar(scene, -width / 2, hpY, width, HP_BAR_HEIGHT, HP_FILL_COLOR);
    this.hpBar.addToContainer(this.container);
    this.hpText = scene.add
      .text(0, hpY - HP_BAR_HEIGHT / 2 - HP_TEXT_GAP, '', { fontFamily: HP_FONT, color: HP_COLOR })
      .setOrigin(0.5, 1);
    this.container.add(this.hpText);

    if (showMana) {
      const manaY = hpY - HP_BAR_HEIGHT / 2 - HP_TEXT_HEIGHT - MANA_BAR_GAP - MANA_BAR_HEIGHT / 2;
      this.manaBar = new Bar(scene, -width / 2, manaY, width, MANA_BAR_HEIGHT, MANA_FILL_COLOR);
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
    this.targetHalo = scene.add
      .ellipse(x, feetY + 4, HALO_WIDTH, HALO_HEIGHT, HALO_FILL_COLOR, HALO_FILL_ALPHA)
      .setStrokeStyle(1, HALO_STROKE_COLOR)
      .setDepth(HALO_DEPTH)
      .setVisible(false);

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
        // frame, so raw scale values would shrink it to tile size. Skipped mid-shove-squash too
        // (same fight-every-frame problem as the telegraph guard above).
        if (!this.squashActive) this.body.setDisplaySize(this.width, this.height);
      }
      this.hpBar.setVisible(true);
      this.manaBar?.setVisible(true);
    } else {
      this.stopTelegraph();
      this.stopCastCycle();
      this.stopFlourishTimer();
      this.scene.tweens.killTweensOf(this.body);
      this.squashActive = false;
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

  /**
   * v0.3 chunk F: tank swing — a heavier shove than the shared lunge (bigger
   * forward travel) with a squash/stretch beat on the body at full extension,
   * settling back to normal proportions on the return. Same kill-and-snap
   * safety as `lunge()` so repeated shoves never stack an offset.
   */
  lungeShove(towardX: number): void {
    const direction = Math.sign(towardX - this.homeX) || 1;
    this.scene.tweens.killTweensOf(this.container);
    this.scene.tweens.killTweensOf(this.body);
    this.container.x = this.homeX;
    this.body.setDisplaySize(this.width, this.height);
    this.scene.tweens.add({
      targets: this.container,
      x: this.homeX + direction * SHOVE_DISTANCE,
      duration: SHOVE_OUT_MS,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: this.container,
          x: this.homeX,
          duration: SHOVE_BACK_MS,
          ease: 'Quad.easeIn',
        });
      },
    });
    this.squashActive = true;
    this.scene.tweens.add({
      targets: this.body,
      displayWidth: this.width * SHOVE_SQUASH_SCALE_X,
      displayHeight: this.height * SHOVE_SQUASH_SCALE_Y,
      duration: SHOVE_OUT_MS,
      ease: 'Quad.easeOut',
      yoyo: true,
      onComplete: () => {
        this.squashActive = false;
        this.body.setDisplaySize(this.width, this.height);
      },
    });
  }

  /**
   * v0.3 chunk F: DPS swing — two quick small lunges back to back (a jab-jab)
   * instead of one lunge. The second jab is scheduled after the first
   * completes + a short gap; both share the same kill-and-snap safety.
   */
  lungeJab(towardX: number): void {
    const direction = Math.sign(towardX - this.homeX) || 1;
    this.scene.tweens.killTweensOf(this.container);
    this.pendingJabTimer?.remove(false);
    this.pendingJabTimer = null;
    this.container.x = this.homeX;
    const singleJab = (onDone: () => void = () => {}) => {
      this.scene.tweens.add({
        targets: this.container,
        x: this.homeX + direction * JAB_DISTANCE,
        duration: JAB_OUT_MS,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.scene.tweens.add({
            targets: this.container,
            x: this.homeX,
            duration: JAB_BACK_MS,
            ease: 'Quad.easeIn',
            onComplete: onDone,
          });
        },
      });
    };
    singleJab(() => {
      this.pendingJabTimer = this.scene.time.delayedCall(JAB_GAP_MS, () => {
        this.pendingJabTimer = null;
        singleJab();
      });
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

  /** Spawns a `+N` float at this unit's home position for an effective (`amount > 0`) heal. */
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

  // ---- v0.3 chunk F: healer cast pose (no-op on units without casterAnim) ----------------

  /**
   * Start/stop the looping cast-pose cycle for a non-instant cast: cycles the
   * sheet's golden-light frames while `active`, holds/returns to the idle
   * frame when stopped. A quick instant-cast flourish in flight is left to
   * finish on its own timer (see `playCastFlourish`) rather than being cut
   * off by a same-tick `setCasting(false)` from `castFinished`.
   */
  setCasting(active: boolean): void {
    if (!this.casterAnim) return;
    if (active) {
      this.stopFlourishTimer();
      this.startCastCycle();
    } else {
      this.stopCastCycle();
      if (!this.flourishActive) this.body.setFrame(this.casterAnim.idleFrame);
    }
  }

  /** One-shot cast-pose flourish for instant (0ms) casts — self-timed, ignores setCasting(false). */
  playCastFlourish(durationMs: number = INSTANT_CAST_FLOURISH_MS): void {
    if (!this.casterAnim) return;
    this.stopCastCycle();
    this.stopFlourishTimer();
    const frames = this.casterAnim.castFrames;
    const stepMs = Math.max(60, Math.floor(durationMs / frames.length));
    let i = 0;
    this.body.setFrame(frames[0]!);
    this.flourishActive = true;
    this.flourishTimer = this.scene.time.addEvent({
      delay: stepMs,
      repeat: frames.length - 1,
      callback: () => {
        i++;
        this.body.setFrame(frames[Math.min(i, frames.length - 1)]!);
      },
    });
    this.scene.time.delayedCall(durationMs, () => {
      this.flourishActive = false;
      this.flourishTimer = null;
      this.body.setFrame(this.casterAnim!.idleFrame);
    });
  }

  private startCastCycle(): void {
    if (this.castCycleTimer || !this.casterAnim) return;
    const frames = this.casterAnim.castFrames;
    let i = 0;
    this.body.setFrame(frames[0]!);
    this.castCycleTimer = this.scene.time.addEvent({
      delay: CAST_CYCLE_FRAME_MS,
      loop: true,
      callback: () => {
        i = (i + 1) % frames.length;
        this.body.setFrame(frames[i]!);
      },
    });
  }

  private stopCastCycle(): void {
    this.castCycleTimer?.remove(false);
    this.castCycleTimer = null;
  }

  private stopFlourishTimer(): void {
    this.flourishTimer?.remove(false);
    this.flourishTimer = null;
    this.flourishActive = false;
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
        this.body.setY(-t * TELEGRAPH_RAISE_PX);
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
    this.body.setY(0);
    this.body.clearTint();
    this.body.setDisplaySize(this.width, this.height);
  }

  // ---- v0.3 chunk F: mana-regen tick juice -----------------------------------------------

  /** Brief bright flash across the mana bar + a small mote drifting up off it (no-op if no mana bar). */
  pulseMana(): void {
    if (!this.manaBar || this.manaBarY === null) return;
    const worldY = this.homeY + this.manaBarY;
    const overlay = this.scene.add
      .rectangle(this.homeX, worldY, this.width, MANA_BAR_HEIGHT, MANA_PULSE_COLOR, MANA_PULSE_ALPHA)
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
    this.telegraphTween?.remove();
    this.telegraphTween = null;
    this.castCycleTimer?.remove(false);
    this.castCycleTimer = null;
    this.flourishTimer?.remove(false);
    this.flourishTimer = null;
    this.pendingJabTimer?.remove(false);
    this.pendingJabTimer = null;
    for (const float of this.activeFloats) {
      this.scene.tweens.killTweensOf(float);
      float.destroy();
    }
    this.activeFloats.clear();
    this.targetHalo.destroy();
    this.container.destroy();
  }
}
