/**
 * Hub: shows XP/level/talent progress, applies the combat result that just
 * ended, applies pending first-clear relic offers, and launches unlocked
 * dungeons from a vertical challenge list (current uncleared dungeon marked
 * CURRENT). Talent Tree / Spellbook sit above the dungeon stack. Run mods
 * (oath + relics) live in the shared top-left RunModsBar. Temp art only —
 * panels + text buttons, dark palette, pixel font (ui/theme.ts).
 */

import Phaser from 'phaser';
import { SceneKeys } from './keys';
import { loadSave, pushRecentRun, resetSave, saveGame, type SaveData } from '../save/save';
import {
  applyCombatResult,
  availableTalentPoints,
  currentChallengeDungeon,
  isDungeonUnlocked,
  type HubNotice,
} from '../meta/progression';
import { loadoutFromSave } from '../data/talentTree';
import { runModsFromSave } from '../data/runMods';
import { levelForXp, SPELLS, xpForLevel } from '../data/constants';
import { ORDERED_DUNGEONS, hubDungeonTargetName } from '../data/dungeons';
import { RunModsBar } from '../ui/runModsBar';
import { buildRunSummary, hasBuildGlyph, runRecordFromSummary } from '../ui/runSummary';
import { drawBuildGlyph } from '../ui/buildGlyph';
import type { CombatResult, CombatSceneData } from './CombatScene';
import type { DungeonDef } from '../data/content/types';
import { loadTelemetry, recordReset, sendPlaytestMail } from '../telemetry';
import { FONT, FONT_SIZE_SM, FONT_SIZE_LG, PALETTE, PALETTE_NUM } from '../ui/theme';
import { addBanner, addButton, addPanel } from '../ui/panels';
import { COMBAT_ENTRY_FADE_OUT_MS, fadeInOnCreate, fadeToScene } from '../ui/transitions';

interface HubSceneData {
  combatResult?: CombatResult;
}

const BG_COLOR = 0x1a1210;
const BUTTON_COLOR = 0x3a2a22;
const BUTTON_CURRENT_COLOR = 0x4a3820;
const BORDER_COLOR = 0x0a0605;
const BORDER_CURRENT = 0xf2c14e;
const NOTICE_BG_COLOR = 0x3a2a10;
const TEXT_COLOR = '#e8d8c8';
const ACCENT_COLOR = '#f2c14e';
const DIM_COLOR = '#a89888';
const DANGER_COLOR = '#e05a4e';
const CLEARED_COLOR = '#7ad67a';

/** Wide enough for full dungeon names without spilling; vertical stack only. */
const DUNGEON_BUTTON_WIDTH = 440;
const DUNGEON_BUTTON_HEIGHT = 38;
const DUNGEON_ROW_GAP = 6;
const NOTICE_START_Y = 146;
const NOTICE_ROW_H = 34;
const NOTICE_H = 28;
const META_BUTTON_BASE_Y = 175;
const META_BUTTON_H = 44;
/** v0.3 chunk H: small Settings button, right margin of the meta-button row. */
const SETTINGS_BUTTON_W = 120;
const SETTINGS_BUTTON_H = 34;
/** Gap between the bottom of the last notice and the top of the meta buttons. */
const NOTICE_TO_META_GAP = 12;

export class HubScene extends Phaser.Scene {
  private sceneData: HubSceneData = {};
  /** Restart confirm: idle → armed → chooser (send feedback first?). */
  private restartPhase: 'idle' | 'armed' | 'chooser' = 'idle';
  private restartLabel: Phaser.GameObjects.Text | null = null;
  private feedbackLabel: Phaser.GameObjects.Text | null = null;
  private wipeChooser: Phaser.GameObjects.GameObject[] = [];
  private statusText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super(SceneKeys.Hub);
  }

  init(data: HubSceneData): void {
    this.sceneData = data ?? {};
    this.restartPhase = 'idle';
    this.restartLabel = null;
    this.feedbackLabel = null;
    this.wipeChooser = [];
    this.statusText = null;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BG_COLOR);
    const { width } = this.scale;

    const save = loadSave();
    let notices: HubNotice[] = [];
    if (this.sceneData.combatResult) {
      const result = this.sceneData.combatResult;
      notices = applyCombatResult(save, result);
      // Same place XP is already banked (applyCombatResult above) — persist the
      // run exactly once. Rebuilt from the same pure buildRunSummary() CombatScene
      // used for its panel + save.treeRanks (unchanged since combat ended), so the
      // stored glyph matches the one the player just saw (v0.3 chunk E).
      const summary = buildRunSummary({ status: result.status, xp: result.xp, treeRanks: save.treeRanks });
      pushRecentRun(save, runRecordFromSummary(summary, result.encounterId));
      saveGame(save);
    }

    if (save.pendingRelicOffers.length > 0) {
      fadeToScene(this, SceneKeys.Relic);
      return;
    }

    // Chunk 6 (bible item 6): fade in — only once we know Hub is actually
    // going to render (the pendingRelicOffers redirect above never shows
    // Hub content, so it skips this).
    fadeInOnCreate(this);

    // Chunk 4 (bible item 4): shared panel/button/banner kit — ui/panels.ts.
    addBanner(this, width / 2, 40, 240, 44);
    // Chunk 9 (bible item 9): same wordmark accent as TutorialScene's title —
    // gold text over a 1px-offset dark-shadow layer, see that scene for the
    // full rationale. Kept minimal here since addBanner already frames it.
    const HUB_TITLE_SHADOW_OFFSET = 2;
    this.add
      .text(width / 2 + HUB_TITLE_SHADOW_OFFSET, 40 + HUB_TITLE_SHADOW_OFFSET, 'Hub', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_LG,
        color: PALETTE.borderDark,
      })
      .setOrigin(0.5);
    this.add.text(width / 2, 40, 'Hub', { fontFamily: FONT, fontSize: FONT_SIZE_LG, color: PALETTE.gold }).setOrigin(0.5);

    this.buildStats(save);
    this.buildNotices(notices);
    this.buildButtons(save, this.metaButtonsY(notices.length));
    this.buildLastRunGlyph(save);
    new RunModsBar(this, runModsFromSave(save));
  }

  /**
   * Optional cheap Hub hook (v0.3 chunk E, minimum deliverable is the combat
   * summary panel — this is the "nice to have"): one small glyph + "+N xp"
   * line for the most recent run, top-right corner (mirrors RunModsBar's
   * top-left placement). Non-interactive — no multi-run browser.
   */
  private buildLastRunGlyph(save: SaveData): void {
    const last = save.recentRuns[0];
    if (!last) return;

    const x = this.scale.width - 46;
    const y = 26;
    const outcomeColor = last.outcome === 'victory' ? ACCENT_COLOR : DANGER_COLOR;
    if (hasBuildGlyph(last.glyph)) {
      drawBuildGlyph(this, last.glyph, { x, y, cell: 6, color: 0xfff2df }).setDepth(5);
      this.add
        .text(x, y + 22, `+${last.xpGained} xp`, { fontFamily: FONT, fontSize: FONT_SIZE_SM, color: outcomeColor })
        .setOrigin(0.5, 0);
    } else {
      this.add
        .text(x, y, `+${last.xpGained} xp`, { fontFamily: FONT, fontSize: FONT_SIZE_SM, color: outcomeColor })
        .setOrigin(0.5, 0);
    }
  }

  private buildStats(save: SaveData): void {
    const { width } = this.scale;
    const level = levelForXp(save.xp);
    const hasZealous = save.unlockedSpells.includes(SPELLS.zealousMending.id);
    const nextLevelXp = xpForLevel(level + 1);
    const xpLine = `XP ${save.xp}/${nextLevelXp} → Level ${level + 1}${hasZealous ? '' : ` + ${SPELLS.zealousMending.name}`}`;

    // Chunk 4: hub stats block gets a light frame (bible item 4 "hub stats
    // block if it helps") — sized around the two text lines below.
    addPanel(this, width / 2, 94, 560, 56, { size: 'sm' });
    this.add
      .text(width / 2, 82, `Level ${level}   •   Talent Points ${availableTalentPoints(save)} unplaced`, {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: TEXT_COLOR,
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 106, xpLine, {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: hasZealous ? DIM_COLOR : ACCENT_COLOR,
      })
      .setOrigin(0.5);
  }

  private buildNotices(notices: HubNotice[]): void {
    notices.forEach((notice, i) => {
      const y = NOTICE_START_Y + i * NOTICE_ROW_H;
      addPanel(this, this.scale.width / 2, y, 440, NOTICE_H, { size: 'sm', fillColor: NOTICE_BG_COLOR });
      this.add
        .text(this.scale.width / 2, y, notice.text, { fontFamily: FONT, fontSize: FONT_SIZE_SM, color: ACCENT_COLOR })
        .setOrigin(0.5);
    });
  }

  /** Center Y for Talent Tree / Spellbook — cleared below any post-combat notices. */
  private metaButtonsY(noticeCount: number): number {
    if (noticeCount === 0) return META_BUTTON_BASE_Y;
    const lastNoticeBottom =
      NOTICE_START_Y + (noticeCount - 1) * NOTICE_ROW_H + NOTICE_H / 2;
    return lastNoticeBottom + NOTICE_TO_META_GAP + META_BUTTON_H / 2;
  }

  private buildButtons(save: SaveData, metaButtonY: number): void {
    const { width, height } = this.scale;
    const centerX = width / 2;
    const unlockedDungeons = ORDERED_DUNGEONS.filter((dungeon) =>
      isDungeonUnlocked(save, dungeon.id),
    );
    const challenge = currentChallengeDungeon(save);

    // Meta destinations stay above the dungeon stack so a long unlock list
    // never pushes Talent Tree / Spellbook off the 540px canvas.
    this.makeButton(centerX - 160, metaButtonY, 280, META_BUTTON_H, 'Talent Tree', () => {
      fadeToScene(this, SceneKeys.Tree);
    }, 'hubTree');
    this.makeButton(centerX + 160, metaButtonY, 280, META_BUTTON_H, 'Spellbook', () => {
      fadeToScene(this, SceneKeys.Loadout);
    }, 'hubLoadout');
    // v0.3 chunk H: small Settings entry — sits in the unused margin to the
    // right of the meta-button row (right edge of Spellbook is centerX+300,
    // well clear of the canvas edge at 960) so it never competes with the
    // dungeon stack or notice-count-dependent vertical layout above.
    this.makeButton(width - 16 - SETTINGS_BUTTON_W / 2, metaButtonY, SETTINGS_BUTTON_W, SETTINGS_BUTTON_H, 'Settings', () => {
      fadeToScene(this, SceneKeys.Settings);
    }, 'hubSettings');

    const dungeonStartY = metaButtonY + 52;
    unlockedDungeons.forEach((dungeon, visibleIndex) => {
      const y = dungeonStartY + visibleIndex * (DUNGEON_BUTTON_HEIGHT + DUNGEON_ROW_GAP);
      const isCurrent = challenge?.id === dungeon.id;
      const cleared = save.clearedDungeons.includes(dungeon.id);
      this.makeDungeonButton(centerX, y, dungeon, isCurrent, cleared, () => {
        const combatData: CombatSceneData = {
          encounterId: dungeon.id,
          loadout: loadoutFromSave(save),
          returnTo: SceneKeys.Hub,
        };
        // Chunk 6: shorter fade-out here — CombatScene.create() plays the
        // chunky "into battle" wipe reveal (ui/transitions.ts chunkyWipeIn)
        // instead of a plain fadeInOnCreate, so the two together stay under
        // the 400ms transition budget.
        fadeToScene(this, SceneKeys.Combat, combatData, COMBAT_ENTRY_FADE_OUT_MS);
      });
    });

    // Bottom corners: feedback (left) and restart (right) so wipe-confirm
    // options can sit in the clear center without stacking on either control.
    this.buildFeedbackControl(16, height - 20);
    this.buildRestartControl(width - 16, height - 20);
  }

  private buildFeedbackControl(x: number, y: number): void {
    this.feedbackLabel = this.add
      .text(x, y, '✨ Send Aaron feedback', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: DIM_COLOR,
      })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true })
      .setName('hubSendFeedback');
    this.feedbackLabel.on('pointerdown', () => {
      void this.openPlaytestMail();
    });
  }

  private async openPlaytestMail(): Promise<void> {
    const result = await sendPlaytestMail();
    if (!result.ok) {
      this.showStatus(result.reason ?? 'Could not open mail.', DANGER_COLOR);
      return;
    }
    const note = result.copied
      ? 'Mail opened — full JSON copied to clipboard.'
      : 'Mail opened — paste was unavailable; body may be truncated.';
    this.showStatus(note, ACCENT_COLOR);
  }

  private showStatus(text: string, color: string): void {
    if (this.statusText) this.statusText.destroy();
    this.statusText = this.add
      .text(this.scale.width / 2, this.scale.height - 48, text, {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color,
      })
      .setOrigin(0.5);
  }

  private makeDungeonButton(
    x: number,
    y: number,
    dungeon: DungeonDef,
    isCurrent: boolean,
    cleared: boolean,
    onClick: () => void,
  ): void {
    const bgColor = isCurrent ? BUTTON_CURRENT_COLOR : BUTTON_COLOR;
    const borderColor = isCurrent ? BORDER_CURRENT : BORDER_COLOR;
    const borderWidth = isCurrent ? 3 : 2;
    const rect = this.add
      .rectangle(x, y, DUNGEON_BUTTON_WIDTH, DUNGEON_BUTTON_HEIGHT, bgColor)
      .setStrokeStyle(borderWidth, borderColor)
      .setInteractive({ useHandCursor: true })
      .setName(hubDungeonTargetName(dungeon.id));
    rect.on('pointerdown', onClick);
    // Chunk 4: framed row — CURRENT keeps its gold-outline accent (state
    // 'current'), now drawn by ui/panels.ts instead of the rect's own stroke.
    addButton(this, x, y, DUNGEON_BUTTON_WIDTH, DUNGEON_BUTTON_HEIGHT, {
      fillColor: bgColor,
      state: isCurrent ? 'current' : 'normal',
      hitRect: rect,
    });

    const orderLabel = dungeon.order === 1 ? '' : ` · ${dungeon.order}`;
    const titleColor = isCurrent ? ACCENT_COLOR : TEXT_COLOR;
    this.add
      .text(x - DUNGEON_BUTTON_WIDTH / 2 + 16, y, `${dungeon.name}${orderLabel}`, {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: titleColor,
      })
      .setOrigin(0, 0.5);

    if (isCurrent) {
      this.add
        .text(x + DUNGEON_BUTTON_WIDTH / 2 - 14, y, 'CURRENT', {
          fontFamily: FONT,
          fontSize: FONT_SIZE_SM,
          fontStyle: 'bold',
          color: ACCENT_COLOR,
        })
        .setOrigin(1, 0.5);
    } else if (cleared) {
      this.add
        .text(x + DUNGEON_BUTTON_WIDTH / 2 - 14, y, 'cleared', {
          fontFamily: FONT,
          fontSize: FONT_SIZE_SM,
          color: CLEARED_COLOR,
        })
        .setOrigin(1, 0.5);
    }
  }

  private buildRestartControl(x: number, y: number): void {
    this.restartLabel = this.add
      .text(x, y, 'Restart (wipe save)', { fontFamily: FONT, fontSize: FONT_SIZE_SM, color: DIM_COLOR })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true })
      .setName('hubRestart');

    this.restartLabel.on('pointerdown', () => {
      if (this.restartPhase === 'idle') {
        this.restartPhase = 'armed';
        this.restartLabel?.setText('Really wipe everything?').setColor(DANGER_COLOR);
        return;
      }
      if (this.restartPhase === 'armed') {
        const log = loadTelemetry();
        if (log.runs.length > 0 || log.playMs > 0) {
          this.showWipeChooser();
          return;
        }
        this.confirmWipe();
      }
    });
  }

  private showWipeChooser(): void {
    this.restartPhase = 'chooser';
    this.restartLabel?.setVisible(false).disableInteractive();
    this.feedbackLabel?.setVisible(false).disableInteractive();
    this.clearWipeChooser();

    const { width, height } = this.scale;
    const cx = width / 2;
    // Center band above the corner controls so options never cover feedback/restart.
    const promptY = height - 56;
    const optionsY = height - 28;

    const prompt = this.add
      .text(cx, promptY, 'Please send Aaron feedback first?', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5)
      .setName('hubWipePrompt');

    const sendThenWipe = this.add
      .text(cx - 180, optionsY, 'Send, then wipe', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: TEXT_COLOR,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setName('hubWipeSendThen');
    sendThenWipe.on('pointerdown', () => {
      void this.openPlaytestMail().then(() => this.confirmWipe());
    });

    const wipeOnly = this.add
      .text(cx, optionsY, 'Wipe without sending', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: DANGER_COLOR,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setName('hubWipeWithoutSend');
    wipeOnly.on('pointerdown', () => this.confirmWipe());

    const cancel = this.add
      .text(cx + 180, optionsY, 'Cancel', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: DIM_COLOR,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setName('hubWipeCancel');
    cancel.on('pointerdown', () => this.cancelWipeChooser());

    this.wipeChooser = [prompt, sendThenWipe, wipeOnly, cancel];
  }

  private clearWipeChooser(): void {
    for (const obj of this.wipeChooser) obj.destroy();
    this.wipeChooser = [];
  }

  private cancelWipeChooser(): void {
    this.clearWipeChooser();
    this.restartPhase = 'idle';
    this.restartLabel
      ?.setVisible(true)
      .setInteractive({ useHandCursor: true })
      .setText('Restart (wipe save)')
      .setColor(DIM_COLOR);
    this.feedbackLabel?.setVisible(true).setInteractive({ useHandCursor: true });
  }

  private confirmWipe(): void {
    recordReset();
    resetSave();
    fadeToScene(this, SceneKeys.Tutorial);
  }

  private makeButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onClick: () => void,
    name: string,
  ): void {
    const rect = this.add
      .rectangle(x, y, w, h, BUTTON_COLOR)
      .setStrokeStyle(2, BORDER_COLOR)
      .setInteractive({ useHandCursor: true })
      .setName(name);
    addButton(this, x, y, w, h, { fillColor: PALETTE_NUM.panelLight, hitRect: rect });
    this.add
      .text(x, y, label, {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: TEXT_COLOR,
        wordWrap: { width: w - 24 },
        align: 'center',
      })
      .setOrigin(0.5);
    rect.on('pointerdown', onClick);
  }
}
