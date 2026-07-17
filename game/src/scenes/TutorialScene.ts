/**
 * First scene a new player sees (poc-spec §3): a one-click "learn your heal"
 * moment, then straight into Ash Gate for the expected first wipe. Temp art
 * only — panels + text buttons, dark palette, monospace.
 */

import Phaser from 'phaser';
import { SceneKeys } from './keys';
import { loadSave, saveGame } from '../save/save';
import { loadoutFromSave } from '../data/talentTree';
import { ASH_GATE } from '../data/encounters';
import { SPELLS } from '../data/constants';
import type { CombatSceneData } from './CombatScene';

const BG_COLOR = 0x1a1210;
const BUTTON_COLOR = 0x3a2a22;
const BORDER_COLOR = 0x0a0605;
const TEXT_COLOR = '#e8d8c8';
const DIM_COLOR = '#a89888';
const ACCENT_COLOR = '#f2c14e';
const FONT = 'monospace';

export class TutorialScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Tutorial);
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(BG_COLOR);

    this.add
      .text(width / 2, 60, 'healgame', { fontFamily: FONT, fontSize: '32px', color: TEXT_COLOR })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 112, "You are the warband's only healer.", {
        fontFamily: FONT,
        fontSize: '18px',
        color: TEXT_COLOR,
      })
      .setOrigin(0.5);

    const instructions = [
      'In combat: click an ally to target them, then click a heal (or press its',
      'QWER key). Bonk (Q) hits the front enemy — no target click needed.',
      '',
      "Ash Gate will wipe your party the first time through — that's expected.",
      'XP from every enemy kill is kept even if you wipe.',
    ].join('\n');

    this.add
      .text(width / 2, 220, instructions, {
        fontFamily: FONT,
        fontSize: '14px',
        color: DIM_COLOR,
        align: 'center',
      })
      .setOrigin(0.5);

    const buttonY = height - 110;
    const button = this.add
      .rectangle(width / 2, buttonY, 340, 74, BUTTON_COLOR)
      .setStrokeStyle(2, BORDER_COLOR)
      .setInteractive({ useHandCursor: true })
      .setName('tutorialLearn');
    this.add
      .text(width / 2, buttonY, 'Learn Solemn Mend', { fontFamily: FONT, fontSize: '20px', color: ACCENT_COLOR })
      .setOrigin(0.5);

    button.on('pointerdown', () => this.onLearnSpell());
  }

  private onLearnSpell(): void {
    const save = loadSave();
    if (!save.unlockedSpells.includes(SPELLS.bonk.id)) {
      save.unlockedSpells.push(SPELLS.bonk.id);
    }
    if (!save.unlockedSpells.includes(SPELLS.solemnMend.id)) {
      save.unlockedSpells.push(SPELLS.solemnMend.id);
    }
    // Q = Bonk (starter), W = Solemn Mend for the first fight.
    if (save.actionBar[0] !== SPELLS.bonk.id) save.actionBar[0] = SPELLS.bonk.id;
    if (save.actionBar[1] !== SPELLS.solemnMend.id) save.actionBar[1] = SPELLS.solemnMend.id;
    save.tutorialDone = true;
    saveGame(save);

    const combatData: CombatSceneData = {
      encounterId: ASH_GATE.id,
      loadout: loadoutFromSave(save),
      returnTo: SceneKeys.Hub,
    };
    this.scene.start(SceneKeys.Combat, combatData);
  }
}
