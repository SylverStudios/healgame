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

/** `-N`/`+N` floats: modest rise + fade (tuned post–Phase 3 for readability). */
const FLOAT_RISE_DISTANCE = 20;
const FLOAT_DURATION_MS = 550;
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
const HEAL_FLOAT_COLOR = '#7ad67a';
const FLOAT_STROKE_COLOR = '#0a0605';
const FLOAT_STROKE_WIDTH = 3;

export interface UnitSpriteConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Tile index into the Tiny Dungeon sheet — see ui/sprites.ts frameForUnit(). */
  frame: number;
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

  constructor(unit: Unit, config: UnitSpriteConfig) {
    const { scene, x, y, width, height, frame, showMana, clickable, onClick, facing } = config;
    this.id = unit.id;
    this.scene = scene;
    this.homeX = x;
    this.homeY = y;
    this.width = width;
    this.height = height;

    this.container = scene.add.container(x, y);

    // All children below use coordinates LOCAL to the container (relative to
    // the unit's home position, i.e. as if x=y=0).
    this.body = scene.add
      .image(0, 0, UNIT_TEXTURE_KEY, frame)
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
    } else {
      this.manaBar = null;
      this.manaText = null;
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
      this.body.clearTint();
      this.body.setAlpha(1);
      // setDisplaySize (not setScale) — the image is already scaled up from
      // its 16×16 source frame, so raw scale values would shrink it to tile size.
      this.body.setDisplaySize(this.width, this.height);
      this.hpBar.setVisible(true);
      this.manaBar?.setVisible(true);
    } else {
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
    this.spawnFloatText(`-${amount}`, DAMAGE_FLOAT_COLOR, floatFontPx(amount));
  }

  /** Spawns a `+N` float at this unit's home position for an effective (`amount > 0`) heal. */
  spawnHealFloat(amount: number): void {
    if (amount <= 0) return;
    this.spawnFloatText(`+${amount}`, HEAL_FLOAT_COLOR, floatFontPx(amount));
  }

  private spawnFloatText(text: string, color: string, fontSize: string): void {
    const obj = this.scene.add
      .text(this.homeX, this.homeY, text, { fontFamily: FLOAT_FONT, fontSize, color })
      .setStroke(FLOAT_STROKE_COLOR, FLOAT_STROKE_WIDTH)
      .setOrigin(0.5)
      .setDepth(FLOAT_DEPTH);
    this.activeFloats.add(obj);
    this.scene.tweens.add({
      targets: obj,
      y: this.homeY - FLOAT_RISE_DISTANCE,
      alpha: 0,
      duration: FLOAT_DURATION_MS,
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

  /** Kills any in-flight tweens on the container/floats before destroying, so a mid-animation
   *  rebuild (waveStarted rebuilds the enemy roster) can never touch a dead game object. */
  destroy(): void {
    this.scene.tweens.killTweensOf(this.container);
    this.scene.tweens.killTweensOf(this.bossFocusMarker);
    for (const float of this.activeFloats) {
      this.scene.tweens.killTweensOf(float);
      float.destroy();
    }
    this.activeFloats.clear();
    this.targetHalo.destroy();
    this.container.destroy();
  }
}
