/**
 * Hub: shows XP/level/talent progress, applies the combat result that just
 * ended, routes pending first-clear relic offers, and launches
 * Ash Gate, the spell tree, Iron Pass (Dungeon 2, once
 * Ash Gate is cleared — alpha-0.1-handoff §D1), and The Maw (Dungeon 3, once
 * Iron Pass is cleared). Run mods (oath + relics) live in the shared top-right
 * RunModsBar. Temp art only — panels + text buttons, dark palette, monospace.
 */

import Phaser from 'phaser';
import { SceneKeys } from './keys';
import { loadSave, resetSave, saveGame, type SaveData } from '../save/save';
import {
  applyCombatResult,
  availableTalentPoints,
  isDungeonUnlocked,
  type HubNotice,
} from '../meta/progression';
import { loadoutFromSave } from '../data/spellTree';
import { runModsFromSave } from '../data/runMods';
import { levelForXp, SPELLS, xpForLevel } from '../data/constants';
import { ORDERED_DUNGEONS } from '../data/dungeons';
import { RunModsBar } from '../ui/runModsBar';
import type { CombatResult, CombatSceneData } from './CombatScene';

interface HubSceneData {
  combatResult?: CombatResult;
}

const BG_COLOR = 0x1a1210;
const BUTTON_COLOR = 0x3a2a22;
const BORDER_COLOR = 0x0a0605;
const NOTICE_BG_COLOR = 0x3a2a10;
const TEXT_COLOR = '#e8d8c8';
const ACCENT_COLOR = '#f2c14e';
const DIM_COLOR = '#a89888';
const DANGER_COLOR = '#e05a4e';
const FONT = 'monospace';

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
    this.buildButtons(save);
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
    const startY = 146;
    notices.forEach((notice, i) => {
      const y = startY + i * 34;
      this.add
        .rectangle(this.scale.width / 2, y, 440, 28, NOTICE_BG_COLOR)
        .setStrokeStyle(1, BORDER_COLOR);
      this.add
        .text(this.scale.width / 2, y, notice.text, { fontFamily: FONT, fontSize: '14px', color: ACCENT_COLOR })
        .setOrigin(0.5);
    });
  }

  private buildButtons(save: SaveData): void {
    const { width, height } = this.scale;
    const centerX = width / 2;
    const unlockedDungeons = ORDERED_DUNGEONS.filter((dungeon) =>
      isDungeonUnlocked(save, dungeon.id),
    );
    const columns = Math.min(3, Math.max(1, unlockedDungeons.length));
    const rows = Math.ceil(unlockedDungeons.length / columns);
    const columnGap = 20;
    const sideMargin = 40;
    const dungeonButtonWidth = Math.min(
      300,
      (width - sideMargin * 2 - columnGap * (columns - 1)) / columns,
    );
    const dungeonStartY = 270;

    unlockedDungeons.forEach((dungeon, visibleIndex) => {
      // A single bounded grid handles the ordered dungeon catalog (up to three
      // columns). Later dungeons wrap to additional rows without eating the
      // footer's restart space.
      const column = visibleIndex % columns;
      const row = Math.floor(visibleIndex / columns);
      const rowCount = Math.min(columns, unlockedDungeons.length - row * columns);
      const rowWidth = rowCount * dungeonButtonWidth + (rowCount - 1) * columnGap;
      const rowStartX = centerX - rowWidth / 2 + dungeonButtonWidth / 2;
      const x = rowStartX + column * (dungeonButtonWidth + columnGap);
      const y = dungeonStartY + row * 62;
      const suffix = dungeon.order === 1 ? '' : ` (Dungeon ${dungeon.order})`;
      this.makeButton(
        x,
        y,
        dungeonButtonWidth,
        48,
        `Enter ${dungeon.name}${suffix}`,
        () => {
          const combatData: CombatSceneData = {
            encounterId: dungeon.id,
            loadout: loadoutFromSave(save),
            returnTo: SceneKeys.Hub,
          };
          this.scene.start(SceneKeys.Combat, combatData);
        },
        hubDungeonButtonName(dungeon.id),
      );
    });

    const treeY = dungeonStartY + rows * 62 + 22;
    this.makeButton(centerX, treeY, 300, 52, 'Spell Tree', () => {
      this.scene.start(SceneKeys.Tree);
    }, 'hubTree');

    this.buildRestartControl(centerX, height - 28);
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
    this.add.text(x, y, label, { fontFamily: FONT, fontSize: '18px', color: TEXT_COLOR }).setOrigin(0.5);
    rect.on('pointerdown', onClick);
  }
}

/** Journey/semantic names for hub dungeon buttons (docs/semantic-targets-handoff.md). */
function hubDungeonButtonName(dungeonId: string): string {
  switch (dungeonId) {
    case 'ash-gate':
      return 'hubAshGate';
    case 'iron-pass':
      return 'hubIronPass';
    case 'cinder-vault':
      return 'hubCinderVault';
    case 'black-choir':
      return 'hubBlackChoir';
    case 'the-maw':
      return 'hubMaw';
    default:
      return `hubDungeon:${dungeonId}`;
  }
}
