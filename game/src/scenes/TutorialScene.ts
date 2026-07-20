/**
 * First scene a new player sees (poc-spec §3): a one-click "learn your heal"
 * moment, then straight into Ash Gate for the expected first wipe. Temp art
 * only — panels + text buttons, dark palette, pixel font.
 */

import Phaser from 'phaser';
import { SceneKeys } from './keys';
import { loadSave, saveGame } from '../save/save';
import { loadoutFromSave } from '../data/talentTree';
import { ASH_GATE } from '../data/encounters';
import { SPELLS } from '../data/constants';
import type { CombatSceneData } from './CombatScene';
import { FONT, FONT_SIZE_SM, FONT_SIZE_MD, FONT_SIZE_LG, PALETTE, PALETTE_NUM } from '../ui/theme';
import { addButton, addPanel } from '../ui/panels';
import { drawFramedPortrait, PORTRAIT_FRAME_DISPLAY_SIZE } from '../ui/portraitSprites';
import { COMBAT_ENTRY_FADE_OUT_MS, fadeInOnCreate, fadeToScene } from '../ui/transitions';

const BG_COLOR = 0x1a1210;
const BUTTON_COLOR = 0x3a2a22;
const BORDER_COLOR = 0x0a0605;
const TEXT_COLOR = '#e8d8c8';
const DIM_COLOR = '#a89888';
const ACCENT_COLOR = '#f2c14e';

// Chunk 5 (bible item 5): healer bust beside the copy panel — same
// drawFramedPortrait inset as the combat result panel (ui/portraitSprites.ts).
const TUTORIAL_PORTRAIT_GAP = 12;

export class TutorialScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Tutorial);
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(BG_COLOR);
    // Chunk 6 (bible item 6): fade in on scene entry.
    fadeInOnCreate(this);

    // Chunk 9 (bible item 9): wordmark treatment for the title — this is the
    // "one genuine gap" the chunk-9 bible item calls out (font-at-display-size,
    // healer portrait, and panel kit already ship from chunks 1/5/4). Code-only
    // per docs/ui-theme-handoff.md's chunk-9 guidance: gold accent (this
    // codebase's established "important text" convention — panel-kit CURRENT
    // outline, button labels) plus a 1px-offset shadow layer in the panel
    // kit's dark border shade for a flat pixel-outline look (no soft
    // gradients/anti-aliasing, per art/STYLE.md). Zero PixelLab spend.
    const TITLE_Y = 60;
    const TITLE_SHADOW_OFFSET = 2;
    this.add
      .text(width / 2 + TITLE_SHADOW_OFFSET, TITLE_Y + TITLE_SHADOW_OFFSET, 'healgame', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_LG,
        color: PALETTE.borderDark,
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, TITLE_Y, 'healgame', { fontFamily: FONT, fontSize: FONT_SIZE_LG, color: PALETTE.gold })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 112, "You are the warband's only healer.", {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
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

    // Chunk 4 (bible item 4): copy panel — ui/panels.ts.
    const copyPanelWidth = 700;
    const copyPanelX = width / 2;
    const copyPanelY = 220;
    addPanel(this, copyPanelX, copyPanelY, copyPanelWidth, 150);
    this.add
      .text(copyPanelX, copyPanelY, instructions, {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: DIM_COLOR,
        align: 'center',
      })
      .setOrigin(0.5);

    // Chunk 5 (bible item 5): healer bust beside the copy panel (see const doc above).
    // Shown immediately (no reveal tween — this screen has none elsewhere), so undo
    // drawFramedPortrait's default alpha-0 start.
    const portraitX = copyPanelX - copyPanelWidth / 2 - TUTORIAL_PORTRAIT_GAP - PORTRAIT_FRAME_DISPLAY_SIZE / 2;
    const healerPortrait = drawFramedPortrait(this, portraitX, copyPanelY, 'healer', 0);
    healerPortrait?.frame.container.setAlpha(1);
    healerPortrait?.image.setAlpha(1);

    const buttonY = height - 110;
    const button = this.add
      .rectangle(width / 2, buttonY, 340, 74, BUTTON_COLOR)
      .setStrokeStyle(2, BORDER_COLOR)
      .setInteractive({ useHandCursor: true })
      .setName('tutorialLearn');
    addButton(this, width / 2, buttonY, 340, 74, { fillColor: PALETTE_NUM.panelLight, hitRect: button });
    this.add
      .text(width / 2, buttonY, 'Learn Solemn Mend', { fontFamily: FONT, fontSize: FONT_SIZE_MD, color: ACCENT_COLOR })
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
    // Chunk 6: same shorter fade-out + CombatScene chunky wipe-in as the
    // Hub dungeon-list entry (docs/ui-theme-handoff.md "into battle" beat
    // applies to every combat entry, not just the Hub one).
    fadeToScene(this, SceneKeys.Combat, combatData, COMBAT_ENTRY_FADE_OUT_MS);
  }
}
