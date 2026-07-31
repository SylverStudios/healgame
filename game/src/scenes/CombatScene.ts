/**
 * Facing-line combat view (poc-spec §4). Drives CombatEngine via
 * update()/advance(delta); party left / enemies right; spell bar along bottom.
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
import { GCD_MS, SPELLS } from '../data/constants';
import { Bar } from '../ui/bar';
import { UnitSprite } from '../ui/unitSprite';
import { battlefieldForEncounter, buildBattlefield, platformStanceY } from '../ui/battlefield';
import {
  attackAnimKeyForUnit,
  HEALER_CAST_RELEASE_LEAD_MS,
  HEALER_CAST_STYLE_ANIMS,
  HEALER_IDLE_ANIM_KEY,
  HEALER_IDLE_FRAME,
  HEALER_SHEET_TEXTURE_KEY,
  HEALER_VOWSTRIKE_ANIM_KEY,
  HEALER_VOWSTRIKE_IMPACT_LEAD_MS,
  HEALER_ZAP_ANIM_KEY,
  HEALER_ZAP_IMPACT_LEAD_MS,
  healerCastStyleForSpell,
  hurtAnimKeyForUnit,
  isVowstrikeSpell,
  presentationForUnit,
} from '../ui/sprites';
import { SpellBar } from '../ui/spellBar';
import { CAST_BAR_FRAME_FILL_INSET, CAST_BAR_FRAME_TEXTURE_KEY } from '../ui/spellSprites';
import { addBanner, addPanel } from '../ui/panels';
import {
  OVERLAY_DEPTH, OVERLAY_ALPHA, OVERLAY_FADE_MS, PANEL_WIDTH, PANEL_HEIGHT, PANEL_SLIDE_OFFSET,
  PANEL_SLIDE_DELAY_MS, PANEL_SLIDE_MS, TITLE_DELAY_MS, TITLE_REVEAL_MS, XP_DELAY_MS, XP_REVEAL_MS,
  LEVEL_UP_DELAY_MS, LEVEL_UP_REVEAL_MS, GLYPH_DELAY_MS, GLYPH_REVEAL_MS, GLYPH_CELL, GLYPH_COLOR,
  mountResultReturn,
} from '../ui/resultPanel';
import { CombatLog } from '../ui/combatLog';
import { FONT, FONT_SIZE_XS, FONT_SIZE_SM, FONT_SIZE_MD, FONT_SIZE_LG } from '../ui/theme';
import {
  ManaSpendAura,
  shakeBossImpact,
  shakeHealImpact,
  showCastBeam,
  showHealParticles,
  showHealSparkle,
  showZapImpact,
} from '../ui/combatFx';
import { showArrowHit } from '../ui/arrowHitFx';
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
import { pickBanterLine, type BanterSpeaker, type BanterTrigger } from '../data/banter';
import {
  freshMidCombatBanterLatches,
  pickMidCombatBanter,
  type MidCombatBanterLatches,
} from '../ui/midCombatBanter';
import { showSpeechBubble } from '../ui/speechBubble';
import { presentNoTargetHealCue } from '../ui/noTargetHealCue';
import { liveBonkBuffNotes } from '../ui/bonkStacksIcon';
import {
  syncHealerCues,
  emptyHealerCueHandles,
  type HealerCueHandles,
} from '../ui/healerCues';
import { portraitTextureKey, revealResultPortrait } from '../ui/portraitSprites';
import { chunkyWipeIn, fadeToScene } from '../ui/transitions';
import { EnemyCastBars } from '../ui/enemyCastBars';
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

// Side-view facing line: party left, enemies right, shared ground Y (see groundAnchorY).
const GROUND_Y = 340;
const PARTY_SLOT_LEFT = 80;
const PARTY_SLOT_RIGHT = 380;
const ENEMY_SLOT_LEFT = 580;
const ENEMY_SLOT_RIGHT = 880;

/** Engine party order is tank → dps1 → dps2 → healer (unchanged); visual left→right
 *  order is healer · dps2 · dps1 · tank so the tank stands nearest the enemy line
 *  (handoff §B). Presentation-only — index into this array, never reorder the engine's. */
const PARTY_VISUAL_ORDER = ['healer', 'dps2', 'dps1', 'tank'];

// Display: legacy padded mercs 112 (none left in the live party); tight
// 32×32 (healer/tank/dps1/dps2/ash-husk) 64; Kenney party 48 / trash 32.
const PARTY_MERC_WIDTH = 112;
const PARTY_MERC_HEIGHT = 112;
const PARTY_HEALER_WIDTH = 64;
const PARTY_HEALER_HEIGHT = 64;
const PARTY_TIGHT_MERC_WIDTH = 64; // native×2
const PARTY_TIGHT_MERC_HEIGHT = 64;
const PARTY_KENNEY_WIDTH = 48;
const PARTY_KENNEY_HEIGHT = 48;
const TRASH_CUSTOM_WIDTH = 64; // tight 32→2× (healer density)
const TRASH_CUSTOM_HEIGHT = 64;
/** Foot pad as fraction of display height: legacy padded ~23/92, tight native ~2/32. */
const PIXELLAB_FOOT_PAD_RATIO = 23 / 92;
const TIGHT_FOOT_PAD_RATIO = 2 / 32;
const HEALER_FOOT_PAD_RATIO = TIGHT_FOOT_PAD_RATIO;
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
/** One-line "next: …" under the cast bar when a spell is queued. */
const QUEUED_SPELL_GAP = 6;
const QUEUED_SPELL_COLOR = '#a89888';

// v0.3 chunk F "Boss telegraphs" (E3-generalized): the demoted cast sliver now
// serves ANY casting enemy — geometry/pooling live in ui/enemyCastBars.ts.
/** Softer camera nudge when a trash cast lands (the boss keeps shakeBossImpact). */
const TRASH_CAST_SHAKE_DURATION_MS = 90;
const TRASH_CAST_SHAKE_INTENSITY = 0.002;

const SPELL_BAR_Y = 508;

const PACE_TOGGLE_X = 20;
const PACE_TOGGLE_Y = VIEW_HEIGHT - 8;

/** Cast-cancel toast (handoff §D UI row): short-lived line just above the player cast bar. */
const TOAST_Y = 368;
const TOAST_FONT_SIZE = FONT_SIZE_SM;
const TOAST_COLOR = '#e8d8c8';
const TOAST_FADE_MS = 1500;

// Wipe/victory panel constants: ui/resultPanel.ts (max-lines).
// Banter Y offsets clear HP/mana bars; showSpeechBubble adds its own tail gap.
const BANTER_HEALER_Y_OFFSET = 100;
const BANTER_TANK_Y_OFFSET = 80;

// ---- helpers ----------------------------------------------------------------

/** Evenly spread `count` units between `left` and `right`, single unit centered. */
function slotX(index: number, count: number, left: number, right: number): number {
  if (count <= 1) return (left + right) / 2;
  return left + ((right - left) * index) / (count - 1);
}

/** Home Y for a unit of `height` so its bottom edge (feet) sits at the platform's widest
 *  point (platformStanceY, not GROUND_Y — that still anchors the arch/haze backdrop math
 *  in battlefield.ts) — units have different heights, so their centers differ even though
 *  they all read as standing on one line. */
function groundAnchorY(height: number): number {
  return platformStanceY(GROUND_Y) - height / 2;
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
  private queuedSpellLabel!: Phaser.GameObjects.Text;
  /** Demoted per v0.3 chunk F, generalized in E3: one unlabeled sliver per active
   *  enemy caster (boss or trash), pooled by caster id (see ui/enemyCastBars.ts). */
  private enemyCastBars!: EnemyCastBars;

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
  // Overhead healer cues (rune + Battle Mend + Blessed Bonk stacks); icon id backs the stack cue.
  private healerCues: HealerCueHandles = emptyHealerCueHandles();
  private bonkStackIconSpellId = 'bonk';
  /** Presentation-only DBZ-style aura: intensity from mana spent in the last 30s. */
  private manaAura: ManaSpendAura | null = null;
  /** Wall-clock delta of the last update() tick — drives aura pulse without pacing. */
  private lastFrameDtMs = 16;
  /** v0.3 chunk F "Mana regen tick": healer mana at the end of the previous update() tick —
   *  an upward jump with no castCancelled event this tick is a regen tick, not a cast refund. */
  private lastHealerMana: number | null = null;

  private resultShown = false;
  /** Once-per-fight mid-combat banter latches (close-call + Wave 1 coaching). */
  private banterLatches: MidCombatBanterLatches = freshMidCombatBanterLatches();
  /** Spell/CD command issued this fight (even if rejected) — gates idle-coach. */
  private healerHasActed = false;
  /** Heal event applied this fight (healer-cast only; overheal counts) — gates tank-coach. */
  private healerHasHealed = false;
  /** Sim-ms of last no-target heal WHO bubble (Wave 4b / J15); null = never this fight. */
  private noTargetHealCueAtMs: number | null = null;
  /** Loaded once in create(); reused at result time for treeRanks (build glyph) — save.treeRanks
   *  cannot change mid-combat, so no need to reload. */
  private save!: SaveData;

  constructor() {
    super(SceneKeys.Combat);
  }

  init(data: CombatSceneData): void {
    this.sceneData = data;
    this.resultShown = false;
    this.banterLatches = freshMidCombatBanterLatches();
    this.healerHasActed = false;
    this.healerHasHealed = false;
    this.noTargetHealCueAtMs = null;
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
    this.bonkStackIconSpellId =
      spells.find((s) => s.castBuff?.kind === 'stackNextHealPotencyPct')?.id ?? 'bonk';

    // Loaded once: relics feed engine + reused for pace toggle (avoids a second loadSave() call).
    const save = loadSave();
    this.save = save;
    beginRun(this.sceneData.encounterId, save);

    const relicsList = relicsById(save.relicIds);
    const relicBonusHealing = relicsList
      .flatMap((r) => r.effects)
      .reduce((s, e) => s + (e.kind === 'bonusHealing' ? e.amount : 0), 0);

    const lo = this.sceneData.loadout;
    this.engine = new CombatEngine(encounter, spells, {
      bonusMaxMana: lo.bonusMaxMana,
      ...(lo.bonusMaxHp !== undefined ? { bonusMaxHp: lo.bonusMaxHp } : {}),
      ...(lo.manaRegen !== undefined ? { manaRegen: lo.manaRegen } : {}),
      synergies: lo.synergies,
      ...(lo.manaSynergies !== undefined ? { manaSynergies: lo.manaSynergies } : {}),
      missingHealthBonuses: lo.missingHealthBonuses,
      missingHealthPctBonuses: lo.missingHealthPctBonuses,
      fullHealthBonuses: lo.fullHealthBonuses,
      cooldowns: lo.cooldowns,
      relics: relicsList,
    });

    buildBattlefield(this, battlefieldForEncounter(this.sceneData.encounterId), {
      viewWidth: VIEW_WIDTH,
      viewHeight: VIEW_HEIGHT,
      groundY: GROUND_Y,
      partyCenterX: (PARTY_SLOT_LEFT + PARTY_SLOT_RIGHT) / 2,
      enemyCenterX: (ENEMY_SLOT_LEFT + ENEMY_SLOT_RIGHT) / 2,
    });
    // Enemy cast slivers: pooled per caster (ui/enemyCastBars.ts). Built before rebuildEnemies
    // so the first wave's anchor heights land in the pool.
    this.enemyCastBars = new EnemyCastBars(this);
    this.buildPartySprites();
    this.rebuildEnemies(this.engine.state.enemies);
    this.buildHud();
    this.buildCastBars();
    new RunModsBar(this, runModsFromSave(save));

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
      {
        ...(relicBonusHealing > 0 ? { bonusHealing: relicBonusHealing } : {}),
        getActiveFlatHealBonus: (spellId) => this.computeActiveFlatHealBonus(spellId),
        getLiveBuffNotes: (spellId) =>
          liveBonkBuffNotes(this.engine.state, this.sceneData.loadout.spells, spellId),
      },
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
    this.lastHealerMana = this.engine.state.party.find((u) => u.role === 'healer')?.mana ?? null;

    this.syncView();
    chunkyWipeIn(this, VIEW_WIDTH, VIEW_HEIGHT); // chunk 6: "into battle" reveal
  }

  /** Data-driven wind-up cue (handoff "Boss telegraphs", E3-generalized to any caster) for a mob's
   *  telegraphed ability, looked up from the same authoring catalogs the content pipeline compiled
   *  from — the compiled EncounterDef/BossCastDef never carries this field (presentation-only,
   *  engine untouched). Resolves by the CASTER's mobId (boss unit's mobId equals its catalog id;
   *  trash carry their group's mobId), so trash and boss share one telegraph path. */
  private resolveTelegraphCueForMob(mobId: string | undefined): BossTelegraphCue {
    const mob = mobId !== undefined ? MOB_REGISTRY[mobId] : undefined;
    const abilityId = mob?.abilityIds[0];
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

  private buildPartySprites(): void {
    const party = this.engine.state.party;
    party.forEach((unit) => {
      this.unitNames.set(unit.id, unit.name);
      // Visual order is healer·dps2·dps1·tank; engine party order unchanged (handoff §B).
      const visualIndex = PARTY_VISUAL_ORDER.indexOf(unit.id);
      const x = slotX(
        visualIndex >= 0 ? visualIndex : 0,
        PARTY_VISUAL_ORDER.length,
        PARTY_SLOT_LEFT,
        PARTY_SLOT_RIGHT,
      );
      // Healer/tank/dps1/dps2: tight 32→64. No more legacy padded 112 party mercs.
      const isHealer = unit.role === 'healer';
      const isTightMerc = unit.id === 'tank' || unit.id === 'dps1' || unit.id === 'dps2';
      const presentation = presentationForUnit(unit);
      const isLegacyMerc = presentation.kind === 'texture' && !isTightMerc;
      const width = isHealer ? PARTY_HEALER_WIDTH : isTightMerc ? PARTY_TIGHT_MERC_WIDTH : isLegacyMerc ? PARTY_MERC_WIDTH : PARTY_KENNEY_WIDTH;
      const height = isHealer ? PARTY_HEALER_HEIGHT : isTightMerc ? PARTY_TIGHT_MERC_HEIGHT : isLegacyMerc ? PARTY_MERC_HEIGHT : PARTY_KENNEY_HEIGHT;
      const y = groundAnchorY(height);
      const attackAnimKey = attackAnimKeyForUnit(unit);
      const hurtAnimKey = hurtAnimKeyForUnit(unit);
      const bodyOffsetY = isHealer || isTightMerc
        ? Math.round(height * HEALER_FOOT_PAD_RATIO)
        : isLegacyMerc
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
              fixedFacing: true,
              idleAnimKey: HEALER_IDLE_ANIM_KEY,
              zapAnimKey: HEALER_ZAP_ANIM_KEY,
              vowstrikeAnimKey: HEALER_VOWSTRIKE_ANIM_KEY,
              casterAnim: {
                styles: HEALER_CAST_STYLE_ANIMS,
              },
            }
          : presentation.kind === 'texture'
            ? {
                bodyTextureKey: presentation.key,
                fixedFacing: true,
                bodyOffsetY,
                ...(attackAnimKey === undefined ? {} : { attackAnimKey }),
                ...(hurtAnimKey === undefined ? {} : { hurtAnimKey }),
              }
            : { frame: presentation.frame }),
        showMana: isHealer,
        showName: true,
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
    // Cast bars belong to the outgoing sprites — a cast can't survive its caster's
    // wave, so destroy the whole pool and rebuild anchor heights from scratch.
    this.enemyCastBars?.reset();
    const isBoss = enemies.length === 1 && enemies[0]?.role === 'boss';
    enemies.forEach((unit, i) => {
      this.unitNames.set(unit.id, unit.name);
      const presentation = presentationForUnit(unit);
      const custom = presentation.kind === 'texture';
      const width = isBoss ? BOSS_UNIT_WIDTH : custom ? TRASH_CUSTOM_WIDTH : TRASH_KENNEY_WIDTH;
      const height = isBoss ? BOSS_UNIT_HEIGHT : custom ? TRASH_CUSTOM_HEIGHT : TRASH_KENNEY_HEIGHT;
      this.enemyCastBars.setAnchorHeight(unit.id, height);
      const attackAnimKey = attackAnimKeyForUnit(unit);
      const hurtAnimKey = hurtAnimKeyForUnit(unit);
      this.enemySprites.set(
        unit.id,
        new UnitSprite(unit, {
          scene: this,
          x: slotX(i, enemies.length, ENEMY_SLOT_LEFT, ENEMY_SLOT_RIGHT),
          y: groundAnchorY(height),
          width,
          height,
          ...(custom
            ? {
                bodyTextureKey: presentation.key,
                fixedFacing: true,
                bodyOffsetY: Math.round(height * TIGHT_FOOT_PAD_RATIO),
              }
            : { frame: presentation.frame }),
          ...(attackAnimKey === undefined ? {} : { attackAnimKey }),
          ...(hurtAnimKey === undefined ? {} : { hurtAnimKey }),
          showMana: false,
          clickable: false,
          facing: 'left',
        }),
      );
    });
  }

  private buildHud(): void {
    this.waveText = this.add
      .text(VIEW_WIDTH / 2, WAVE_TEXT_Y, '', { fontFamily: FONT, fontSize: FONT_SIZE_SM, color: '#e8d8c8' })
      .setOrigin(0.5, 0);
    this.rewardsText = this.add
      .text(REWARDS_X, REWARDS_Y, '', { fontFamily: FONT, fontSize: FONT_SIZE_SM, color: '#f2c14e' })
      .setOrigin(0, 0);
    this.focusCalloutText = this.add
      .text(VIEW_WIDTH / 2, FOCUS_CALLOUT_Y, '', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: '#e05a4e',
      })
      .setStroke('#0a0605', 3)
      .setOrigin(0.5)
      .setDepth(90)
      .setVisible(false);

    // Chunk 4 (bible item 4): shared panel/button/banner kit — ui/panels.ts.
    // Local (0,0) position: this frame's own container is re-parented into
    // `waveBanner` below, which owns the on-screen position + show/hide tween.
    const bannerFrame = addBanner(this, 0, 0, WAVE_BANNER_WIDTH, WAVE_BANNER_HEIGHT, { fillAlpha: 0.92 });
    this.waveBannerText = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: FONT_SIZE_MD, color: '#e8d8c8' })
      .setOrigin(0.5);
    this.waveBanner = this.add
      .container(VIEW_WIDTH / 2, WAVE_BANNER_Y, [bannerFrame.container, this.waveBannerText])
      .setDepth(80)
      .setAlpha(0);
  }

  private buildCastBars(): void {
    const centerX = VIEW_WIDTH / 2;

    const playerBarX = centerX - PLAYER_CAST_BAR_WIDTH / 2;
    // Player bar is framed; boss sliver stays unframed (too thin). GCD is the radial wipe on buttons.
    this.playerCastBar = new Bar(
      this,
      playerBarX,
      PLAYER_CAST_BAR_Y,
      PLAYER_CAST_BAR_WIDTH,
      PLAYER_CAST_BAR_HEIGHT,
      PLAYER_CAST_FILL_COLOR,
      undefined,
      CAST_BAR_FRAME_TEXTURE_KEY,
      CAST_BAR_FRAME_FILL_INSET,
    );
    this.playerCastBar.setVisible(false);
    this.playerCastLabel = this.add
      .text(centerX, PLAYER_CAST_BAR_Y, '', { fontFamily: FONT, fontSize: FONT_SIZE_SM, color: '#1a1210' })
      .setOrigin(0.5)
      .setVisible(false);

    const queuedY = PLAYER_CAST_BAR_Y + PLAYER_CAST_BAR_HEIGHT / 2 + QUEUED_SPELL_GAP;
    this.queuedSpellLabel = this.add
      .text(centerX, queuedY, '', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_XS,
        color: QUEUED_SPELL_COLOR,
      })
      .setOrigin(0.5)
      .setVisible(false);
  }

  /** Short-lived status line for castCancelled (handoff §D) — only toast source in the scene. */
  private buildToast(): void {
    this.toastText = this.add
      .text(VIEW_WIDTH / 2, TOAST_Y, '', { fontFamily: FONT, fontSize: TOAST_FONT_SIZE, color: TOAST_COLOR })
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
    this.healerHasActed = true; // idle-coach: command issued even if cast rejected
    recordPress(spellId, source);
    // J15: heal + no ally target → healer WHO bubble (rate-limited; engine unchanged).
    const healer = this.partySprites.get('healer');
    this.noTargetHealCueAtMs = presentNoTargetHealCue({
      scene: this,
      spell: this.sceneData.loadout.spells.find((s) => s.id === spellId),
      allyTargetId: this.engine.state.targetId,
      nowMs: this.elapsedMs,
      lastFiredAtMs: this.noTargetHealCueAtMs,
      healerHome: healer ? { x: healer.getHomeX(), y: healer.getHomeY() } : null,
      yOffset: BANTER_HEALER_Y_OFFSET,
      viewWidth: VIEW_WIDTH,
      viewHeight: VIEW_HEIGHT,
    });
    this.engine.castSpell(spellId);
    this.syncView();
  }

  /** Cooldowns are off-GCD (Alpha 0.1 §D6) — no busy/target checks here; the engine itself
   *  silently ignores unknown ids and re-activation while still on cooldown. */
  private onCooldownActivate(cooldownId: string, source: PressSource): void {
    if (this.engine.state.status !== 'running') return;
    // Count the press even when the CD is still ticking — balance cares about spam.
    this.healerHasActed = true; // idle-coach: key/click counts as a command
    recordPress(cooldownId, source);
    const cooldown = this.engine.state.cooldowns.find((state) => state.id === cooldownId);
    if (!cooldown || cooldown.remainingCooldownMs > 0) return;
    this.engine.activateCooldown(cooldownId);
    this.syncView();
  }

  // ---- event feedback --------------------------------------------------------

  private handleEvents(events: CombatEvent[]): void {
    // Bonk / Vowstrike: same-tick castStarted+damage — defer hit juice to climax frame.
    let pendingHealerImpact: { leadMs: number; showZapVfx: boolean } | null = null;
    for (const event of events) {
      switch (event.type) {
        case 'damage': {
          const victim = this.findSprite(event.targetId);
          // Guard: attacker/victim sprites may already be gone after a same-tick wave rebuild.
          const attacker = this.findSprite(event.sourceId);
          if (pendingHealerImpact && victim) {
            const { leadMs, showZapVfx } = pendingHealerImpact;
            const amount = event.amount;
            const x = victim.getHomeX();
            const y = victim.getHomeY();
            this.time.delayedCall(leadMs, () => {
              victim.flashDamage();
              victim.spawnDamageFloat(amount);
              victim.playHurt();
              if (showZapVfx) showZapImpact(this, x, y);
            });
            pendingHealerImpact = null;
          } else {
            if (attacker) {
              const source =
                this.engine.state.party.find((u) => u.id === event.sourceId) ??
                this.engine.state.enemies.find((u) => u.id === event.sourceId);
              if (source && attackAnimKeyForUnit(source)) attacker.playAttack();
              else attacker.lunge(victim?.getHomeX() ?? attacker.getHomeX());
            }
            const applyHit = () => {
              victim?.flashDamage();
              victim?.spawnDamageFloat(event.amount);
              victim?.playHurt();
            };
            // presentation: archer stuck-arrow VFX (optional)
            if (event.sourceId === 'dps2' && victim) {
              showArrowHit(this, {
                targetX: victim.getHomeX(),
                targetY: victim.getHomeY(),
                onContact: applyHit,
              });
            } else applyHit();
          }
          this.combatLog.push(
            `${this.formatTimestamp()} ${this.resolveUnitName(event.sourceId)} hits ${this.resolveUnitName(event.targetId)} -${event.amount}`,
          );
          break;
        }
        case 'heal': {
          this.healerHasHealed = true; // tank-coach: heal event = healer heal applied
          const target = this.findSprite(event.targetId);
          // Float shows the full cast (applied + overheal) so overheal still reads as a big heal.
          const rawHeal = event.amount + event.overheal;
          target?.flashHeal();
          target?.spawnHealFloat(rawHeal);
          if (target) {
            // Sparkle centers on unit; quieter than ripple + particles combo.
            showHealSparkle(this, target.getHomeX(), target.getHomeY());
            showHealParticles(this, target.getHomeX(), target.getHomeY());
            shakeHealImpact(this);
          }
          this.combatLog.push(
            `${this.formatTimestamp()} ${this.resolveSpellName(event.spellId)} heals ${this.resolveUnitName(event.targetId)} +${rawHeal}`,
          );
          break;
        }
        case 'castStarted': {
          const healer = this.partySprites.get('healer');
          const castTarget = this.findSprite(event.cast.targetId);
          const castSpell = this.sceneData.loadout.spells.find((s) => s.id === event.cast.spellId);
          healer?.flashCast();
          if (event.cast.spellId === SPELLS.bonk.id) {
            healer?.playZap();
            pendingHealerImpact = { leadMs: HEALER_ZAP_IMPACT_LEAD_MS, showZapVfx: true };
          } else if (isVowstrikeSpell(event.cast.spellId)) {
            healer?.playVowstrike();
            pendingHealerImpact = { leadMs: HEALER_VOWSTRIKE_IMPACT_LEAD_MS, showZapVfx: false };
          } else {
            healer?.setCastStyle(healerCastStyleForSpell(event.cast.spellId));
            if (event.cast.totalMs === 0) healer?.playCastRelease();
            else healer?.setCasting(true);
          }
          // Heal beam only — damage spells (Bonk / Vowstrike) use body/VFX reads.
          if (healer && castTarget && castSpell && castSpell.heal > 0) {
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
          if (castSpell && castSpell.mana > 0) {
            this.manaAura?.recordSpend(castSpell.mana, this.elapsedMs);
          }
          break;
        }
        case 'castFinished':
          // Skip Bonk / Vowstrike — their attack strips are already playing.
          if (event.spellId !== SPELLS.bonk.id && !isVowstrikeSpell(event.spellId)) {
            this.partySprites.get('healer')?.finishCast();
          }
          break;
        case 'bossCastStarted': {
          // v0.3 chunk F "Boss telegraphs", E3-generalized: wind-up/glow cue on the CASTER's
          // sprite (boss or trash) for the bossCastStarted → bossCastFinished window. The cue
          // is resolved from the caster's mobId (Tunnel Vision's telegraph phase too — its own
          // crimson focus brand only starts later, at bossFocusStarted, so this never
          // double-signals with it). Legacy events without sourceId fall back to the boss.
          const casterId = event.sourceId ?? this.bossUnitId();
          const caster = this.engine.state.enemies.find((u) => u.id === casterId);
          if (casterId !== undefined) {
            this.findSprite(casterId)?.startTelegraph(this.resolveTelegraphCueForMob(caster?.mobId));
          }
          break;
        }
        case 'bossCastFinished': {
          const casterId = event.sourceId ?? this.bossUnitId();
          const isBoss = this.engine.state.enemies.find((u) => u.id === casterId)?.role === 'boss';
          // Boss keeps the meatier camera punch; trash lands a softer nudge (reversible default).
          if (isBoss || casterId === undefined) shakeBossImpact(this);
          else this.cameras.main.shake(TRASH_CAST_SHAKE_DURATION_MS, TRASH_CAST_SHAKE_INTENSITY);
          if (casterId !== undefined) this.findSprite(casterId)?.stopTelegraph();
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

  /** Current boss unit id, if any — fallback caster for legacy cast events that omit sourceId. */
  private bossUnitId(): string | undefined {
    return this.engine.state.enemies.find((u) => u.role === 'boss')?.id;
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

    // Mid-combat banter (sim-time elapsedMs; one/frame). Wipe/victory: showResultOverlay.
    if (state.status === 'running') {
      const pick = pickMidCombatBanter({
        party: state.party,
        latches: this.banterLatches,
        elapsedCombatMs: this.elapsedMs,
        healerHasActed: this.healerHasActed,
        healerHasHealed: this.healerHasHealed,
      });
      if (pick) {
        this.banterLatches = pick.latches;
        this.fireBanterBubble(pick.trigger, pick.speaker);
      }
    }

    this.syncPlayerCastBar(state);
    this.syncEnemyCastBars(state);

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
    this.spellBar.setGcd(state.gcdRemainingMs, GCD_MS);
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

  /** Active flat heal bonus right now: open healBonus CD windows + armed synergy bonuses for spellId. */
  private computeActiveFlatHealBonus(spellId: string): number {
    const { state } = this.engine;
    const cdBonus = state.cooldowns
      .filter((s) => s.activeRemainingMs > 0)
      .reduce((sum, s) => {
        const def = this.sceneData.loadout.cooldowns.find((c) => c.id === s.id);
        return sum + (def?.effect.kind === 'healBonus' ? def.effect.bonusHeal : 0);
      }, 0);
    const synergyBonus = state.armedBuffedSpellIds.includes(spellId)
      ? this.sceneData.loadout.synergies
          .filter((s) => s.buffedSpellId === spellId)
          .reduce((sum, s) => sum + s.bonusHeal, 0)
      : 0;
    return cdBonus + synergyBonus;
  }

  private syncHealerRune(state: CombatState): void {
    this.healerCues = syncHealerCues(
      this,
      this.healerCues,
      state,
      this.bonkStackIconSpellId,
      this.partySprites.get('healer'),
    );
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
      // Start cast-action before resolve so flash/contact land near the heal.
      // Skip the first tick (remaining === total) so charge gets at least one frame.
      if (
        cast.totalMs > 0 &&
        cast.remainingMs < cast.totalMs &&
        cast.remainingMs <= HEALER_CAST_RELEASE_LEAD_MS
      ) {
        this.partySprites.get('healer')?.beginEarlyCastRelease();
      }
    } else {
      this.playerCastBar.setVisible(false);
      this.playerCastLabel.setVisible(false);
    }

    if (state.queuedSpellId) {
      const queued = this.sceneData.loadout.spells.find((s) => s.id === state.queuedSpellId);
      this.queuedSpellLabel.setText(`next: ${queued?.name ?? state.queuedSpellId}`).setVisible(true);
    } else {
      this.queuedSpellLabel.setVisible(false);
    }
  }

  /** Enemy cast slivers: one unlabeled bar per active caster in state.enemyCasts (boss + trash),
   *  anchored above each caster sprite and shaking harder as its fill nears full — see
   *  ui/enemyCastBars.ts for pooling/positioning. */
  private syncEnemyCastBars(state: CombatState): void {
    this.enemyCastBars.sync(state, this.elapsedMs, (id) => this.findSprite(id));
  }

  // ---- end of combat -------------------------------------------------------------

  /** Speech bubble above speaker; `'oom'` branches on Bonk-on-bar. No-op if sprite gone. */
  private fireBanterBubble(trigger: BanterTrigger, speaker: BanterSpeaker): void {
    const sprite = this.partySprites.get(speaker);
    if (!sprite) return;
    const yOffset = speaker === 'healer' ? BANTER_HEALER_Y_OFFSET : BANTER_TANK_Y_OFFSET;
    const line = pickBanterLine({
      trigger,
      speaker,
      subclass: this.save.subclass,
      hasBonkOnBar: this.sceneData.loadout.spells.some((s) => s.id === SPELLS.bonk.id),
      rng: Math.random,
    });
    showSpeechBubble(this, {
      x: sprite.getHomeX(),
      y: sprite.getHomeY() - yOffset,
      text: line,
      viewWidth: VIEW_WIDTH,
      viewHeight: VIEW_HEIGHT,
      portraitTextureKey: portraitTextureKey(speaker),
    });
  }

  /** Wipe/victory summary panel; HubScene banks XP / persists the RunRecord. */
  private showResultOverlay(status: 'victory' | 'wipe'): void {
    if (this.resultShown) return;
    this.resultShown = true;

    const { xp } = this.engine.rewards;
    const summary = buildRunSummary({ status, xp, treeRanks: this.save.treeRanks, preFightXp: this.save.xp });
    const centerX = VIEW_WIDTH / 2;
    const centerY = VIEW_HEIGHT / 2;

    // Banter fires before panel tweens: bubble visible while party sprites are still fully up.
    this.fireBanterBubble(status === 'wipe' ? 'wipe' : 'victory', status === 'wipe' ? 'tank' : 'healer');

    const backdrop = this.add
      .rectangle(centerX, centerY, VIEW_WIDTH, VIEW_HEIGHT, 0x000000)
      .setDepth(OVERLAY_DEPTH)
      .setInteractive()
      .setAlpha(0);
    this.tweens.add({ targets: backdrop, alpha: OVERLAY_ALPHA, duration: OVERLAY_FADE_MS });

    // Framed result panel (ui/panels.ts); container drives slide-in tween.
    const panel = addPanel(this, centerX, centerY - PANEL_SLIDE_OFFSET, PANEL_WIDTH, PANEL_HEIGHT, {
      fillAlpha: 0.96,
      depth: OVERLAY_DEPTH + 1,
    });
    panel.container.setAlpha(0);
    this.tweens.add({
      targets: panel.container,
      y: centerY,
      alpha: 1,
      delay: PANEL_SLIDE_DELAY_MS,
      duration: PANEL_SLIDE_MS,
      ease: 'Quad.easeOut',
    });

    revealResultPortrait(this, status, centerX, centerY, PANEL_WIDTH, OVERLAY_DEPTH + 2, { delay: TITLE_DELAY_MS, duration: TITLE_REVEAL_MS }); // chunk 5 bust

    if (summary.outcomeLabel !== null) {
      const titleText = this.add
        .text(centerX, centerY - 80, summary.outcomeLabel, {
          fontFamily: FONT,
          fontSize: FONT_SIZE_LG,
          color: '#f2c14e',
        })
        .setOrigin(0.5)
        .setDepth(OVERLAY_DEPTH + 2)
        .setAlpha(0);
      this.tweens.add({ targets: titleText, alpha: 1, delay: TITLE_DELAY_MS, duration: TITLE_REVEAL_MS });
    }

    const xpText = this.add
      .text(centerX, centerY - 28, `XP +${summary.xpGained}`, {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: '#e8d8c8',
      })
      .setOrigin(0.5)
      .setDepth(OVERLAY_DEPTH + 2)
      .setAlpha(0);
    this.tweens.add({ targets: xpText, alpha: 1, delay: XP_DELAY_MS, duration: XP_REVEAL_MS });

    if (summary.levelUpLabel !== null) {
      const lvlText = this.add.text(centerX, centerY - 50, summary.levelUpLabel,
        { fontFamily: FONT, fontSize: FONT_SIZE_XS, color: '#a89888' }).setOrigin(0.5).setDepth(OVERLAY_DEPTH + 2).setAlpha(0);
      this.tweens.add({ targets: lvlText, alpha: 1, delay: LEVEL_UP_DELAY_MS, duration: LEVEL_UP_REVEAL_MS });
    }

    if (hasBuildGlyph(summary.glyph)) {
      const glyphLabel = this.add
        .text(centerX, centerY + 8, 'BUILD', { fontFamily: FONT, fontSize: FONT_SIZE_SM, color: '#a89888' })
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

    mountResultReturn(this, {
      centerX,
      centerY,
      depth: OVERLAY_DEPTH + 2,
      onReturn: () => {
        const combatResult: CombatResult = { encounterId: this.sceneData.encounterId, status, xp };
        fadeToScene(this, this.sceneData.returnTo, { combatResult });
      },
    });
  }
}
