/**
 * Hub: shows XP/level/talent progress, applies the combat result that just
 * ended, applies pending first-clear relic offers, and launches unlocked
 * dungeons from a vertical challenge list (current uncleared dungeon marked
 * CURRENT). Talent Tree / Spellbook sit above the dungeon stack. Run mods
 * (oath + relics) live in the shared top-right RunModsBar. Temp art only —
 * panels + text buttons, dark palette, monospace.
 */

import Phaser from 'phaser';
import { SceneKeys } from './keys';
import { loadSave, resetSave, saveGame, type SaveData } from '../save/save';
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
import type { CombatResult, CombatSceneData } from './CombatScene';
import type { DungeonDef } from '../data/content/types';

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
const FONT = 'monospace';

/** Wide enough for full dungeon names without spilling; vertical stack only. */
const DUNGEON_BUTTON_WIDTH = 440;
const DUNGEON_BUTTON_HEIGHT = 38;
const DUNGEON_ROW_GAP = 6;
const NOTICE_START_Y = 146;
const NOTICE_ROW_H = 34;
const NOTICE_H = 28;
const META_BUTTON_BASE_Y = 175;
const META_BUTTON_H = 44;
/** Gap between the bottom of the last notice and the top of the meta buttons. */
const NOTICE_TO_META_GAP = 12;

export class HubScene extends Phaser.Scene {
  private sceneData: HubSceneData = {};
  private restartArmed = false;

  constructor() {
    super(SceneKeys.Hub);
  }

  init(data: HubSceneData): void {
    this.sceneData = data ?? {};
    this.restartArmed = false;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BG_COLOR);
    const { width } = this.scale;

    const save = loadSave();
    let notices: HubNotice[] = [];
    if (this.sceneData.combatResult) {
      notices = applyCombatResult(save, this.sceneData.combatResult);
      saveGame(save);
    }

    if (save.pendingRelicOffers.length > 0) {
      this.scene.start(SceneKeys.Relic);
      return;
    }

    this.add.text(width / 2, 40, 'Hub', { fontFamily: FONT, fontSize: '28px', color: TEXT_COLOR }).setOrigin(0.5);

    this.buildStats(save);
    this.buildNotices(notices);
    this.buildButtons(save, this.metaButtonsY(notices.length));
    new RunModsBar(this, runModsFromSave(save), { viewWidth: width });
  }

  private buildStats(save: SaveData): void {
    const { width } = this.scale;
    const level = levelForXp(save.xp);
    const hasZealous = save.unlockedSpells.includes(SPELLS.zealousMending.id);
    const nextLevelXp = xpForLevel(level + 1);
    const xpLine = `XP ${save.xp}/${nextLevelXp} → Level ${level + 1}${hasZealous ? '' : ` + ${SPELLS.zealousMending.name}`}`;

    this.add
      .text(width / 2, 82, `Level ${level}   •   Talent Points ${availableTalentPoints(save)} unplaced`, {
        fontFamily: FONT,
        fontSize: '15px',
        color: TEXT_COLOR,
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 106, xpLine, {
        fontFamily: FONT,
        fontSize: '13px',
        color: hasZealous ? DIM_COLOR : ACCENT_COLOR,
      })
      .setOrigin(0.5);
  }

  private buildNotices(notices: HubNotice[]): void {
    notices.forEach((notice, i) => {
      const y = NOTICE_START_Y + i * NOTICE_ROW_H;
      this.add
        .rectangle(this.scale.width / 2, y, 440, NOTICE_H, NOTICE_BG_COLOR)
        .setStrokeStyle(1, BORDER_COLOR);
      this.add
        .text(this.scale.width / 2, y, notice.text, { fontFamily: FONT, fontSize: '14px', color: ACCENT_COLOR })
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
      this.scene.start(SceneKeys.Tree);
    }, 'hubTree');
    this.makeButton(centerX + 160, metaButtonY, 280, META_BUTTON_H, 'Spellbook', () => {
      this.scene.start(SceneKeys.Loadout);
    }, 'hubLoadout');

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
        this.scene.start(SceneKeys.Combat, combatData);
      });
    });

    this.buildRestartControl(centerX, height - 28);
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

    const orderLabel = dungeon.order === 1 ? '' : ` · ${dungeon.order}`;
    const titleColor = isCurrent ? ACCENT_COLOR : TEXT_COLOR;
    this.add
      .text(x - DUNGEON_BUTTON_WIDTH / 2 + 16, y, `${dungeon.name}${orderLabel}`, {
        fontFamily: FONT,
        fontSize: '16px',
        color: titleColor,
      })
      .setOrigin(0, 0.5);

    if (isCurrent) {
      this.add
        .text(x + DUNGEON_BUTTON_WIDTH / 2 - 14, y, 'CURRENT', {
          fontFamily: FONT,
          fontSize: '12px',
          fontStyle: 'bold',
          color: ACCENT_COLOR,
        })
        .setOrigin(1, 0.5);
    } else if (cleared) {
      this.add
        .text(x + DUNGEON_BUTTON_WIDTH / 2 - 14, y, 'cleared', {
          fontFamily: FONT,
          fontSize: '12px',
          color: CLEARED_COLOR,
        })
        .setOrigin(1, 0.5);
    }
  }

  private buildRestartControl(x: number, y: number): void {
    const label = this.add
      .text(x, y, 'Restart (wipe save)', { fontFamily: FONT, fontSize: '14px', color: DIM_COLOR })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setName('hubRestart');

    label.on('pointerdown', () => {
      if (!this.restartArmed) {
        this.restartArmed = true;
        label.setText('Really wipe everything?').setColor(DANGER_COLOR);
        return;
      }
      resetSave();
      this.scene.start(SceneKeys.Tutorial);
    });
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
    this.add
      .text(x, y, label, {
        fontFamily: FONT,
        fontSize: '18px',
        color: TEXT_COLOR,
        wordWrap: { width: w - 24 },
        align: 'center',
      })
      .setOrigin(0.5);
    rect.on('pointerdown', onClick);
  }
}
