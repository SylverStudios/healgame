/**
 * Chunk 2 — the facing-line combat view (poc-spec §4). Drives the pure
 * CombatEngine from update()/advance(delta) and renders its state with
 * geometric temp art only (tech-options.md "Temp art plan"): colored rects,
 * flat bars, text. Party on the left facing right, current wave/boss on the
 * right facing left, spell bar + cast bars along the bottom/top.
 */

import Phaser from 'phaser';
import { SceneKeys } from './keys';
import { CombatEngine } from '../combat/engine';
import { nextPartyTargetId } from '../combat/partyTarget';
import type {
  CombatEvent,
  CombatState,
  CombatStatus,
  EncounterDef,
  SpellDef,
  Unit,
} from '../combat/types';
import { getEncounterById } from '../data/encounters';
import { GCD_MS } from '../data/constants';
import { Bar } from '../ui/bar';
import { UnitSprite } from '../ui/unitSprite';
import {
  attackAnimKeyForUnit,
  HEALER_CAST_FRAMES,
  HEALER_IDLE_FRAME,
  HEALER_SHEET_TEXTURE_KEY,
  presentationForUnit,
} from '../ui/sprites';
import { SpellBar } from '../ui/spellBar';
import { CombatLog } from '../ui/combatLog';
import {
  ManaSpendAura,
  shakeBossImpact,
  shakeHealImpact,
  showCastBeam,
  showHealParticles,
  showHealSparkle,
} from '../ui/combatFx';
import { PaceToggle } from '../ui/paceToggle';
import { loadSave, saveGame, type SaveData } from '../save/save';
import { relicsById } from '../data/relics';
import { runModsFromSave } from '../data/runMods';
import { RunModsBar } from '../ui/runModsBar';
import { ACTION_HOTKEY_LETTERS, MAX_ACTION_HOTKEYS, actionHotkeySlot } from '../ui/actionHotkeys';
import type { CombatMods } from '../data/talentTree';
import { beginRun, finalizeRun, recordPress, type PressSource } from '../telemetry';
import { buildRunSummary, hasBuildGlyph } from '../ui/runSummary';
import { drawBuildGlyph } from '../ui/buildGlyph';
import { detectCloseCall, pickBanterLine, type BanterSpeaker, type BanterTrigger } from '../data/banter';
import { showSpeechBubble } from '../ui/speechBubble';
import { MOB_REGISTRY } from '../data/mobs';
import { ENEMY_ABILITY_REGISTRY } from '../data/enemyAbilities';
import type { BossTelegraphCue } from '../data/content/types';

/** Pinned contract: callers pass fully resolved CombatMods (from loadoutFromSave). */
export interface CombatSceneData {
  encounterId: string;
  loadout: CombatMods;
  returnTo: string;
}

/** Passed back to `returnTo` as `{ combatResult }` when the player clicks "Return". */
export interface CombatResult {
  encounterId: string;
  status: 'victory' | 'wipe';
  xp: number;
}

// ---- layout constants ------------------------------------------------------

const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 540;

// Side-view facing line (side-view-layout-handoff §A/§C): party on the left
// facing right, enemies on the right facing left, everyone bottom-aligned to
// one shared ground Y (units have different heights, so their container
// centers differ — see groundAnchorY()).
const GROUND_Y = 340;
const PARTY_SLOT_LEFT = 80;
const PARTY_SLOT_RIGHT = 380;
const ENEMY_SLOT_LEFT = 580;
const ENEMY_SLOT_RIGHT = 880;
const GROUND_LINE_COLOR = 0x3a2a22;
const GROUND_LINE_WIDTH = 2;
const GROUND_LINE_MARGIN = 40;

/** Engine party order is tank → dps1 → dps2 → healer (unchanged); visual left→right
 *  order is healer · dps2 · dps1 · tank so the tank stands nearest the enemy line
 *  (handoff §B). Presentation-only — index into this array, never reorder the engine's. */
const PARTY_VISUAL_ORDER = ['healer', 'dps2', 'dps1', 'tank'];

// Display sizes: PixelLab canvases are ~92px with heavy padding around a ~40px
// figure, so they display larger than Kenney's filled 16×16 tiles. The ragged
// healer sheet matches the same party display size so the line reads as one
// roster. Kenney sizes stay multiples of 16.
const PARTY_CUSTOM_WIDTH = 112;
const PARTY_CUSTOM_HEIGHT = 112;
const PARTY_KENNEY_WIDTH = 48;
const PARTY_KENNEY_HEIGHT = 48;
const TRASH_CUSTOM_WIDTH = 72;
const TRASH_CUSTOM_HEIGHT = 72;
/**
 * Padded canvases leave empty pixels under painted feet. Shift the body down
 * by that fraction of display height so feet meet GROUND_Y.
 * - PixelLab stills: ~23px pad on a ~92px canvas
 * - Ragged healer sheet: ~17px pad on a 64px frame (same idle/cast baseline)
 */
const PIXELLAB_FOOT_PAD_RATIO = 23 / 92;
const HEALER_FOOT_PAD_RATIO = 17 / 64;
const TRASH_KENNEY_WIDTH = 32;
const TRASH_KENNEY_HEIGHT = 32;
const BOSS_UNIT_WIDTH = 80;
const BOSS_UNIT_HEIGHT = 80;

const WAVE_TEXT_Y = 20;
const REWARDS_X = 14;
const REWARDS_Y = 14;
const FOCUS_CALLOUT_Y = 82;
const WAVE_BANNER_Y = 128;
const WAVE_BANNER_WIDTH = 280;
const WAVE_BANNER_HEIGHT = 42;
const WAVE_BANNER_HOLD_MS = 650;
const WAVE_BANNER_FADE_MS = 350;

const PLAYER_CAST_BAR_WIDTH = 320;
const PLAYER_CAST_BAR_HEIGHT = 20;
/** Above the Shift+QWER CD row (buttons top ~420 when SPELL_BAR_Y=508) so keycaps don't overlap. */
const PLAYER_CAST_BAR_Y = 392;
const PLAYER_CAST_FILL_COLOR = 0xf2c14e;
const GCD_BAR_HEIGHT = 4;
const GCD_BAR_GAP = 3;
const GCD_FILL_COLOR = 0x8a7868;
/** One-line "next: …" under the GCD sliver when a spell is queued. */
const QUEUED_SPELL_GAP = 10;
const QUEUED_SPELL_COLOR = '#a89888';

// v0.3 chunk F "Boss telegraphs": the named cast bar is demoted — an unlabeled
// sliver near the boss sprite (its own wind-up/glow cue is the primary teach;
// the combat log still names the ability via the existing bossCastStarted line).
const BOSS_CAST_BAR_WIDTH = 70;
const BOSS_CAST_BAR_HEIGHT = 5;
/** Gap between the boss sprite's top edge and the sliver's bottom edge. */
const BOSS_CAST_BAR_GAP = 14;
const BOSS_CAST_FILL_COLOR = 0xe05a4e;

const SPELL_BAR_Y = 508;

const PACE_TOGGLE_X = 20;
const PACE_TOGGLE_Y = VIEW_HEIGHT - 8;

/** Cast-cancel toast (handoff §D UI row): short-lived line just above the player cast bar. */
const TOAST_Y = 368;
const TOAST_FONT = 'monospace';
const TOAST_FONT_SIZE = '14px';
const TOAST_COLOR = '#e8d8c8';
const TOAST_FADE_MS = 1500;

const OVERLAY_DEPTH = 1000;
const OVERLAY_ALPHA = 0.85;
const OVERLAY_FADE_MS = 300;

// Wipe/victory run summary panel (locked: docs/v0.3-handoff.md "Wipe / victory
// summary") — short slide-in transition (~0.5-1.0s total) over the dimmed-but-
// visible party, then outcome + XP + build glyph reveal in sequence, Return
// last (~1s in, safely inside journey's 2s poll cadence).
const PANEL_WIDTH = 420;
const PANEL_HEIGHT = 260;
const PANEL_SLIDE_OFFSET = 50;
const PANEL_SLIDE_DELAY_MS = 120;
const PANEL_SLIDE_MS = 500;
const TITLE_DELAY_MS = 520;
const TITLE_REVEAL_MS = 220;
const XP_DELAY_MS = 660;
const XP_REVEAL_MS = 220;
const GLYPH_DELAY_MS = 780;
const GLYPH_REVEAL_MS = 240;
const GLYPH_CELL = 20;
const GLYPH_COLOR = 0xfff2df;
const RETURN_DELAY_MS = 940;
const RETURN_REVEAL_MS = 220;

const HUD_FONT = 'monospace';

// v0.3 chunk G: party banter (docs/v0.3-handoff.md "Banter"). Bubble anchor Y is the
// speaker's home Y minus enough clearance to clear its always-on overlay stack (HP bar +
// number line, plus the mana bar + number line for the healer) — showSpeechBubble adds its
// own small gap above that anchor for the tail.
/** Clears the shared party display height + healer mana bar stack above GROUND_Y. */
const BANTER_HEALER_Y_OFFSET = 100;
/** Clears the taller PixelLab tank body + HP bar stack above GROUND_Y. */
const BANTER_TANK_Y_OFFSET = 80;

// ---- helpers ----------------------------------------------------------------

/** Evenly spread `count` units between `left` and `right`, single unit centered. */
function slotX(index: number, count: number, left: number, right: number): number {
  if (count <= 1) return (left + right) / 2;
  return left + ((right - left) * index) / (count - 1);
}

/** Home Y for a unit of `height` so its bottom edge (feet) sits on GROUND_Y — units have
 *  different heights (party custom 112 / trash 72 / Kenney smaller), so their container
 *  centers (which is what x/y position) differ even though they all read as standing on
 *  one ground line. */
function groundAnchorY(height: number): number {
  return GROUND_Y - height / 2;
}

/** combatEnded fires only on a real end, but its status field is the full CombatStatus union. */
function isFinalStatus(status: CombatStatus): status is 'victory' | 'wipe' {
  return status === 'victory' || status === 'wipe';
}

export class CombatScene extends Phaser.Scene {
  private sceneData!: CombatSceneData;
  private encounter!: EncounterDef;
  private engine!: CombatEngine;

  private partySprites = new Map<string, UnitSprite>();
  private enemySprites = new Map<string, UnitSprite>();

  private spellBar!: SpellBar;

  private playerCastBar!: Bar;
  private playerCastLabel!: Phaser.GameObjects.Text;
  private gcdBar!: Bar;
  private queuedSpellLabel!: Phaser.GameObjects.Text;
  /** Demoted per v0.3 chunk F: unlabeled sliver near the boss, not a named top bar. */
  private bossCastBar!: Bar;
  /** Data-driven wind-up cue for the current encounter's boss ability, resolved once in create(). */
  private bossTelegraphCue: BossTelegraphCue = 'glow';

  private waveText!: Phaser.GameObjects.Text;
  private rewardsText!: Phaser.GameObjects.Text;
  private focusCalloutText!: Phaser.GameObjects.Text;
  private waveBanner!: Phaser.GameObjects.Container;
  private waveBannerText!: Phaser.GameObjects.Text;

  private combatLog!: CombatLog;
  /** id → display name for every unit ever seen this combat — log lines can reference units
   *  already gone from the engine's snapshot (e.g. the kill that ends a wave). */
  private unitNames = new Map<string, string>();
  private toastText!: Phaser.GameObjects.Text;
  /** Scene-side elapsed-ms accumulator (sum of update deltas since combat start) — the engine
   *  has no clock field, so the combat log's [12.3s] timestamps are derived here. */
  private elapsedMs = 0;

  private paceToggle!: PaceToggle;
  private combatPaceTenths = 10;
  private healerRune: Phaser.GameObjects.Triangle | null = null;
  /** Presentation-only DBZ-style aura: intensity from mana spent in the last 30s. */
  private manaAura: ManaSpendAura | null = null;
  /** Wall-clock delta of the last update() tick — drives aura pulse without pacing. */
  private lastFrameDtMs = 16;
  /** v0.3 chunk F "Mana regen tick": healer mana at the end of the previous update() tick —
   *  an upward jump with no castCancelled event this tick is a regen tick, not a cast refund. */
  private lastHealerMana: number | null = null;

  private resultShown = false;
  /** v0.3 chunk G: once-per-combat latch fed to data/banter's detectCloseCall. */
  private closeCallFired = false;
  /** Loaded once in create(); reused at result time for treeRanks (build glyph) — save.treeRanks
   *  cannot change mid-combat, so no need to reload. */
  private save!: SaveData;

  constructor() {
    super(SceneKeys.Combat);
  }

  init(data: CombatSceneData): void {
    this.sceneData = data;
    this.resultShown = false;
    this.closeCallFired = false;
    this.partySprites = new Map();
    this.enemySprites = new Map();
    this.unitNames = new Map();
    this.elapsedMs = 0;
  }

  create(): void {
    const encounter = getEncounterById(this.sceneData.encounterId);
    if (encounter === undefined) {
      throw new Error(`CombatScene: unknown encounter id "${this.sceneData.encounterId}"`);
    }
    this.encounter = encounter;

    const spells = this.sceneData.loadout.spells;

    // Loaded once up front: permanent relics feed the engine at construction, and
    // the same save is reused below for the pace toggle (avoids a second
    // redundant loadSave() call).
    const save = loadSave();
    this.save = save;
    beginRun(this.sceneData.encounterId, save);

    this.engine = new CombatEngine(encounter, spells, {
      bonusMaxMana: this.sceneData.loadout.bonusMaxMana,
      ...(this.sceneData.loadout.manaRegen !== undefined
        ? { manaRegen: this.sceneData.loadout.manaRegen }
        : {}),
      synergies: this.sceneData.loadout.synergies,
      missingHealthBonuses: this.sceneData.loadout.missingHealthBonuses,
      missingHealthPctBonuses: this.sceneData.loadout.missingHealthPctBonuses,
      fullHealthBonuses: this.sceneData.loadout.fullHealthBonuses,
      cooldowns: this.sceneData.loadout.cooldowns,
      relics: relicsById(save.relicIds),
    });

    this.buildGroundLine();
    this.buildPartySprites();
    this.rebuildEnemies(this.engine.state.enemies);
    this.buildHud();
    this.buildCastBars();
    new RunModsBar(this, runModsFromSave(save), { viewWidth: VIEW_WIDTH });

    this.spellBar = new SpellBar(
      this,
      VIEW_WIDTH / 2,
      SPELL_BAR_Y,
      spells,
      this.sceneData.loadout,
      (spellId) => this.onSpellCast(spellId, 'click'),
      VIEW_WIDTH,
      this.sceneData.loadout.cooldowns,
      (cooldownId) => this.onCooldownActivate(cooldownId, 'click'),
    );
    this.registerHotkeys(spells, this.sceneData.loadout.cooldowns);
    this.registerEscapeKey();
    this.registerTabTargetKey();

    const available = this.sceneData.loadout.paceMultipliersTenths;
    this.combatPaceTenths = available.includes(save.combatPaceTenths) ? save.combatPaceTenths : 10;
    this.paceToggle = new PaceToggle(this, PACE_TOGGLE_X, PACE_TOGGLE_Y, (tenths) => {
      this.combatPaceTenths = tenths;
      const current = loadSave();
      current.combatPaceTenths = tenths;
      saveGame(current);
    });
    this.paceToggle.setAvailable(available);
    this.paceToggle.setCurrent(this.combatPaceTenths);

    this.combatLog = new CombatLog(this, VIEW_WIDTH);
    this.buildToast();
    this.manaAura = new ManaSpendAura(this);
    this.bossTelegraphCue = this.resolveBossTelegraphCue();
    this.lastHealerMana = this.engine.state.party.find((u) => u.role === 'healer')?.mana ?? null;

    this.syncView();
  }

  /** Data-driven wind-up cue (handoff "Boss telegraphs") for this encounter's boss ability,
   *  looked up from the same authoring catalogs the content pipeline compiled from — the
   *  compiled EncounterDef/BossCastDef never carries this field (presentation-only, and the
   *  engine stays untouched), so it's resolved here via the boss's stable mobId. */
  private resolveBossTelegraphCue(): BossTelegraphCue {
    const bossMob = MOB_REGISTRY[this.encounter.boss.id];
    const abilityId = bossMob?.abilityIds[0];
    const ability = abilityId !== undefined ? ENEMY_ABILITY_REGISTRY[abilityId] : undefined;
    return ability?.telegraph ?? 'glow';
  }

  update(_time: number, delta: number): void {
    this.lastFrameDtMs = delta;
    const simDelta = Math.max(0, Math.floor((delta * this.combatPaceTenths) / 10));
    this.elapsedMs += simDelta;
    const events = this.engine.advance(simDelta);
    this.handleManaRegenPulse(events);
    this.handleEvents(events);
    this.syncView();
  }

  /** v0.3 chunk F "Mana regen tick": any mana uptick this tick that isn't a castCancelled
   *  refund is a regen tick — pulse the healer's mana bar + float a mote. No new engine event;
   *  this just diffs `state.party` healer mana across ticks (handoff: "prefer listening to
   *  existing mana changes over new systems"). */
  private handleManaRegenPulse(events: CombatEvent[]): void {
    const healerUnit = this.engine.state.party.find((u) => u.role === 'healer');
    if (!healerUnit) return;
    const prev = this.lastHealerMana;
    const curr = healerUnit.mana;
    const hasCancelRefund = events.some((e) => e.type === 'castCancelled');
    if (prev !== null && curr > prev && !hasCancelRefund) {
      this.partySprites.get('healer')?.pulseMana();
    }
    this.lastHealerMana = curr;
  }

  // ---- setup --------------------------------------------------------------

  /** One flat line under the battle line so the facing line reads as standing on shared
   *  ground (handoff §A, optional) — drawn once behind everything else, no animation. */
  private buildGroundLine(): void {
    this.add
      .rectangle(
        VIEW_WIDTH / 2,
        GROUND_Y,
        ENEMY_SLOT_RIGHT - PARTY_SLOT_LEFT + GROUND_LINE_MARGIN * 2,
        GROUND_LINE_WIDTH,
        GROUND_LINE_COLOR,
      )
      .setDepth(-1);
  }

  private buildPartySprites(): void {
    const party = this.engine.state.party;
    party.forEach((unit) => {
      this.unitNames.set(unit.id, unit.name);
      // Presentation-only slot: visual order (healer·dps2·dps1·tank) is looked up by unit
      // id, not array index — the engine's party array order is unchanged (handoff §B).
      const visualIndex = PARTY_VISUAL_ORDER.indexOf(unit.id);
      const x = slotX(
        visualIndex >= 0 ? visualIndex : 0,
        PARTY_VISUAL_ORDER.length,
        PARTY_SLOT_LEFT,
        PARTY_SLOT_RIGHT,
      );
      // Healer: ragged sheet + cast poses. Tank/DPS: PixelLab stills + attack strips
      // (fixed facing). All custom party bodies share one display size.
      const isHealer = unit.role === 'healer';
      const presentation = presentationForUnit(unit);
      const isCustom = isHealer || presentation.kind === 'texture';
      const width = isCustom ? PARTY_CUSTOM_WIDTH : PARTY_KENNEY_WIDTH;
      const height = isCustom ? PARTY_CUSTOM_HEIGHT : PARTY_KENNEY_HEIGHT;
      const y = groundAnchorY(height);
      const attackAnimKey = attackAnimKeyForUnit(unit);
      const bodyOffsetY = isHealer
        ? Math.round(height * HEALER_FOOT_PAD_RATIO)
        : presentation.kind === 'texture'
          ? Math.round(height * PIXELLAB_FOOT_PAD_RATIO)
          : 0;
      const sprite = new UnitSprite(unit, {
        scene: this,
        x,
        y,
        width,
        height,
        ...(isHealer
          ? {
              frame: HEALER_IDLE_FRAME,
              bodyTextureKey: HEALER_SHEET_TEXTURE_KEY,
              bodyOffsetY,
              casterAnim: { idleFrame: HEALER_IDLE_FRAME, castFrames: HEALER_CAST_FRAMES },
            }
          : presentation.kind === 'texture'
            ? {
                bodyTextureKey: presentation.key,
                fixedFacing: true,
                bodyOffsetY,
                ...(attackAnimKey === undefined ? {} : { attackAnimKey }),
              }
            : { frame: presentation.frame }),
        showMana: isHealer,
        clickable: true,
        onClick: (id) => this.onAllyClick(id),
        facing: 'right',
      });
      this.partySprites.set(unit.id, sprite);
    });
  }

  /** Rebuilds the right-hand roster from scratch — called on setup and every waveStarted event. */
  private rebuildEnemies(enemies: Unit[]): void {
    for (const sprite of this.enemySprites.values()) sprite.destroy();
    this.enemySprites.clear();

    const isBoss = enemies.length === 1 && enemies[0]?.role === 'boss';

    enemies.forEach((unit, i) => {
      this.unitNames.set(unit.id, unit.name);
      const x = slotX(i, enemies.length, ENEMY_SLOT_LEFT, ENEMY_SLOT_RIGHT);
      const presentation = presentationForUnit(unit);
      const width = isBoss
        ? BOSS_UNIT_WIDTH
        : presentation.kind === 'texture'
          ? TRASH_CUSTOM_WIDTH
          : TRASH_KENNEY_WIDTH;
      const height = isBoss
        ? BOSS_UNIT_HEIGHT
        : presentation.kind === 'texture'
          ? TRASH_CUSTOM_HEIGHT
          : TRASH_KENNEY_HEIGHT;
      const y = groundAnchorY(height);
      const bodyOffsetY =
        presentation.kind === 'texture' ? Math.round(height * PIXELLAB_FOOT_PAD_RATIO) : 0;
      const sprite = new UnitSprite(unit, {
        scene: this,
        x,
        y,
        width,
        height,
        ...(presentation.kind === 'texture'
          ? { bodyTextureKey: presentation.key, fixedFacing: true, bodyOffsetY }
          : { frame: presentation.frame }),
        showMana: false,
        clickable: false,
        facing: 'left',
      });
      this.enemySprites.set(unit.id, sprite);
    });
  }

  private buildHud(): void {
    this.waveText = this.add
      .text(VIEW_WIDTH / 2, WAVE_TEXT_Y, '', { fontFamily: HUD_FONT, fontSize: '16px', color: '#e8d8c8' })
      .setOrigin(0.5, 0);
    this.rewardsText = this.add
      .text(REWARDS_X, REWARDS_Y, '', { fontFamily: HUD_FONT, fontSize: '14px', color: '#f2c14e' })
      .setOrigin(0, 0);
    this.focusCalloutText = this.add
      .text(VIEW_WIDTH / 2, FOCUS_CALLOUT_Y, '', {
        fontFamily: HUD_FONT,
        fontSize: '15px',
        color: '#e05a4e',
      })
      .setStroke('#0a0605', 3)
      .setOrigin(0.5)
      .setDepth(90)
      .setVisible(false);

    const bannerBg = this.add
      .rectangle(0, 0, WAVE_BANNER_WIDTH, WAVE_BANNER_HEIGHT, 0x241a15, 0.92)
      .setStrokeStyle(2, 0x8a7868);
    this.waveBannerText = this.add
      .text(0, 0, '', { fontFamily: HUD_FONT, fontSize: '22px', color: '#e8d8c8' })
      .setOrigin(0.5);
    this.waveBanner = this.add
      .container(VIEW_WIDTH / 2, WAVE_BANNER_Y, [bannerBg, this.waveBannerText])
      .setDepth(80)
      .setAlpha(0);
  }

  private buildCastBars(): void {
    const centerX = VIEW_WIDTH / 2;

    const playerBarX = centerX - PLAYER_CAST_BAR_WIDTH / 2;
    this.playerCastBar = new Bar(
      this,
      playerBarX,
      PLAYER_CAST_BAR_Y,
      PLAYER_CAST_BAR_WIDTH,
      PLAYER_CAST_BAR_HEIGHT,
      PLAYER_CAST_FILL_COLOR,
    );
    this.playerCastBar.setVisible(false);
    this.playerCastLabel = this.add
      .text(centerX, PLAYER_CAST_BAR_Y, '', { fontFamily: HUD_FONT, fontSize: '13px', color: '#1a1210' })
      .setOrigin(0.5)
      .setVisible(false);

    const gcdY = PLAYER_CAST_BAR_Y + PLAYER_CAST_BAR_HEIGHT / 2 + GCD_BAR_GAP + GCD_BAR_HEIGHT / 2;
    this.gcdBar = new Bar(this, playerBarX, gcdY, PLAYER_CAST_BAR_WIDTH, GCD_BAR_HEIGHT, GCD_FILL_COLOR);
    this.gcdBar.setVisible(false);

    const queuedY = gcdY + GCD_BAR_HEIGHT / 2 + QUEUED_SPELL_GAP;
    this.queuedSpellLabel = this.add
      .text(centerX, queuedY, '', {
        fontFamily: HUD_FONT,
        fontSize: '12px',
        color: QUEUED_SPELL_COLOR,
      })
      .setOrigin(0.5)
      .setVisible(false);

    // v0.3 chunk F: unlabeled sliver, repositioned above the boss sprite each frame in
    // syncBossCastBar() — initial position here is a placeholder, overwritten before it
    // is ever shown (bossCastBar only becomes visible once state.bossCast is non-null).
    this.bossCastBar = new Bar(
      this,
      centerX - BOSS_CAST_BAR_WIDTH / 2,
      BOSS_CAST_BAR_GAP,
      BOSS_CAST_BAR_WIDTH,
      BOSS_CAST_BAR_HEIGHT,
      BOSS_CAST_FILL_COLOR,
    );
    this.bossCastBar.setDepth(46);
    this.bossCastBar.setVisible(false);
  }

  /** Short-lived status line for castCancelled (handoff §D) — only toast source in the scene. */
  private buildToast(): void {
    this.toastText = this.add
      .text(VIEW_WIDTH / 2, TOAST_Y, '', { fontFamily: TOAST_FONT, fontSize: TOAST_FONT_SIZE, color: TOAST_COLOR })
      .setOrigin(0.5)
      .setAlpha(0);
  }

  private showToast(text: string): void {
    this.tweens.killTweensOf(this.toastText);
    this.toastText.setText(text).setAlpha(1);
    this.tweens.add({ targets: this.toastText, alpha: 0, duration: TOAST_FADE_MS });
  }

  /** QWER = spell slots 0–3; Shift+QWER = major CD slots 0–3 (finger columns). */
  private registerHotkeys(spells: SpellDef[], cooldowns: CombatSceneData['loadout']['cooldowns']): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    const actions: Array<(() => void) | undefined> = new Array(MAX_ACTION_HOTKEYS);
    spells.forEach((spell, i) => {
      if (i < ACTION_HOTKEY_LETTERS.length) {
        actions[i] = () => this.onSpellCast(spell.id, 'key');
      }
    });
    cooldowns.forEach((cooldown, i) => {
      if (i < ACTION_HOTKEY_LETTERS.length) {
        actions[ACTION_HOTKEY_LETTERS.length + i] = () => this.onCooldownActivate(cooldown.id, 'key');
      }
    });
    for (const letter of ACTION_HOTKEY_LETTERS) {
      keyboard.on(`keydown-${letter}`, (event: KeyboardEvent) => {
        const slot = actionHotkeySlot(letter, event.shiftKey);
        if (slot === null) return;
        actions[slot]?.();
      });
    }
  }

  /** Escape cancels the active cast + queue (handoff §D); the castCancelled event it emits on
   *  the next advance() drives the toast + log line in handleEvents(). */
  private registerEscapeKey(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    keyboard.on('keydown-ESC', () => {
      if (this.engine.state.status !== 'running') return;
      this.engine.cancelCast();
    });
  }

  /** Tab cycles heal target: tank → dps1 → dps2 → healer → wrap (skips dead). */
  private registerTabTargetKey(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    keyboard.on('keydown-TAB', (event: KeyboardEvent) => {
      event.preventDefault();
      if (this.engine.state.status !== 'running') return;
      const next = nextPartyTargetId(this.engine.state.party, this.engine.state.targetId);
      if (next === null) return;
      this.engine.setTarget(next);
      this.syncView();
    });
  }

  // ---- input ----------------------------------------------------------------

  private onAllyClick(unitId: string): void {
    if (this.engine.state.status !== 'running') return;
    this.engine.setTarget(unitId);
    this.syncView();
  }

  private onSpellCast(spellId: string, source: PressSource): void {
    if (this.engine.state.status !== 'running') return;
    recordPress(spellId, source);
    this.engine.castSpell(spellId);
    this.syncView();
  }

  /** Cooldowns are off-GCD (Alpha 0.1 §D6) — no busy/target checks here; the engine itself
   *  silently ignores unknown ids and re-activation while still on cooldown. */
  private onCooldownActivate(cooldownId: string, source: PressSource): void {
    if (this.engine.state.status !== 'running') return;
    // Count the press even when the CD is still ticking — balance cares about spam.
    recordPress(cooldownId, source);
    const cooldown = this.engine.state.cooldowns.find((state) => state.id === cooldownId);
    if (!cooldown || cooldown.remainingCooldownMs > 0) return;
    this.engine.activateCooldown(cooldownId);
    this.syncView();
  }

  // ---- event feedback --------------------------------------------------------

  private handleEvents(events: CombatEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'damage': {
          const victim = this.findSprite(event.targetId);
          victim?.flashDamage();
          victim?.spawnDamageFloat(event.amount);
          // Guard: the attacker (and/or victim) may already be dead this tick — sprites persist
          // until the next rebuildEnemies(), so the lookup is safe, but the sprite may be absent
          // if it belongs to a roster already replaced by a same-tick waveStarted rebuild.
          const attacker = this.findSprite(event.sourceId);
          if (attacker) {
            const towardX = victim?.getHomeX() ?? attacker.getHomeX();
            // v0.3 chunk F "Tank/DPS attack anims": role-tinted swing strength — tank shoves
            // (bigger lunge + squash), dps double-jabs; enemies/boss/healer keep the shared lunge.
            const attackerUnit = this.engine.state.party.find((u) => u.id === event.sourceId);
            if (attackerUnit?.role === 'tank') attacker.lungeShove(towardX);
            else if (attackerUnit?.role === 'dps') attacker.lungeJab(towardX);
            else attacker.lunge(towardX);
          }
          this.combatLog.push(
            `${this.formatTimestamp()} ${this.resolveUnitName(event.sourceId)} hits ${this.resolveUnitName(event.targetId)} -${event.amount}`,
          );
          break;
        }
        case 'heal': {
          const target = this.findSprite(event.targetId);
          target?.flashHeal();
          target?.spawnHealFloat(event.amount);
          if (target) {
            // v0.3 chunk F "Heal target sparkle": heal-vfx.png replaces the ground ripple as
            // the primary heal-land read — ripple + particles + sparkle all firing together
            // read as noise, and the sparkle centers on the unit rather than the ground.
            showHealSparkle(this, target.getHomeX(), target.getHomeY());
            showHealParticles(this, target.getHomeX(), target.getHomeY());
            shakeHealImpact(this);
          }
          const overheal = event.overheal > 0 ? ` (${event.overheal} over)` : '';
          this.combatLog.push(
            `${this.formatTimestamp()} ${this.resolveSpellName(event.spellId)} heals ${this.resolveUnitName(event.targetId)} +${event.amount}${overheal}`,
          );
          break;
        }
        case 'castStarted': {
          const healer = this.partySprites.get('healer');
          const castTarget = this.findSprite(event.cast.targetId);
          healer?.flashCast();
          // v0.3 chunk F "Healer caster-side anim": any player cast (heals AND Bonk) plays the
          // sheet's cast-pose frames. Instant casts (totalMs === 0, e.g. Bonk) complete inside
          // the SAME advance() call — castFinished arrives this same tick, so a plain
          // setCasting(true) would be invisible; playCastFlourish self-times instead and
          // ignores the castFinished/castCancelled setCasting(false) below.
          if (event.cast.totalMs === 0) {
            healer?.playCastFlourish();
          } else {
            healer?.setCasting(true);
          }
          if (healer && castTarget) {
            showCastBeam(
              this,
              healer.getHomeX(),
              healer.getHomeY(),
              castTarget.getHomeX(),
              castTarget.getHomeY(),
            );
          }
          // Presentation-only spend estimate (base spell cost). Discounts / free
          // charges may mean the engine reserved less — aura is juice, not accounting.
          const castSpell = this.sceneData.loadout.spells.find((s) => s.id === event.cast.spellId);
          if (castSpell && castSpell.mana > 0) {
            this.manaAura?.recordSpend(castSpell.mana, this.elapsedMs);
          }
          break;
        }
        case 'castFinished':
          this.partySprites.get('healer')?.setCasting(false);
          break;
        case 'bossCastStarted': {
          // v0.3 chunk F "Boss telegraphs": wind-up/glow cue on the boss sprite for the
          // bossCastStarted → bossCastFinished window (Tunnel Vision's telegraph phase too —
          // its own crimson focus brand only starts later, at bossFocusStarted, so this never
          // double-signals with it).
          const bossUnit = this.engine.state.enemies.find((u) => u.role === 'boss');
          if (bossUnit) this.findSprite(bossUnit.id)?.startTelegraph(this.bossTelegraphCue);
          break;
        }
        case 'bossCastFinished': {
          shakeBossImpact(this);
          const bossUnit = this.engine.state.enemies.find((u) => u.role === 'boss');
          if (bossUnit) this.findSprite(bossUnit.id)?.stopTelegraph();
          break;
        }
        case 'partyDoTStarted':
          this.focusCalloutText.setText(`${event.name.toUpperCase()} — PARTY BURN`).setVisible(true);
          this.combatLog.push(
            `${this.formatTimestamp()} ${this.encounter.boss.name} scorches the party — ${event.name}!`,
          );
          break;
        case 'partyDoTEnded':
          this.focusCalloutText.setVisible(false).setText('');
          this.combatLog.push(`${this.formatTimestamp()} ${event.name} fades.`);
          break;
        case 'manaBurned':
          this.showToast(`Mana burned (−${event.amount})`);
          this.combatLog.push(
            `${this.formatTimestamp()} ${this.encounter.boss.name} drains ${event.amount} mana!`,
          );
          break;
        case 'bossFocusStarted': {
          // Tunnel Vision channel begins on one party member (alpha-0.1 §D3).
          // The telegraph's bossCastFinished already fired the small shake.
          this.findSprite(event.targetId)?.setBossFocused(true);
          this.focusCalloutText
            .setText(`TUNNEL VISION — FOCUSED: ${this.resolveUnitName(event.targetId)}`)
            .setVisible(true);
          this.combatLog.push(
            `${this.formatTimestamp()} ${this.encounter.boss.name} fixates on ${this.resolveUnitName(event.targetId)} — ${event.name}!`,
          );
          break;
        }
        // No bossFocusTick case: tick HP loss arrives as a normal 'damage'
        // event (float + log line), and 10 extra lines/shakes in 10s is noise.
        case 'bossFocusEnded': {
          this.findSprite(event.targetId)?.setBossFocused(false);
          this.focusCalloutText.setVisible(false).setText('');
          this.combatLog.push(`${this.formatTimestamp()} ${event.name} ends.`);
          break;
        }
        case 'cooldownActivated':
          this.combatLog.push(`${this.formatTimestamp()} ${event.name} activated!`);
          break;
        case 'castCancelled': {
          this.partySprites.get('healer')?.setCasting(false);
          const spellName = this.resolveSpellName(event.spellId);
          if (event.reason === 'escape') {
            this.showToast('Cast cancelled');
            this.combatLog.push(`${this.formatTimestamp()} Cast cancelled: ${spellName} (escape)`);
          } else {
            this.showToast('Cast failed: target died');
            this.combatLog.push(`${this.formatTimestamp()} Cast cancelled: ${spellName} (target died)`);
          }
          break;
        }
        // v0.3 §Coyote: downed / saved / true death. Sprite visuals follow engine state
        // (dying tint, death tint only after the window) — these are just log lines.
        case 'unitDying':
          this.combatLog.push(`${this.formatTimestamp()} ${this.resolveUnitName(event.unitId)} is down — heal to save!`);
          break;
        case 'unitSaved':
          this.combatLog.push(`${this.formatTimestamp()} ${this.resolveUnitName(event.unitId)} was saved!`);
          break;
        case 'unitDied':
          this.combatLog.push(`${this.formatTimestamp()} ${this.resolveUnitName(event.unitId)} died`);
          break;
        case 'waveStarted':
          this.rebuildEnemies(this.engine.state.enemies);
          this.showWaveBanner(event.waveIndex);
          break;
        case 'combatEnded':
          // A channel can be live when the fight ends (e.g. boss dies mid-
          // Tunnel-Vision) — the engine stops before emitting bossFocusEnded,
          // so clear any lingering brand before the overlay.
          this.partySprites.forEach((sprite) => sprite.setBossFocused(false));
          this.focusCalloutText.setVisible(false).setText('');
          if (isFinalStatus(event.status)) {
            finalizeRun(event.status, this.elapsedMs);
            this.showResultOverlay(event.status);
          }
          break;
        default:
          break;
      }
    }
  }

  private findSprite(unitId: string): UnitSprite | undefined {
    return this.partySprites.get(unitId) ?? this.enemySprites.get(unitId);
  }

  /** Resolves a unit id to its display name from the seen-units cache; falls back to the raw id. */
  private resolveUnitName(unitId: string): string {
    return this.unitNames.get(unitId) ?? unitId;
  }

  /** Resolves a spell id to its display name from the player's loadout; falls back to the raw id. */
  private resolveSpellName(spellId: string): string {
    return this.sceneData.loadout.spells.find((s) => s.id === spellId)?.name ?? spellId;
  }

  /** Combat-log timestamp from the scene-side elapsed-ms accumulator, e.g. `[12.3s]`. */
  private formatTimestamp(): string {
    return `[${(this.elapsedMs / 1000).toFixed(1)}s]`;
  }

  /** Presentation-only wave announcement; the engine continues advancing throughout. */
  private showWaveBanner(waveIndex: number): void {
    const label = waveIndex < this.encounter.waves.length ? `WAVE ${waveIndex + 1}` : 'BOSS WAVE';
    this.tweens.killTweensOf(this.waveBanner);
    this.waveBannerText.setText(label);
    this.waveBanner.setAlpha(1);
    this.tweens.add({
      targets: this.waveBanner,
      alpha: 0,
      delay: WAVE_BANNER_HOLD_MS,
      duration: WAVE_BANNER_FADE_MS,
      ease: 'Quad.easeIn',
    });
  }

  // ---- per-frame sync ---------------------------------------------------------

  private syncView(): void {
    const state = this.engine.state;

    for (const unit of state.party) this.partySprites.get(unit.id)?.update(unit);
    for (const unit of state.enemies) this.enemySprites.get(unit.id)?.update(unit);
    for (const [id, sprite] of this.partySprites) sprite.setTargeted(id === state.targetId);

    // v0.3 chunk G: close-call fires mid-combat, the instant any living ally's HP snapshot
    // crosses the threshold (handoff "Close call") — only while still fighting, so it never
    // races the wipe/victory bubble fired from showResultOverlay() below.
    if (state.status === 'running' && detectCloseCall(state.party, this.closeCallFired)) {
      this.closeCallFired = true;
      this.fireBanterBubble('close-call', 'healer');
    }

    this.syncPlayerCastBar(state);
    this.syncBossCastBar(state);

    const healer = state.party.find((u) => u.role === 'healer');
    this.spellBar.setState(
      healer?.mana ?? 0,
      state.targetId !== null,
      state.status === 'running',
      state.enemies.some((e) => e.alive),
    );
    this.spellBar.setArmedSpellIds(state.armedBuffedSpellIds);
    this.spellBar.updateCooldowns(state.cooldowns);
    this.spellBar.updateSpellCooldowns(state.spellCooldowns);
    this.syncHealerRune(state);
    this.syncManaAura();

    this.waveText.setText(
      state.waveIndex < this.encounter.waves.length
        ? `Wave ${state.waveIndex + 1}/${this.encounter.waves.length}`
        : 'Boss',
    );

    const { xp } = this.engine.rewards;
    this.rewardsText.setText(`XP ${xp}`);
  }

  private syncHealerRune(state: CombatState): void {
    const armed = state.armedBuffedSpellIds.length > 0;
    const healerSprite = this.partySprites.get('healer');
    if (!armed || !healerSprite) {
      this.healerRune?.destroy();
      this.healerRune = null;
      return;
    }
    const x = healerSprite.getHomeX() - 36;
    const y = healerSprite.getHomeY() - 24;
    if (!this.healerRune) {
      this.healerRune = this.add
        .triangle(x, y, 0, -7, 6, 3, -6, 3, 0xf2c14e)
        .setStrokeStyle(1, 0x8a7868)
        .setDepth(40);
    } else {
      this.healerRune.setPosition(x, y);
    }
  }

  /** DBZ-style power glow around the healer — intensity from recent mana spend. */
  private syncManaAura(): void {
    const healerSprite = this.partySprites.get('healer');
    if (!this.manaAura || !healerSprite) return;
    this.manaAura.update(
      this.elapsedMs,
      healerSprite.getHomeX(),
      healerSprite.getHomeY(),
      this.lastFrameDtMs,
    );
  }

  private syncPlayerCastBar(state: CombatState): void {
    const cast = state.playerCast;
    if (cast) {
      this.playerCastBar.setRatio(1 - cast.remainingMs / cast.totalMs);
      this.playerCastBar.setVisible(true);
      const spell = this.sceneData.loadout.spells.find((s) => s.id === cast.spellId);
      this.playerCastLabel.setText(spell?.name ?? cast.spellId).setVisible(true);
    } else {
      this.playerCastBar.setVisible(false);
      this.playerCastLabel.setVisible(false);
    }

    if (state.gcdRemainingMs > 0) {
      this.gcdBar.setRatio(1 - state.gcdRemainingMs / GCD_MS);
      this.gcdBar.setVisible(true);
    } else {
      this.gcdBar.setVisible(false);
    }

    if (state.queuedSpellId) {
      const queued = this.sceneData.loadout.spells.find((s) => s.id === state.queuedSpellId);
      this.queuedSpellLabel.setText(`next: ${queued?.name ?? state.queuedSpellId}`).setVisible(true);
    } else {
      this.queuedSpellLabel.setVisible(false);
    }
  }

  /** v0.3 chunk F: unlabeled sliver tracks the boss sprite's position (always the sole enemy
   *  during a boss cast) instead of a fixed top-of-screen bar — the boss's own telegraph cue
   *  (glow/raise/pulse) is the primary teach; the combat log still names the ability. */
  private syncBossCastBar(state: CombatState): void {
    const cast = state.bossCast;
    if (cast) {
      const bossUnit = state.enemies.find((u) => u.role === 'boss');
      const bossSprite = bossUnit ? this.findSprite(bossUnit.id) : undefined;
      if (bossSprite) {
        this.bossCastBar.setPosition(
          bossSprite.getHomeX() - BOSS_CAST_BAR_WIDTH / 2,
          bossSprite.getHomeY() - BOSS_UNIT_HEIGHT / 2 - BOSS_CAST_BAR_GAP,
        );
      }
      this.bossCastBar.setRatio(1 - cast.remainingMs / cast.totalMs);
      this.bossCastBar.setVisible(true);
    } else {
      this.bossCastBar.setVisible(false);
    }
  }

  // ---- end of combat -------------------------------------------------------------

  /**
   * v0.3 chunk G: shows one speech bubble above `speaker`'s sprite with a banter line for
   * (trigger, speaker) — subclass comes from the already-loaded save (`this.save.subclass`),
   * never read from tree/save internals here. No-op if the speaker's sprite is gone (never
   * happens for tank/healer, who persist for the whole fight, but keeps this call site safe).
   */
  private fireBanterBubble(trigger: BanterTrigger, speaker: BanterSpeaker): void {
    const sprite = this.partySprites.get(speaker);
    if (!sprite) return;
    const yOffset = speaker === 'healer' ? BANTER_HEALER_Y_OFFSET : BANTER_TANK_Y_OFFSET;
    const line = pickBanterLine({
      trigger,
      speaker,
      subclass: this.save.subclass,
      rng: Math.random,
    });
    showSpeechBubble(this, {
      x: sprite.getHomeX(),
      y: sprite.getHomeY() - yOffset,
      text: line,
      viewWidth: VIEW_WIDTH,
      viewHeight: VIEW_HEIGHT,
    });
  }

  /**
   * Wipe/victory result flow: a short slide-in transition into a run summary
   * panel (outcome, XP gained this run, build glyph of the lit tree path),
   * replacing the old instant overlay. Persists the run exactly once via
   * pushRecentRun/saveGame in HubScene (same place the run's XP is already
   * banked into save.xp) — CombatScene only *shows* the summary; see
   * HubScene.create() for the persisted RunRecord, built from the same pure
   * buildRunSummary() so the stored glyph matches the one shown here.
   */
  private showResultOverlay(status: 'victory' | 'wipe'): void {
    if (this.resultShown) return;
    this.resultShown = true;

    const { xp } = this.engine.rewards;
    const summary = buildRunSummary({ status, xp, treeRanks: this.save.treeRanks });
    const centerX = VIEW_WIDTH / 2;
    const centerY = VIEW_HEIGHT / 2;

    // ---- transition started ----
    // Party sprites are still on screen underneath everything added below
    // (only alpha-dimmed by the backdrop, never hidden/destroyed) — chunk G's wipe/victory
    // speech bubble fires right here, before the panel's backdrop/slide-in tweens begin, so
    // it's on screen and already fading in while sprites are still fully visible (locked
    // triggers: wipe → tank, victory → healer — see docs/v0.3-handoff.md "Banter").
    this.fireBanterBubble(status === 'wipe' ? 'wipe' : 'victory', status === 'wipe' ? 'tank' : 'healer');

    const backdrop = this.add
      .rectangle(centerX, centerY, VIEW_WIDTH, VIEW_HEIGHT, 0x000000)
      .setDepth(OVERLAY_DEPTH)
      .setInteractive()
      .setAlpha(0);
    this.tweens.add({ targets: backdrop, alpha: OVERLAY_ALPHA, duration: OVERLAY_FADE_MS });

    const panel = this.add
      .rectangle(centerX, centerY - PANEL_SLIDE_OFFSET, PANEL_WIDTH, PANEL_HEIGHT, 0x241a15, 0.96)
      .setStrokeStyle(2, 0x8a7868)
      .setDepth(OVERLAY_DEPTH + 1)
      .setAlpha(0);
    this.tweens.add({
      targets: panel,
      y: centerY,
      alpha: 1,
      delay: PANEL_SLIDE_DELAY_MS,
      duration: PANEL_SLIDE_MS,
      ease: 'Quad.easeOut',
    });

    if (summary.outcomeLabel !== null) {
      const titleText = this.add
        .text(centerX, centerY - 80, summary.outcomeLabel, {
          fontFamily: HUD_FONT,
          fontSize: '36px',
          color: '#f2c14e',
        })
        .setOrigin(0.5)
        .setDepth(OVERLAY_DEPTH + 2)
        .setAlpha(0);
      this.tweens.add({ targets: titleText, alpha: 1, delay: TITLE_DELAY_MS, duration: TITLE_REVEAL_MS });
    }

    const xpText = this.add
      .text(centerX, centerY - 28, `XP +${summary.xpGained}`, {
        fontFamily: HUD_FONT,
        fontSize: '18px',
        color: '#e8d8c8',
      })
      .setOrigin(0.5)
      .setDepth(OVERLAY_DEPTH + 2)
      .setAlpha(0);
    this.tweens.add({ targets: xpText, alpha: 1, delay: XP_DELAY_MS, duration: XP_REVEAL_MS });

    if (hasBuildGlyph(summary.glyph)) {
      const glyphLabel = this.add
        .text(centerX, centerY + 8, 'BUILD', { fontFamily: HUD_FONT, fontSize: '11px', color: '#a89888' })
        .setOrigin(0.5)
        .setDepth(OVERLAY_DEPTH + 2)
        .setAlpha(0);
      const glyphContainer = drawBuildGlyph(this, summary.glyph, {
        x: centerX,
        y: centerY + 55,
        cell: GLYPH_CELL,
        color: GLYPH_COLOR,
      })
        .setDepth(OVERLAY_DEPTH + 2)
        .setAlpha(0);
      this.tweens.add({
        targets: [glyphLabel, glyphContainer],
        alpha: 1,
        delay: GLYPH_DELAY_MS,
        duration: GLYPH_REVEAL_MS,
      });
    }

    const returnButton = this.add
      .rectangle(centerX, centerY + 105, 180, 40, 0x3a2a22)
      .setStrokeStyle(1, 0x0a0605)
      .setDepth(OVERLAY_DEPTH + 2)
      .setInteractive({ useHandCursor: true })
      .setName('combatReturn')
      .setAlpha(0)
      .on('pointerdown', () => {
        const combatResult: CombatResult = { encounterId: this.sceneData.encounterId, status, xp };
        this.scene.start(this.sceneData.returnTo, { combatResult });
      });

    const returnText = this.add
      .text(centerX, centerY + 105, 'Return', { fontFamily: HUD_FONT, fontSize: '16px', color: '#e8d8c8' })
      .setOrigin(0.5)
      .setDepth(OVERLAY_DEPTH + 3)
      .setAlpha(0);

    // All result objects (especially combatReturn) exist immediately; only
    // their presentation is staged, so semantic journey lookup remains stable.
    this.tweens.add({
      targets: [returnButton, returnText],
      alpha: 1,
      delay: RETURN_DELAY_MS,
      duration: RETURN_REVEAL_MS,
    });
  }
}
