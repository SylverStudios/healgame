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
import { frameForUnit } from '../ui/sprites';
import { SpellBar } from '../ui/spellBar';
import { CombatLog } from '../ui/combatLog';
import { shakeBossImpact, showCastBeam, showHealRipple } from '../ui/combatFx';
import { PaceToggle } from '../ui/paceToggle';
import { loadSave, saveGame } from '../save/save';
import { relicById } from '../data/relics';
import type { CombatMods } from '../data/spellTree';

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
  gold: number;
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

// Unit sizes are multiples of the 16px tile so pixels scale evenly
// (party 4×, trash 3×, boss 7× — see docs/research/pixel-art-pipeline.md).
const PARTY_UNIT_WIDTH = 64;
const PARTY_UNIT_HEIGHT = 64;
const TRASH_UNIT_WIDTH = 48;
const TRASH_UNIT_HEIGHT = 48;
const BOSS_UNIT_WIDTH = 112;
const BOSS_UNIT_HEIGHT = 112;

const WAVE_TEXT_Y = 20;
const REWARDS_X = 14;
const REWARDS_Y = 14;

const PLAYER_CAST_BAR_WIDTH = 320;
const PLAYER_CAST_BAR_HEIGHT = 20;
const PLAYER_CAST_BAR_Y = 448;
const PLAYER_CAST_FILL_COLOR = 0xf2c14e;
const GCD_BAR_HEIGHT = 4;
const GCD_BAR_GAP = 3;
const GCD_FILL_COLOR = 0x8a7868;

const BOSS_CAST_BAR_WIDTH = 340;
const BOSS_CAST_BAR_HEIGHT = 20;
const BOSS_CAST_BAR_Y = 54;
const BOSS_CAST_FILL_COLOR = 0xe05a4e;

const SPELL_BAR_Y = 502;

const PACE_TOGGLE_X = 20;
const PACE_TOGGLE_Y = VIEW_HEIGHT - 8;

/** Cast-cancel toast (handoff §D UI row): short-lived line near the player cast bar. */
const TOAST_Y = 420;
const TOAST_FONT = 'monospace';
const TOAST_FONT_SIZE = '14px';
const TOAST_COLOR = '#e8d8c8';
const TOAST_FADE_MS = 1500;

const OVERLAY_DEPTH = 1000;
const OVERLAY_ALPHA = 0.85;

const DIGIT_KEY_NAMES = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'] as const;

const HUD_FONT = 'monospace';

// ---- helpers ----------------------------------------------------------------

/** Evenly spread `count` units between `left` and `right`, single unit centered. */
function slotX(index: number, count: number, left: number, right: number): number {
  if (count <= 1) return (left + right) / 2;
  return left + ((right - left) * index) / (count - 1);
}

/** Home Y for a unit of `height` so its bottom edge (feet) sits on GROUND_Y — units have
 *  different heights (party 64 / trash 48 / boss 112), so their container centers (which is
 *  what x/y position) differ even though they all read as standing on one ground line. */
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
  private bossCastBar!: Bar;
  private bossCastLabel!: Phaser.GameObjects.Text;

  private waveText!: Phaser.GameObjects.Text;
  private rewardsText!: Phaser.GameObjects.Text;

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

  private resultShown = false;

  constructor() {
    super(SceneKeys.Combat);
  }

  init(data: CombatSceneData): void {
    this.sceneData = data;
    this.resultShown = false;
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

    // Loaded once up front: the relic feeds the engine at construction, and
    // the same save is reused below for the pace toggle (avoids a second
    // redundant loadSave() call).
    const save = loadSave();

    this.engine = new CombatEngine(encounter, spells, {
      bonusMaxMana: this.sceneData.loadout.bonusMaxMana,
      synergies: this.sceneData.loadout.synergies,
      missingHealthBonuses: this.sceneData.loadout.missingHealthBonuses,
      missingHealthPctBonuses: this.sceneData.loadout.missingHealthPctBonuses,
      fullHealthBonuses: this.sceneData.loadout.fullHealthBonuses,
      cooldowns: this.sceneData.loadout.cooldowns,
      relic: relicById(save.relicId),
    });

    this.buildGroundLine();
    this.buildPartySprites();
    this.rebuildEnemies(this.engine.state.enemies);
    this.buildHud();
    this.buildCastBars();

    this.spellBar = new SpellBar(
      this,
      VIEW_WIDTH / 2,
      SPELL_BAR_Y,
      spells,
      this.sceneData.loadout,
      (spellId) => this.onSpellCast(spellId),
      VIEW_WIDTH,
      this.sceneData.loadout.cooldowns,
      (cooldownId) => this.onCooldownActivate(cooldownId),
    );
    this.registerHotkeys(spells);
    this.registerEscapeKey();

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

    this.syncView();
  }

  update(_time: number, delta: number): void {
    const simDelta = Math.max(0, Math.floor((delta * this.combatPaceTenths) / 10));
    this.elapsedMs += simDelta;
    const events = this.engine.advance(simDelta);
    this.handleEvents(events);
    this.syncView();
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
    const y = groundAnchorY(PARTY_UNIT_HEIGHT);
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
      const sprite = new UnitSprite(unit, {
        scene: this,
        x,
        y,
        width: PARTY_UNIT_WIDTH,
        height: PARTY_UNIT_HEIGHT,
        frame: frameForUnit(unit),
        showMana: unit.role === 'healer',
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
    const width = isBoss ? BOSS_UNIT_WIDTH : TRASH_UNIT_WIDTH;
    const height = isBoss ? BOSS_UNIT_HEIGHT : TRASH_UNIT_HEIGHT;
    const y = groundAnchorY(height);

    enemies.forEach((unit, i) => {
      this.unitNames.set(unit.id, unit.name);
      const x = slotX(i, enemies.length, ENEMY_SLOT_LEFT, ENEMY_SLOT_RIGHT);
      const sprite = new UnitSprite(unit, {
        scene: this,
        x,
        y,
        width,
        height,
        frame: frameForUnit(unit),
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

    const bossBarX = centerX - BOSS_CAST_BAR_WIDTH / 2;
    this.bossCastBar = new Bar(
      this,
      bossBarX,
      BOSS_CAST_BAR_Y,
      BOSS_CAST_BAR_WIDTH,
      BOSS_CAST_BAR_HEIGHT,
      BOSS_CAST_FILL_COLOR,
    );
    this.bossCastBar.setVisible(false);
    this.bossCastLabel = this.add
      .text(centerX, BOSS_CAST_BAR_Y, '', { fontFamily: HUD_FONT, fontSize: '13px', color: '#1a1210' })
      .setOrigin(0.5)
      .setVisible(false);
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

  private registerHotkeys(spells: SpellDef[]): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    spells.forEach((spell, i) => {
      const keyName = DIGIT_KEY_NAMES[i];
      if (!keyName) return;
      keyboard.on(`keydown-${keyName}`, () => this.onSpellCast(spell.id));
    });
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

  // ---- input ----------------------------------------------------------------

  private onAllyClick(unitId: string): void {
    if (this.engine.state.status !== 'running') return;
    this.engine.setTarget(unitId);
    this.syncView();
  }

  private onSpellCast(spellId: string): void {
    if (this.engine.state.status !== 'running') return;
    this.engine.castSpell(spellId);
    this.syncView();
  }

  /** Cooldowns are off-GCD (Alpha 0.1 §D6) — no busy/target checks here; the engine itself
   *  silently ignores unknown ids and re-activation while still on cooldown. */
  private onCooldownActivate(cooldownId: string): void {
    if (this.engine.state.status !== 'running') return;
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
          if (attacker) attacker.lunge(victim?.getHomeX() ?? attacker.getHomeX());
          this.combatLog.push(
            `${this.formatTimestamp()} ${this.resolveUnitName(event.sourceId)} hits ${this.resolveUnitName(event.targetId)} -${event.amount}`,
          );
          break;
        }
        case 'heal': {
          const target = this.findSprite(event.targetId);
          target?.flashHeal();
          target?.spawnHealFloat(event.amount);
          if (target) showHealRipple(this, target.getHomeX(), GROUND_Y);
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
          if (healer && castTarget) {
            showCastBeam(
              this,
              healer.getHomeX(),
              healer.getHomeY(),
              castTarget.getHomeX(),
              castTarget.getHomeY(),
            );
          }
          break;
        }
        case 'bossCastFinished':
          shakeBossImpact(this);
          break;
        case 'bossFocusStarted': {
          // Tunnel Vision channel begins on one party member (alpha-0.1 §D3).
          // The telegraph's bossCastFinished already fired the small shake.
          this.findSprite(event.targetId)?.setBossFocused(true);
          this.combatLog.push(
            `${this.formatTimestamp()} ${this.encounter.boss.name} fixates on ${this.resolveUnitName(event.targetId)} — ${event.name}!`,
          );
          break;
        }
        // No bossFocusTick case: tick HP loss arrives as a normal 'damage'
        // event (float + log line), and 10 extra lines/shakes in 10s is noise.
        case 'bossFocusEnded': {
          this.findSprite(event.targetId)?.setBossFocused(false);
          this.combatLog.push(`${this.formatTimestamp()} ${event.name} ends.`);
          break;
        }
        case 'cooldownActivated':
          this.combatLog.push(`${this.formatTimestamp()} ${event.name} activated!`);
          break;
        case 'relicTriggered':
          this.combatLog.push(`${this.formatTimestamp()} ${event.name} triggers!`);
          break;
        case 'castCancelled': {
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
        case 'waveStarted':
          this.rebuildEnemies(this.engine.state.enemies);
          break;
        case 'combatEnded':
          // A channel can be live when the fight ends (e.g. boss dies mid-
          // Tunnel-Vision) — the engine stops before emitting bossFocusEnded,
          // so clear any lingering brand before the overlay.
          this.partySprites.forEach((sprite) => sprite.setBossFocused(false));
          if (isFinalStatus(event.status)) this.showResultOverlay(event.status);
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

  // ---- per-frame sync ---------------------------------------------------------

  private syncView(): void {
    const state = this.engine.state;

    for (const unit of state.party) this.partySprites.get(unit.id)?.update(unit);
    for (const unit of state.enemies) this.enemySprites.get(unit.id)?.update(unit);
    for (const [id, sprite] of this.partySprites) sprite.setTargeted(id === state.targetId);

    this.syncPlayerCastBar(state);
    this.syncBossCastBar(state);

    const healer = state.party.find((u) => u.role === 'healer');
    this.spellBar.setState(healer?.mana ?? 0, state.targetId !== null, state.status === 'running');
    this.spellBar.setArmedSpellIds(state.armedBuffedSpellIds);
    this.spellBar.updateCooldowns(state.cooldowns);
    this.syncHealerRune(state);

    this.waveText.setText(
      state.waveIndex < this.encounter.waves.length
        ? `Wave ${state.waveIndex + 1}/${this.encounter.waves.length}`
        : 'Boss',
    );

    const { gold, xp } = this.engine.rewards;
    this.rewardsText.setText(`Gold ${gold}   XP ${xp}`);
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
  }

  private syncBossCastBar(state: CombatState): void {
    const cast = state.bossCast;
    if (cast) {
      this.bossCastBar.setRatio(1 - cast.remainingMs / cast.totalMs);
      this.bossCastBar.setVisible(true);
      this.bossCastLabel.setText(cast.name).setVisible(true);
    } else {
      this.bossCastBar.setVisible(false);
      this.bossCastLabel.setVisible(false);
    }
  }

  // ---- end of combat -------------------------------------------------------------

  private showResultOverlay(status: 'victory' | 'wipe'): void {
    if (this.resultShown) return;
    this.resultShown = true;

    const { gold, xp } = this.engine.rewards;
    const centerX = VIEW_WIDTH / 2;
    const centerY = VIEW_HEIGHT / 2;

    this.add
      .rectangle(centerX, centerY, VIEW_WIDTH, VIEW_HEIGHT, 0x000000, OVERLAY_ALPHA)
      .setDepth(OVERLAY_DEPTH)
      .setInteractive();

    const title = status === 'victory' ? 'VICTORY' : 'YOU WIPED';
    const titleColor = status === 'victory' ? '#f2c14e' : '#e05a4e';
    this.add
      .text(centerX, centerY - 60, title, { fontFamily: HUD_FONT, fontSize: '36px', color: titleColor })
      .setOrigin(0.5)
      .setDepth(OVERLAY_DEPTH + 1);

    this.add
      .text(centerX, centerY - 10, `Gold +${gold}   XP +${xp}`, {
        fontFamily: HUD_FONT,
        fontSize: '18px',
        color: '#e8d8c8',
      })
      .setOrigin(0.5)
      .setDepth(OVERLAY_DEPTH + 1);

    this.add
      .rectangle(centerX, centerY + 60, 180, 44, 0x3a2a22)
      .setStrokeStyle(1, 0x0a0605)
      .setDepth(OVERLAY_DEPTH + 1)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        const combatResult: CombatResult = { encounterId: this.sceneData.encounterId, status, gold, xp };
        this.scene.start(this.sceneData.returnTo, { combatResult });
      });

    this.add
      .text(centerX, centerY + 60, 'Return', { fontFamily: HUD_FONT, fontSize: '16px', color: '#e8d8c8' })
      .setOrigin(0.5)
      .setDepth(OVERLAY_DEPTH + 2);
  }
}
