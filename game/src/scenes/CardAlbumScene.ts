/**
 * Spell-card album (cards progression mode).
 *
 * Shows owned spells + major CDs as cards. Spells have 2 chip slots; majors
 * unlock on the album with no slots (PoC). Spending an upgrade point opens a
 * fixed three-way draft for the next empty slot → applyChipPurchase + save.
 *
 * Interactive targets (setName) — see docs/semantic-targets.md:
 *   cardAlbumBack
 *   cardSpell:<spellId|cooldownId>
 *   cardUpgrade:<spellId>
 *   cardChipOffer:<chipId>
 *   cardChipConfirm / cardChipCancel
 */

import Phaser from 'phaser';
import { SceneKeys } from './keys';
import { loadSave, saveGame, type SaveData } from '../save/save';
import { levelForXp } from '../data/constants';
import { CARD_SLOTS, cooldownIdsAtLevel, spellIdsAtLevel } from '../data/cards/unlocks';
import { chipById, type CardChipDef, type CardChipEffect } from '../data/cards/chips';
import { offersForNextSlot } from '../data/cards/draft';
import { applyChipPurchase, ownedSpellsFromCardSave } from '../data/cards/resolve';
import { radialSpellById } from '../data/radial/spells';
import { cooldownById } from '../data/cooldowns';
import type { SpellDef } from '../combat/types';
import {
  FONT,
  FONT_SIZE_LG,
  FONT_SIZE_MD,
  FONT_SIZE_SM,
  FONT_SIZE_XS,
  PALETTE,
  PALETTE_NUM,
} from '../ui/theme';
import { addButton, addPanel } from '../ui/panels';
import { fadeInOnCreate, fadeToScene } from '../ui/transitions';

const BG_COLOR = 0x1a1210;
const BUTTON_COLOR = 0x3a2a22;
const BORDER_COLOR = 0x0a0605;
const PANEL_COLOR = PALETTE_NUM.panel;
const PANEL_LIGHT = PALETTE_NUM.panelLight;
const TEXT_COLOR = PALETTE.text;
const DIM_COLOR = PALETTE.dim;
const ACCENT_COLOR = PALETTE.gold;

const CARD_W = 200;
const CARD_H = 280;
const CARD_GAP = 20;
const SLOT_ROW_H = 28;

const MODAL_DEPTH = 2000;

export class CardAlbumScene extends Phaser.Scene {
  private save!: SaveData;
  private overlay!: Phaser.GameObjects.Container;
  private draftSpellId: string | null = null;
  private selectedChipId: string | null = null;
  private confirmHit: Phaser.GameObjects.Rectangle | null = null;
  private confirmLabel: Phaser.GameObjects.Text | null = null;
  private modalOpen = false;

  constructor() {
    super(SceneKeys.CardAlbum);
  }

  create(): void {
    this.save = loadSave();
    this.cameras.main.setBackgroundColor(BG_COLOR);
    fadeInOnCreate(this);

    this.overlay = this.add.container(0, 0).setDepth(MODAL_DEPTH).setVisible(false);
    this.modalOpen = false;
    this.draftSpellId = null;
    this.selectedChipId = null;
    this.confirmHit = null;
    this.confirmLabel = null;

    this.buildAlbum();
  }

  private buildAlbum(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const level = levelForXp(this.save.xp);
    const spellIds = spellIdsAtLevel(level).filter((id) =>
      this.save.unlockedSpells.includes(id),
    );
    const ownedSpells =
      spellIds.length > 0
        ? spellIds
        : this.save.unlockedSpells.filter((id) => radialSpellById(id) !== undefined);
    const cdIds = cooldownIdsAtLevel(level);

    this.add
      .text(cx, 28, 'Spells', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_LG,
        color: TEXT_COLOR,
      })
      .setOrigin(0.5);

    const points = Math.max(0, Math.floor(this.save.upgradePoints));
    this.add
      .text(cx, 58, `Upgrade points: ${points}`, {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: points > 0 ? ACCENT_COLOR : DIM_COLOR,
      })
      .setOrigin(0.5);

    const entries: AlbumEntry[] = [
      ...ownedSpells.map((id): AlbumEntry => ({ kind: 'spell', id })),
      ...cdIds.map((id): AlbumEntry => ({ kind: 'cooldown', id })),
    ];

    const n = entries.length;
    const totalW = n * CARD_W + Math.max(0, n - 1) * CARD_GAP;
    const startX = cx - totalW / 2 + CARD_W / 2;
    const cardY = height / 2 - 10;

    entries.forEach((entry, i) => {
      const x = startX + i * (CARD_W + CARD_GAP);
      if (entry.kind === 'spell') {
        this.buildSpellCard(x, cardY, entry.id, points);
      } else {
        this.buildCooldownCard(x, cardY, entry.id);
      }
    });

    if (n === 0) {
      this.add
        .text(cx, height / 2, 'No spells unlocked yet.', {
          fontFamily: FONT,
          fontSize: FONT_SIZE_SM,
          color: DIM_COLOR,
        })
        .setOrigin(0.5);
    }

    const back = this.add
      .rectangle(cx, height - 40, 200, 44, BUTTON_COLOR)
      .setStrokeStyle(2, BORDER_COLOR)
      .setInteractive({ useHandCursor: true })
      .setName('cardAlbumBack');
    addButton(this, cx, height - 40, 200, 44, { fillColor: BUTTON_COLOR, hitRect: back });
    this.add
      .text(cx, height - 40, 'Back', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: TEXT_COLOR,
      })
      .setOrigin(0.5);
    back.on('pointerdown', () => {
      if (this.modalOpen) return;
      fadeToScene(this, SceneKeys.Hub, {});
    });
  }

  private buildSpellCard(x: number, y: number, spellId: string, points: number): void {
    const spell =
      ownedSpellsFromCardSave(this.save).find((s) => s.id === spellId) ??
      radialSpellById(spellId);
    const name = spell?.name ?? spellId;
    const desc = spell?.description ?? '';
    const chips = this.save.spellChips[spellId] ?? [];
    const canUpgrade =
      points > 0 && chips.length < CARD_SLOTS && offersForNextSlot(spellId, chips) !== null;

    const bg = this.add
      .rectangle(x, y, CARD_W, CARD_H, PANEL_COLOR)
      .setStrokeStyle(2, BORDER_COLOR)
      .setInteractive({ useHandCursor: true })
      .setName(`cardSpell:${spellId}`);
    addPanel(this, x, y, CARD_W, CARD_H, { fillColor: PANEL_COLOR, hitRect: bg });

    const top = y - CARD_H / 2;
    this.add
      .text(x, top + 18, name, {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: TEXT_COLOR,
      })
      .setOrigin(0.5);
    this.add
      .text(x, top + 42, desc, {
        fontFamily: FONT,
        fontSize: FONT_SIZE_XS,
        color: DIM_COLOR,
        align: 'center',
        wordWrap: { width: CARD_W - 24 },
      })
      .setOrigin(0.5, 0);

    for (let slot = 0; slot < CARD_SLOTS; slot++) {
      const chipId = chips[slot];
      const chip = chipId ? chipById(chipId) : undefined;
      const label = chip ? `Slot ${slot + 1}: ${chip.name}` : `Slot ${slot + 1}: empty`;
      const slotY = top + 130 + slot * SLOT_ROW_H;
      this.add.rectangle(x, slotY, CARD_W - 28, SLOT_ROW_H - 4, PANEL_LIGHT).setStrokeStyle(1, BORDER_COLOR);
      this.add
        .text(x, slotY, label, {
          fontFamily: FONT,
          fontSize: FONT_SIZE_XS,
          color: chip ? ACCENT_COLOR : DIM_COLOR,
        })
        .setOrigin(0.5);
    }

    const uy = y + CARD_H / 2 - 32;
    if (canUpgrade) {
      const upgrade = this.add
        .rectangle(x, uy, CARD_W - 36, 36, BUTTON_COLOR)
        .setStrokeStyle(2, PALETTE_NUM.gold)
        .setInteractive({ useHandCursor: true })
        .setName(`cardUpgrade:${spellId}`);
      addButton(this, x, uy, CARD_W - 36, 36, {
        fillColor: BUTTON_COLOR,
        hitRect: upgrade,
        state: 'current',
      });
      this.add
        .text(x, uy, 'Upgrade', {
          fontFamily: FONT,
          fontSize: FONT_SIZE_SM,
          color: ACCENT_COLOR,
        })
        .setOrigin(0.5);
      upgrade.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        // Stop the card bg underneath from also handling this click.
        pointer.event?.stopPropagation?.();
        this.openDraftModal(spellId);
      });
    } else {
      const hint =
        chips.length >= CARD_SLOTS ? 'Fully upgraded' : points <= 0 ? 'No points' : '';
      if (hint) {
        this.add
          .text(x, uy, hint, {
            fontFamily: FONT,
            fontSize: FONT_SIZE_XS,
            color: DIM_COLOR,
          })
          .setOrigin(0.5);
      }
    }
  }

  private buildCooldownCard(x: number, y: number, cooldownId: string): void {
    const cd = cooldownById(cooldownId);
    const name = cd?.name ?? cooldownId;
    const desc = cd?.description ?? '';

    const bg = this.add
      .rectangle(x, y, CARD_W, CARD_H, PANEL_COLOR)
      .setStrokeStyle(2, BORDER_COLOR)
      .setInteractive({ useHandCursor: true })
      .setName(`cardSpell:${cooldownId}`);
    addPanel(this, x, y, CARD_W, CARD_H, { fillColor: PANEL_COLOR, hitRect: bg });

    const top = y - CARD_H / 2;
    this.add
      .text(x, top + 18, name, {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: TEXT_COLOR,
      })
      .setOrigin(0.5);
    this.add
      .text(x, top + 44, 'Major cooldown', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_XS,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5);
    this.add
      .text(x, top + 72, desc, {
        fontFamily: FONT,
        fontSize: FONT_SIZE_XS,
        color: DIM_COLOR,
        align: 'center',
        wordWrap: { width: CARD_W - 24 },
      })
      .setOrigin(0.5, 0);
    this.add
      .text(x, y + CARD_H / 2 - 32, 'No chip slots', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_XS,
        color: DIM_COLOR,
      })
      .setOrigin(0.5);
  }

  private openDraftModal(spellId: string): void {
    const owned = this.save.spellChips[spellId] ?? [];
    const offers = offersForNextSlot(spellId, owned);
    if (!offers || this.modalOpen) return;

    this.modalOpen = true;
    this.draftSpellId = spellId;
    this.selectedChipId = null;
    this.overlay.removeAll(true);
    this.overlay.setVisible(true);

    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    const MW = 720;
    const MH = 360;

    const backdrop = this.add
      .rectangle(cx, cy, width, height, 0x000000, 0.72)
      .setInteractive();
    backdrop.on('pointerdown', () => this.dismissModal());
    this.overlay.add(backdrop);

    this.overlay.add(
      this.add.rectangle(cx, cy, MW, MH, PANEL_COLOR).setStrokeStyle(2, BORDER_COLOR),
    );

    const spell = radialSpellById(spellId);
    const slotNum = owned.length + 1;
    this.overlay.add(
      this.add
        .text(cx, cy - MH / 2 + 22, `Upgrade ${spell?.name ?? spellId} — slot ${slotNum}`, {
          fontFamily: FONT,
          fontSize: FONT_SIZE_MD,
          color: ACCENT_COLOR,
        })
        .setOrigin(0.5),
    );
    this.overlay.add(
      this.add
        .text(cx, cy - MH / 2 + 48, 'Pick one chip. This spends 1 upgrade point.', {
          fontFamily: FONT,
          fontSize: FONT_SIZE_XS,
          color: DIM_COLOR,
        })
        .setOrigin(0.5),
    );

    const baseSpell =
      ownedSpellsFromCardSave(this.save).find((s) => s.id === spellId) ??
      radialSpellById(spellId);
    const offerW = 200;
    const offerGap = 24;
    const offerY = cy - 10;
    const offersStartX = cx - (3 * offerW + 2 * offerGap) / 2 + offerW / 2;

    offers.forEach((chipId, i) => {
      const chip = chipById(chipId);
      if (!chip) return;
      const ox = offersStartX + i * (offerW + offerGap);
      this.buildOfferCard(ox, offerY, chip, baseSpell ?? null);
    });

    // Flat modal buttons (no addButton) so frames live in the overlay and
    // destroy cleanly with dismiss — mirrors RadialTreeScene choice modal.
    const confirm = this.add
      .rectangle(cx - 100, cy + MH / 2 - 36, 180, 40, BUTTON_COLOR)
      .setStrokeStyle(2, BORDER_COLOR)
      .setInteractive({ useHandCursor: true })
      .setName('cardChipConfirm')
      .setAlpha(0.45);
    this.overlay.add(confirm);
    this.confirmLabel = this.add
      .text(cx - 100, cy + MH / 2 - 36, 'Confirm', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: DIM_COLOR,
      })
      .setOrigin(0.5);
    this.overlay.add(this.confirmLabel);
    this.confirmHit = confirm;
    confirm.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.();
      this.confirmPurchase();
    });

    const cancel = this.add
      .rectangle(cx + 100, cy + MH / 2 - 36, 160, 40, BUTTON_COLOR)
      .setStrokeStyle(2, BORDER_COLOR)
      .setInteractive({ useHandCursor: true })
      .setName('cardChipCancel');
    this.overlay.add(cancel);
    this.overlay.add(
      this.add
        .text(cx + 100, cy + MH / 2 - 36, 'Cancel', {
          fontFamily: FONT,
          fontSize: FONT_SIZE_SM,
          color: TEXT_COLOR,
        })
        .setOrigin(0.5),
    );
    cancel.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.();
      this.dismissModal();
    });
  }

  private buildOfferCard(
    x: number,
    y: number,
    chip: CardChipDef,
    baseSpell: SpellDef | null,
  ): void {
    const OW = 200;
    const OH = 200;
    const hit = this.add
      .rectangle(x, y, OW, OH, PANEL_LIGHT)
      .setStrokeStyle(2, BORDER_COLOR)
      .setInteractive({ useHandCursor: true })
      .setName(`cardChipOffer:${chip.id}`);
    this.overlay.add(hit);

    hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.();
      this.selectOffer(chip.id);
    });
    hit.on('pointerover', () => {
      if (this.selectedChipId !== chip.id) hit.setStrokeStyle(2, PALETTE_NUM.borderLight);
    });
    hit.on('pointerout', () => {
      if (this.selectedChipId !== chip.id) hit.setStrokeStyle(2, BORDER_COLOR);
    });

    const top = y - OH / 2;
    this.overlay.add(
      this.add
        .text(x, top + 14, chip.name, {
          fontFamily: FONT,
          fontSize: FONT_SIZE_SM,
          color: TEXT_COLOR,
          wordWrap: { width: OW - 16 },
          align: 'center',
        })
        .setOrigin(0.5, 0),
    );
    this.overlay.add(
      this.add
        .text(x, top + 44, chip.description, {
          fontFamily: FONT,
          fontSize: FONT_SIZE_XS,
          color: DIM_COLOR,
          wordWrap: { width: OW - 16 },
          align: 'center',
        })
        .setOrigin(0.5, 0),
    );

    const preview = castModPreviewLine(chip, baseSpell);
    if (preview) {
      this.overlay.add(
        this.add
          .text(x, y + OH / 2 - 28, preview, {
            fontFamily: FONT,
            fontSize: FONT_SIZE_XS,
            color: ACCENT_COLOR,
            align: 'center',
            wordWrap: { width: OW - 16 },
          })
          .setOrigin(0.5),
      );
    }
  }

  private selectOffer(chipId: string): void {
    this.selectedChipId = chipId;
    for (const child of this.overlay.list) {
      if (!(child instanceof Phaser.GameObjects.Rectangle)) continue;
      const name = child.name;
      if (!name.startsWith('cardChipOffer:')) continue;
      const id = name.slice('cardChipOffer:'.length);
      child.setStrokeStyle(id === chipId ? 3 : 2, id === chipId ? PALETTE_NUM.gold : BORDER_COLOR);
    }
    if (this.confirmHit) {
      this.confirmHit.setAlpha(1);
      this.confirmHit.setStrokeStyle(2, PALETTE_NUM.gold);
    }
    if (this.confirmLabel) {
      this.confirmLabel.setColor(ACCENT_COLOR);
    }
  }

  private confirmPurchase(): void {
    if (!this.draftSpellId || !this.selectedChipId) return;
    const ok = applyChipPurchase(this.save, this.draftSpellId, this.selectedChipId);
    if (!ok) {
      this.dismissModal();
      return;
    }
    saveGame(this.save);
    // Fresh layout (chips filled, points depleted) — restart keeps create() simple.
    this.scene.restart();
  }

  private dismissModal(): void {
    this.modalOpen = false;
    this.draftSpellId = null;
    this.selectedChipId = null;
    this.confirmHit = null;
    this.confirmLabel = null;
    this.overlay.setVisible(false);
    this.overlay.removeAll(true);
  }
}

type AlbumEntry = { kind: 'spell'; id: string } | { kind: 'cooldown'; id: string };

/** Cheap before→after line for castMod chips; synergies rely on description. */
function castModPreviewLine(chip: CardChipDef, base: SpellDef | null): string | null {
  if (!base) return null;
  const mods = chip.effects.filter(
    (e): e is Extract<CardChipEffect, { kind: 'castMod' }> => e.kind === 'castMod',
  );
  if (mods.length === 0) return null;

  const parts: string[] = [];
  for (const m of mods) {
    if (m.manaDelta !== undefined) {
      const after = Math.max(0, base.mana + m.manaDelta);
      parts.push(`Cost ${base.mana}→${after}`);
    }
    if (m.healDelta !== undefined) {
      const after = Math.max(0, base.heal + m.healDelta);
      parts.push(`Power ${base.heal}→${after}`);
    }
    if (m.damageDelta !== undefined) {
      const before = base.damage ?? 0;
      const after = Math.max(0, before + m.damageDelta);
      parts.push(`Power ${before}→${after}`);
    }
    if (m.castMsDelta !== undefined) {
      const after = Math.max(0, base.castMs + m.castMsDelta);
      parts.push(`Speed ${base.castMs}→${after}ms`);
    }
    if (m.cooldownMsDelta !== undefined && base.cooldownMs !== undefined) {
      const after = Math.max(0, base.cooldownMs + m.cooldownMsDelta);
      parts.push(`CD ${base.cooldownMs}→${after}ms`);
    }
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}
