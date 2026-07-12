/**
 * Hub (poc-spec §3, §5): shows currencies with roles, applies the result of
 * the combat run that just ended (if any), and is the launch point for Ash
 * Gate, the spell tree (gold + ruby oaths), and Dungeon 2 / The Maw (§7,
 * once Ash Gate is cleared). Temp art only — panels + text buttons, dark
 * palette, monospace.
 */

import Phaser from 'phaser';
import { SceneKeys } from './keys';
import { loadSave, resetSave, saveGame, type SaveData } from '../save/save';
import { applyCombatResult, isDungeon2Unlocked, type HubNotice } from '../meta/progression';
import { loadoutFromSave } from '../data/spellTree';
import { levelForXp, SPELLS, XP_LEVEL_2_THRESHOLD } from '../data/constants';
import { ASH_GATE, THE_MAW } from '../data/encounters';
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
    const { width } = this.scale;
    const level = levelForXp(save.xp);
    const hasZealous = save.unlockedSpells.includes(SPELLS.zealousMending.id);
    const xpLine = hasZealous
      ? `XP ${save.xp} (Lv ${level}) — ${SPELLS.zealousMending.name} unlocked`
      : `XP ${save.xp}/${XP_LEVEL_2_THRESHOLD} → unlock ${SPELLS.zealousMending.name}`;

    const lines = [
      `Gold ${save.gold} — spend in Spell Tree`,
      xpLine,
      `Rubies ${save.rubies} — swear an oath (first clear)`,
    ];
    lines.forEach((line, i) => {
      this.add
        .text(width / 2, 78 + i * 22, line, {
          fontFamily: FONT,
          fontSize: '15px',
          color: i === 1 ? ACCENT_COLOR : DIM_COLOR,
        })
        .setOrigin(0.5);
    });
  }

  private buildNotices(notices: HubNotice[]): void {
    const startY = 152;
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
      const combatData: CombatSceneData = {
        encounterId: ASH_GATE.id,
        loadout: loadoutFromSave(save),
        returnTo: SceneKeys.Hub,
      };
      this.scene.start(SceneKeys.Combat, combatData);
    });

    this.makeButton(centerX, height / 2 + 50, 300, 52, 'Spell Tree', () => {
      this.scene.start(SceneKeys.Tree);
    });

    if (save.subclass !== null) {
      const label = save.subclass === 'vigil' ? 'Path of the Vigil' : 'Path of the Zealot';
      this.add
        .text(centerX, height / 2 + 115, `Oath: ${label}`, { fontFamily: FONT, fontSize: '16px', color: ACCENT_COLOR })
        .setOrigin(0.5);
    }

    if (isDungeon2Unlocked(save)) {
      this.makeButton(centerX, height / 2 + 180, 300, 52, 'Enter The Maw (Dungeon 2)', () => {
        const combatData: CombatSceneData = {
          encounterId: THE_MAW.id,
          loadout: loadoutFromSave(save),
          returnTo: SceneKeys.Hub,
        };
        this.scene.start(SceneKeys.Combat, combatData);
      });
    }

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
