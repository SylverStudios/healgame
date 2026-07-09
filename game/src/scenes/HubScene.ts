/**
 * Hub (poc-spec §3, §5): shows currencies/level, applies the result of the
 * combat run that just ended (if any), and is the launch point for Ash Gate
 * and the spell tree. Temp art only — panels + text buttons, dark palette,
 * monospace.
 */

import Phaser from 'phaser';
import { SceneKeys } from './keys';
import { loadSave, resetSave, saveGame, type SaveData } from '../save/save';
import { applyCombatResult, buildLoadout, type HubNotice } from '../meta/progression';
import { levelForXp } from '../data/constants';
import { ASH_GATE } from '../data/encounters';
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

    this.add.text(width / 2, 40, 'Hub', { fontFamily: FONT, fontSize: '28px', color: TEXT_COLOR }).setOrigin(0.5);

    this.buildStats(save);
    this.buildNotices(notices);
    this.buildButtons(save);
  }

  private buildStats(save: SaveData): void {
    const level = levelForXp(save.xp);
    const line = `Gold ${save.gold}    XP ${save.xp} (Lv ${level})    Rubies ${save.rubies}`;
    this.add
      .text(this.scale.width / 2, 88, line, { fontFamily: FONT, fontSize: '16px', color: ACCENT_COLOR })
      .setOrigin(0.5);
  }

  private buildNotices(notices: HubNotice[]): void {
    const startY = 128;
    notices.forEach((notice, i) => {
      const y = startY + i * 36;
      this.add
        .rectangle(this.scale.width / 2, y, 440, 30, NOTICE_BG_COLOR)
        .setStrokeStyle(1, BORDER_COLOR);
      this.add
        .text(this.scale.width / 2, y, notice.text, { fontFamily: FONT, fontSize: '14px', color: ACCENT_COLOR })
        .setOrigin(0.5);
    });
  }

  private buildButtons(save: SaveData): void {
    const { width, height } = this.scale;
    const centerX = width / 2;

    this.makeButton(centerX, height / 2 - 15, 300, 52, 'Enter Ash Gate', () => {
      const loadout = buildLoadout(save);
      const combatData: CombatSceneData = {
        encounterId: ASH_GATE.id,
        spellIds: loadout.spellIds,
        returnTo: SceneKeys.Hub,
        bonusMaxMana: loadout.bonusMaxMana,
      };
      this.scene.start(SceneKeys.Combat, combatData);
    });

    this.makeButton(centerX, height / 2 + 50, 300, 52, 'Spell Tree', () => {
      this.scene.start(SceneKeys.Tree);
    });

    // Chunk 4 placeholder: once Ash Gate has a first clear and the ruby subclass
    // split (poc-spec §6) exists, add "Choose Subclass" here; once Dungeon 2
    // unlocks, add "Dungeon 2" alongside it. No dead UI until those land.

    this.buildRestartControl(centerX, height - 36);
  }

  private buildRestartControl(x: number, y: number): void {
    const label = this.add
      .text(x, y, 'Restart (wipe save)', { fontFamily: FONT, fontSize: '14px', color: DIM_COLOR })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

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

  private makeButton(x: number, y: number, w: number, h: number, label: string, onClick: () => void): void {
    const rect = this.add
      .rectangle(x, y, w, h, BUTTON_COLOR)
      .setStrokeStyle(2, BORDER_COLOR)
      .setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, { fontFamily: FONT, fontSize: '18px', color: TEXT_COLOR }).setOrigin(0.5);
    rect.on('pointerdown', onClick);
  }
}
