/**
 * Cards-mode content Catalogue — Settings → Catalogue.
 *
 * Dev-support review page (ships in the game): every spell/CD unlock and
 * every authored chip in one place, with icons + icon art prompts when present.
 *
 * Interactive targets (setName) — see docs/semantic-targets.md:
 *   catalogueTabSpells / catalogueTabChips
 *   catalogueBack
 *   catalogueSpell:<id> / catalogueChip:<id>
 */

import Phaser from 'phaser';
import { SceneKeys } from './keys';
import {
  catalogueChipsGrouped,
  catalogueSpells,
  type CatalogueChipEntry,
  type CatalogueSection,
  type CatalogueSpellEntry,
} from '../data/cards/catalogue';
import { CARD_CHIPS } from '../data/cards/chips';
import {
  cooldownIconTextureKey,
  SPELL_ICON_SIZE,
  spellIconTextureKey,
} from '../ui/spellSprites';
import {
  FONT,
  FONT_SIZE_LG,
  FONT_SIZE_MD,
  FONT_SIZE_SM,
  FONT_SIZE_XS,
  PALETTE,
  PALETTE_NUM,
} from '../ui/theme';
import { addButton } from '../ui/panels';
import { fadeInOnCreate, fadeToScene } from '../ui/transitions';
import { glyphChar } from '../ui/glyph';

const BG_COLOR = 0x1a1210;
const BUTTON_COLOR = 0x3a2a22;
const BUTTON_ACTIVE = 0x5a4030;
const BORDER_COLOR = 0x0a0605;
const TEXT_COLOR = PALETTE.text;
const DIM_COLOR = PALETTE.dim;
const ACCENT_COLOR = PALETTE.gold;
const PROMPT_COLOR = '#9ab0c8';

const HEADER_H = 88;
const FOOTER_H = 64;
const CONTENT_PAD_X = 24;
const ROW_GAP = 12;
const ICON_DISPLAY = SPELL_ICON_SIZE * 2; // 32px — matches combat button density

export class CatalogueScene extends Phaser.Scene {
  private section: CatalogueSection = 'spells';
  private scrollY = 0;
  private contentH = 0;
  private contentRoot: Phaser.GameObjects.Container | null = null;
  private scrollHint: Phaser.GameObjects.Text | null = null;
  private tabSpellsLabel: Phaser.GameObjects.Text | null = null;
  private tabChipsLabel: Phaser.GameObjects.Text | null = null;
  private tabSpellsHit: Phaser.GameObjects.Rectangle | null = null;
  private tabChipsHit: Phaser.GameObjects.Rectangle | null = null;

  constructor() {
    super(SceneKeys.Catalogue);
  }

  create(): void {
    this.section = 'spells';
    this.scrollY = 0;
    this.cameras.main.setBackgroundColor(BG_COLOR);
    fadeInOnCreate(this);

    const { width, height } = this.scale;
    const cx = width / 2;

    // Fixed chrome (not scrolled).
    this.add
      .text(cx, 28, 'Catalogue', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_LG,
        color: TEXT_COLOR,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(10);

    this.add
      .text(cx, 52, 'Spell cards content — icons + art prompts when authored', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_XS,
        color: DIM_COLOR,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(10);

    this.tabSpellsHit = this.makeTab(cx - 100, 78, 'Spells', 'catalogueTabSpells', () =>
      this.setSection('spells'),
    );
    this.tabChipsHit = this.makeTab(cx + 100, 78, 'Chips', 'catalogueTabChips', () =>
      this.setSection('chips'),
    );

    // Mask band for scrollable body.
    const bodyTop = HEADER_H;
    const bodyBottom = height - FOOTER_H;
    const bodyH = bodyBottom - bodyTop;
    const maskShape = this.make
      .graphics({ x: 0, y: 0 })
      .fillStyle(0xffffff)
      .fillRect(0, bodyTop, width, bodyH);
    const mask = maskShape.createGeometryMask();
    maskShape.setVisible(false);

    this.contentRoot = this.add.container(0, bodyTop).setDepth(1);
    this.contentRoot.setMask(mask);

    this.scrollHint = this.add
      .text(cx, height - FOOTER_H + 8, '', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_XS,
        color: DIM_COLOR,
      })
      .setOrigin(0.5, 0)
      .setDepth(10);

    const back = this.add
      .rectangle(cx, height - 36, 200, 40, BUTTON_COLOR)
      .setStrokeStyle(2, BORDER_COLOR)
      .setInteractive({ useHandCursor: true })
      .setName('catalogueBack')
      .setDepth(10);
    addButton(this, cx, height - 36, 200, 40, { fillColor: BUTTON_COLOR, hitRect: back });
    this.add
      .text(cx, height - 36, 'Back', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: TEXT_COLOR,
      })
      .setOrigin(0.5)
      .setDepth(11);
    back.on('pointerdown', () => fadeToScene(this, SceneKeys.Settings, {}));

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      this.applyScroll(dy * 0.5);
    });

    // Drag-to-scroll on the body area.
    let dragging = false;
    let lastY = 0;
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.y > bodyTop && pointer.y < bodyBottom) {
        dragging = true;
        lastY = pointer.y;
      }
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!dragging) return;
      this.applyScroll(lastY - pointer.y);
      lastY = pointer.y;
    });
    this.input.on('pointerup', () => {
      dragging = false;
    });

    this.rebuildContent();
    this.refreshTabs();
  }

  private setSection(section: CatalogueSection): void {
    if (this.section === section) return;
    this.section = section;
    this.scrollY = 0;
    this.rebuildContent();
    this.refreshTabs();
  }

  private refreshTabs(): void {
    const spellsActive = this.section === 'spells';
    this.tabSpellsHit?.setFillStyle(spellsActive ? BUTTON_ACTIVE : BUTTON_COLOR);
    this.tabChipsHit?.setFillStyle(!spellsActive ? BUTTON_ACTIVE : BUTTON_COLOR);
    this.tabSpellsHit?.setStrokeStyle(2, spellsActive ? PALETTE_NUM.gold : BORDER_COLOR);
    this.tabChipsHit?.setStrokeStyle(2, !spellsActive ? PALETTE_NUM.gold : BORDER_COLOR);
    this.tabSpellsLabel?.setColor(spellsActive ? ACCENT_COLOR : TEXT_COLOR);
    this.tabChipsLabel?.setColor(!spellsActive ? ACCENT_COLOR : TEXT_COLOR);
  }

  private makeTab(
    x: number,
    y: number,
    label: string,
    name: string,
    onClick: () => void,
  ): Phaser.GameObjects.Rectangle {
    const rect = this.add
      .rectangle(x, y, 160, 32, BUTTON_COLOR)
      .setStrokeStyle(2, BORDER_COLOR)
      .setInteractive({ useHandCursor: true })
      .setName(name)
      .setDepth(10);
    addButton(this, x, y, 160, 32, { fillColor: BUTTON_COLOR, hitRect: rect });
    const text = this.add
      .text(x, y, label, {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: TEXT_COLOR,
      })
      .setOrigin(0.5)
      .setDepth(11);
    if (name === 'catalogueTabSpells') this.tabSpellsLabel = text;
    else this.tabChipsLabel = text;
    rect.on('pointerdown', onClick);
    return rect;
  }

  private rebuildContent(): void {
    if (!this.contentRoot) return;
    this.contentRoot.removeAll(true);

    let y = 8;
    if (this.section === 'spells') {
      y = this.buildSpellsTab(y);
    } else {
      y = this.buildChipsTab(y);
    }
    this.contentH = y + 16;
    this.applyScroll(0);
  }

  private buildSpellsTab(startY: number): number {
    let y = startY;
    const spells = catalogueSpells();
    for (const entry of spells) {
      y = this.drawSpellBlock(entry, y);
      y += ROW_GAP;
    }
    return y;
  }

  private buildChipsTab(startY: number): number {
    let y = startY;
    const groups = catalogueChipsGrouped();
    for (const group of groups) {
      y = this.addSectionHeader(y, `${group.spellName} chips`, `id: ${group.spellId}`);
      for (const slot of group.slots) {
        y = this.addSubHeader(y, `Slot ${slot.slotIndex + 1}`);
        for (const entry of slot.chips) {
          y = this.drawChipBlock(entry, y);
          y += ROW_GAP;
        }
      }
      y += 8;
    }
    // Count line for quick audit.
    y = this.addDimLine(y, `${CARD_CHIPS.length} chips total`);
    return y;
  }

  private drawSpellBlock(entry: CatalogueSpellEntry, y: number): number {
    const { width } = this.scale;
    const left = CONTENT_PAD_X;
    const panelW = width - CONTENT_PAD_X * 2;
    const panelX = width / 2;
    const innerLeft = left + 12;
    const textLeft = innerLeft + ICON_DISPLAY + 16;
    const textW = panelW - ICON_DISPLAY - 40;

    // Measure height.
    const descLines = wrapEstimate(entry.description, textW);
    const promptLines = entry.icon.prompt ? wrapEstimate(`Icon prompt: ${entry.icon.prompt}`, textW) : 0;
    const chipLine = entry.chipIds.length > 0 ? 1 : 0;
    const bodyLines = 2 + entry.stats.length + descLines + promptLines + chipLine;
    const panelH = Math.max(72, 20 + bodyLines * 14 + 16);

    const panelY = y + panelH / 2;
    const bg = this.add
      .rectangle(panelX, panelY, panelW, panelH, PALETTE_NUM.panel)
      .setStrokeStyle(1, BORDER_COLOR)
      .setName(`catalogueSpell:${entry.id}`);
    this.contentRoot!.add(bg);

    // Icon or glyph.
    this.drawIconOrGlyph(
      innerLeft + ICON_DISPLAY / 2,
      y + 12 + ICON_DISPLAY / 2,
      entry.icon.iconAssetId,
      entry.icon.iconKind,
      entry.glyph,
      entry.name,
      entry.id,
    );

    let ty = y + 10;
    const kindTag = entry.kind === 'cooldown' ? 'Major CD' : 'Spell';
    this.contentRoot!.add(
      this.add
        .text(textLeft, ty, `${entry.name}  ·  ${kindTag}`, {
          fontFamily: FONT,
          fontSize: FONT_SIZE_SM,
          color: ACCENT_COLOR,
        })
        .setOrigin(0, 0),
    );
    ty += 16;
    this.contentRoot!.add(
      this.add
        .text(textLeft, ty, `id: ${entry.id}   unlock Lv${entry.minLevel}`, {
          fontFamily: FONT,
          fontSize: FONT_SIZE_XS,
          color: DIM_COLOR,
        })
        .setOrigin(0, 0),
    );
    ty += 14;
    if (entry.stats.length > 0) {
      this.contentRoot!.add(
        this.add
          .text(textLeft, ty, entry.stats.join('  ·  '), {
            fontFamily: FONT,
            fontSize: FONT_SIZE_XS,
            color: TEXT_COLOR,
            wordWrap: { width: textW },
          })
          .setOrigin(0, 0),
      );
      ty += 14;
    }
    if (entry.description) {
      const desc = this.add
        .text(textLeft, ty, entry.description, {
          fontFamily: FONT,
          fontSize: FONT_SIZE_XS,
          color: TEXT_COLOR,
          wordWrap: { width: textW },
        })
        .setOrigin(0, 0);
      this.contentRoot!.add(desc);
      ty += Math.max(14, desc.height + 2);
    }
    if (entry.icon.prompt) {
      const prompt = this.add
        .text(textLeft, ty, `Icon prompt: ${entry.icon.prompt}`, {
          fontFamily: FONT,
          fontSize: FONT_SIZE_XS,
          color: PROMPT_COLOR,
          wordWrap: { width: textW },
        })
        .setOrigin(0, 0);
      this.contentRoot!.add(prompt);
      ty += Math.max(14, prompt.height + 2);
    } else if (!entry.icon.iconAssetId) {
      this.contentRoot!.add(
        this.add
          .text(textLeft, ty, 'Icon: none yet', {
            fontFamily: FONT,
            fontSize: FONT_SIZE_XS,
            color: DIM_COLOR,
          })
          .setOrigin(0, 0),
      );
      ty += 14;
    }
    if (entry.chipIds.length > 0) {
      this.contentRoot!.add(
        this.add
          .text(textLeft, ty, `Chips (${entry.chipIds.length}): ${entry.chipIds.join(', ')}`, {
            fontFamily: FONT,
            fontSize: FONT_SIZE_XS,
            color: DIM_COLOR,
            wordWrap: { width: textW },
          })
          .setOrigin(0, 0),
      );
    }

    return y + panelH;
  }

  private drawChipBlock(entry: CatalogueChipEntry, y: number): number {
    const { width } = this.scale;
    const left = CONTENT_PAD_X;
    const panelW = width - CONTENT_PAD_X * 2;
    const panelX = width / 2;
    const innerLeft = left + 12;
    const textLeft = innerLeft + ICON_DISPLAY + 16;
    const textW = panelW - ICON_DISPLAY - 40;
    const { chip } = entry;

    const arch = chip.archetype ? `  ·  ${chip.archetype}` : '';
    const promptExtra = entry.icon.prompt ? wrapEstimate(`Icon prompt: ${entry.icon.prompt}`, textW) : 0;
    const panelH = Math.max(
      64,
      24 + (2 + entry.effectLines.length + promptExtra) * 14 + 12,
    );

    const panelY = y + panelH / 2;
    const bg = this.add
      .rectangle(panelX, panelY, panelW, panelH, PALETTE_NUM.panelLight)
      .setStrokeStyle(1, BORDER_COLOR)
      .setInteractive({ useHandCursor: false })
      .setName(`catalogueChip:${chip.id}`);
    this.contentRoot!.add(bg);

    this.drawIconOrGlyph(
      innerLeft + ICON_DISPLAY / 2,
      y + 12 + ICON_DISPLAY / 2,
      entry.icon.iconAssetId,
      entry.icon.iconKind,
      chip.name[0] ?? '?',
      chip.name,
      chip.id,
    );

    let ty = y + 10;
    this.contentRoot!.add(
      this.add
        .text(textLeft, ty, `${chip.name}${arch}`, {
          fontFamily: FONT,
          fontSize: FONT_SIZE_SM,
          color: ACCENT_COLOR,
        })
        .setOrigin(0, 0),
    );
    ty += 16;
    this.contentRoot!.add(
      this.add
        .text(textLeft, ty, `id: ${chip.id}   ${entry.slotLabel}   → ${entry.spellName}`, {
          fontFamily: FONT,
          fontSize: FONT_SIZE_XS,
          color: DIM_COLOR,
        })
        .setOrigin(0, 0),
    );
    ty += 14;
    const desc = this.add
      .text(textLeft, ty, chip.description, {
        fontFamily: FONT,
        fontSize: FONT_SIZE_XS,
        color: TEXT_COLOR,
        wordWrap: { width: textW },
      })
      .setOrigin(0, 0);
    this.contentRoot!.add(desc);
    ty += Math.max(14, desc.height + 2);

    for (const line of entry.effectLines) {
      this.contentRoot!.add(
        this.add
          .text(textLeft, ty, `· ${line}`, {
            fontFamily: FONT,
            fontSize: FONT_SIZE_XS,
            color: DIM_COLOR,
            wordWrap: { width: textW },
          })
          .setOrigin(0, 0),
      );
      ty += 14;
    }

    if (entry.icon.prompt) {
      const prompt = this.add
        .text(textLeft, ty, `Icon prompt: ${entry.icon.prompt}`, {
          fontFamily: FONT,
          fontSize: FONT_SIZE_XS,
          color: PROMPT_COLOR,
          wordWrap: { width: textW },
        })
        .setOrigin(0, 0);
      this.contentRoot!.add(prompt);
    }

    return y + panelH;
  }

  private drawIconOrGlyph(
    x: number,
    y: number,
    iconAssetId: string | null,
    iconKind: 'spell' | 'cooldown' | null,
    glyph: string,
    name: string,
    id: string,
  ): void {
    let key: string | null = null;
    if (iconAssetId && iconKind === 'spell') key = spellIconTextureKey(iconAssetId);
    if (iconAssetId && iconKind === 'cooldown') key = cooldownIconTextureKey(iconAssetId);

    if (key && this.textures.exists(key)) {
      const img = this.add
        .image(x, y, key)
        .setDisplaySize(ICON_DISPLAY, ICON_DISPLAY)
        .setOrigin(0.5);
      this.contentRoot!.add(img);
      return;
    }

    const frame = this.add
      .rectangle(x, y, ICON_DISPLAY, ICON_DISPLAY, BUTTON_COLOR)
      .setStrokeStyle(1, BORDER_COLOR);
    const g = this.add
      .text(x, y, glyphChar({ glyph, name, id }), {
        fontFamily: FONT,
        fontSize: FONT_SIZE_MD,
        color: TEXT_COLOR,
      })
      .setOrigin(0.5);
    this.contentRoot!.add(frame);
    this.contentRoot!.add(g);
  }

  private addSectionHeader(y: number, title: string, subtitle: string): number {
    const { width } = this.scale;
    this.contentRoot!.add(
      this.add
        .text(CONTENT_PAD_X, y, title, {
          fontFamily: FONT,
          fontSize: FONT_SIZE_MD,
          color: ACCENT_COLOR,
        })
        .setOrigin(0, 0),
    );
    this.contentRoot!.add(
      this.add
        .text(width - CONTENT_PAD_X, y + 6, subtitle, {
          fontFamily: FONT,
          fontSize: FONT_SIZE_XS,
          color: DIM_COLOR,
        })
        .setOrigin(1, 0),
    );
    return y + 28;
  }

  private addSubHeader(y: number, title: string): number {
    this.contentRoot!.add(
      this.add
        .text(CONTENT_PAD_X + 4, y, title, {
          fontFamily: FONT,
          fontSize: FONT_SIZE_SM,
          color: TEXT_COLOR,
        })
        .setOrigin(0, 0),
    );
    return y + 20;
  }

  private addDimLine(y: number, text: string): number {
    const { width } = this.scale;
    this.contentRoot!.add(
      this.add
        .text(width / 2, y, text, {
          fontFamily: FONT,
          fontSize: FONT_SIZE_XS,
          color: DIM_COLOR,
        })
        .setOrigin(0.5, 0),
    );
    return y + 18;
  }

  private applyScroll(delta: number): void {
    if (!this.contentRoot) return;
    const { height } = this.scale;
    const bodyH = height - HEADER_H - FOOTER_H;
    const maxScroll = Math.max(0, this.contentH - bodyH);
    this.scrollY = Phaser.Math.Clamp(this.scrollY + delta, 0, maxScroll);
    this.contentRoot.y = HEADER_H - this.scrollY;
    if (this.scrollHint) {
      this.scrollHint.setText(
        maxScroll > 0
          ? `Scroll · ${Math.round(this.scrollY)} / ${Math.round(maxScroll)}`
          : '',
      );
    }
  }
}

/** Rough wrap estimate for panel height before Text metrics exist. */
function wrapEstimate(text: string, widthPx: number): number {
  // HealgameIron ~8px advance at 12px size — ~width/7 chars per line.
  const charsPerLine = Math.max(20, Math.floor(widthPx / 7));
  return Math.max(1, Math.ceil(text.length / charsPerLine));
}
