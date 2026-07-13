/**
 * Hub (poc-spec §3, §5): shows currencies with roles, applies the result of
 * the combat run that just ended (if any), and is the launch point for
 * Ash Gate, the spell tree (gold + ruby oaths), Iron Pass (Dungeon 2, once
 * Ash Gate is cleared — alpha-0.1-handoff §D1), and The Maw (Dungeon 3, once
 * Iron Pass is cleared). Temp art only — panels + text buttons, dark
 * palette, monospace.
 */

import Phaser from 'phaser';
import { SceneKeys } from './keys';
import { loadSave, resetSave, saveGame, type SaveData } from '../save/save';
import { applyCombatResult, isIronPassUnlocked, isMawUnlocked, type HubNotice } from '../meta/progression';
import { loadoutFromSave } from '../data/spellTree';
import { relicById } from '../data/relics';
import { levelForXp, SPELLS, XP_LEVEL_2_THRESHOLD } from '../data/constants';
import { ASH_GATE, IRON_PASS, THE_MAW } from '../data/encounters';
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

/** Alpha 0.1 §D7/§D9: 24px relic icon top-right, simple colored circle keyed per relic id. */
const RELIC_ICON_RADIUS = 12;
const RELIC_ICON_MARGIN = 30;
const RELIC_ICON_BORDER = 0x0a0605;
const RELIC_COLORS: Record<string, number> = {
  'ember-ledger': 0xe0703a, // ember-orange
  'triage-bell': 0xf2c14e, // gold
  'still-reservoir': 0x6a8aa0, // blue-grey
};
const RELIC_TOOLTIP_BG = 0x241a15;
const RELIC_TOOLTIP_BORDER = 0x0a0605;
const RELIC_TOOLTIP_PADDING = 8;
const RELIC_TOOLTIP_NAME_COLOR = '#f2c14e';
const RELIC_TOOLTIP_DESC_COLOR = '#e8d8c8';
const RELIC_TOOLTIP_MAX_WIDTH = 220;
const RELIC_TOOLTIP_DEPTH = 300;

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

    // Alpha 0.1 §D7: a just-queued relic pick routes straight to RelicScene,
    // before any hub UI is built — it's re-checked every time Hub.create()
    // runs, but the flag only ever comes back true once (RelicScene clears it
    // the instant a pick is made) and restart wipes it.
    if (save.relicPickPending) {
      this.scene.start(SceneKeys.Relic);
      return;
    }

    this.add.text(width / 2, 40, 'Hub', { fontFamily: FONT, fontSize: '28px', color: TEXT_COLOR }).setOrigin(0.5);

    this.buildStats(save);
    this.buildNotices(notices);
    this.buildButtons(save);
    this.buildRelicIcon(save);
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

    if (isIronPassUnlocked(save)) {
      this.makeButton(centerX, height / 2 + 180, 300, 52, 'Enter Iron Pass (Dungeon 2)', () => {
        const combatData: CombatSceneData = {
          encounterId: IRON_PASS.id,
          loadout: loadoutFromSave(save),
          returnTo: SceneKeys.Hub,
        };
        this.scene.start(SceneKeys.Combat, combatData);
      });
    }

    if (isMawUnlocked(save)) {
      this.makeButton(centerX, height / 2 + 245, 300, 52, 'Enter The Maw (Dungeon 3)', () => {
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

  /** Top-right relic icon (§D7/§D9): nothing rendered when no relic is chosen yet.
   *  Hover shows name + description in a simple text panel (Tree/SpellBar tooltip pattern). */
  private buildRelicIcon(save: SaveData): void {
    const relic = relicById(save.relicId);
    if (!relic) return;

    const { width } = this.scale;
    const x = width - RELIC_ICON_MARGIN;
    const y = RELIC_ICON_MARGIN;
    const color = RELIC_COLORS[relic.id] ?? 0xa89888;

    const icon = this.add
      .circle(x, y, RELIC_ICON_RADIUS, color)
      .setStrokeStyle(2, RELIC_ICON_BORDER)
      .setInteractive({ useHandCursor: true });

    const tooltipBg = this.add
      .rectangle(0, 0, 10, 10, RELIC_TOOLTIP_BG)
      .setOrigin(1, 0)
      .setStrokeStyle(1, RELIC_TOOLTIP_BORDER);
    const nameText = this.add.text(0, 0, relic.name, {
      fontFamily: FONT,
      fontSize: '14px',
      color: RELIC_TOOLTIP_NAME_COLOR,
    });
    const descText = this.add.text(0, 0, relic.description, {
      fontFamily: FONT,
      fontSize: '12px',
      color: RELIC_TOOLTIP_DESC_COLOR,
      wordWrap: { width: RELIC_TOOLTIP_MAX_WIDTH },
    });
    const tooltip = this.add
      .container(0, 0, [tooltipBg, nameText, descText])
      .setDepth(RELIC_TOOLTIP_DEPTH)
      .setVisible(false);

    const showTooltip = (): void => {
      nameText.setPosition(-RELIC_TOOLTIP_PADDING - nameText.width, RELIC_TOOLTIP_PADDING);
      descText.setPosition(
        -RELIC_TOOLTIP_PADDING - descText.width,
        RELIC_TOOLTIP_PADDING + nameText.height + 4,
      );
      const panelWidth = Math.max(nameText.width, descText.width) + RELIC_TOOLTIP_PADDING * 2;
      const panelHeight = nameText.height + descText.height + RELIC_TOOLTIP_PADDING * 2 + 4;
      tooltipBg.setSize(panelWidth, panelHeight);
      tooltip.setPosition(x - RELIC_ICON_RADIUS - 6, y + RELIC_ICON_RADIUS + 6);
      tooltip.setVisible(true);
    };

    icon.on('pointerover', showTooltip);
    icon.on('pointerout', () => tooltip.setVisible(false));
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
