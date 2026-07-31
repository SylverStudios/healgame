/**
 * M4 Upgrade pick modal — renders a blocking overlay on Hub that lets the
 * player choose one secondary stat to bump. Called from HubScene when
 * `save.pendingUpgradePicks > 0`. Each confirm drains one pick, saves, and
 * restarts the scene (so additional picks or the CD modal can follow).
 *
 * Reuses the same panel / card / confirm vocabulary as the M5 CD picker
 * (HubScene.buildCooldownPickModal) — match that file for palette consts.
 */

import Phaser from 'phaser';
import { SECONDARY_IDS } from '../data/secondaryStats';
import type { SecondaryId } from '../data/secondaryStats';
import { FONT, FONT_SIZE_SM, FONT_SIZE_MD, PALETTE_NUM } from './theme';

const MODAL_DEPTH = 2000;
const CARD_W = 170;
const CARD_H = 160;
const CARD_GAP = 16;
const BUTTON_COLOR = 0x3a2a22;
const BORDER_COLOR = 0x0a0605;
const TEXT_COLOR = '#e8d8c8';
const ACCENT_COLOR = '#f2c14e';
const DIM_COLOR = '#a89888';

const UPGRADE_LABELS: Record<SecondaryId, string> = {
  block: 'Block',
  crit: 'Critical',
  haste: 'Haste',
  manaRegen: 'Mana Regen',
};

const UPGRADE_DESCS: Record<SecondaryId, string> = {
  block: 'Tank blocks 1 damage every N hits taken. Higher rank blocks more often.',
  crit: 'Every N casts, that cast critically heals/damages for +50%. Higher ranks crit more often.',
  haste: 'Reduces cast time, letting you heal faster.',
  manaRegen: 'Restores mana over time, enabling more casts.',
};

/**
 * Overlay a blocking upgrade-pick modal over the current scene.
 * `pendingCount` is shown in the subtitle when > 1 so the player knows
 * multiple picks are queued. `onConfirm` is called with the chosen id; the
 * caller is responsible for mutating save, persisting, and restarting.
 */
export function buildUpgradePickModal(
  scene: Phaser.Scene,
  pendingCount: number,
  onConfirm: (id: SecondaryId) => void,
): void {
  const { width, height } = scene.scale;
  const cx = width / 2;
  const cy = height / 2;

  const totalCardW = SECONDARY_IDS.length * CARD_W + (SECONDARY_IDS.length - 1) * CARD_GAP;
  const MW = totalCardW + 60;
  const MH = CARD_H + 130;

  let selectedId: SecondaryId | null = null;
  const cardBgs = new Map<SecondaryId, Phaser.GameObjects.Rectangle>();

  const overlay = scene.add.container(0, 0).setDepth(MODAL_DEPTH);

  overlay.add(
    scene.add.rectangle(cx, cy, width, height, 0x000000, 0.78).setInteractive(),
  );

  overlay.add(
    scene.add.rectangle(cx, cy, MW, MH, PALETTE_NUM.panel).setStrokeStyle(2, BORDER_COLOR),
  );

  overlay.add(
    scene.add
      .text(cx, cy - MH / 2 + 22, 'Choose a Secondary Upgrade', {
        fontFamily: FONT,
        fontSize: FONT_SIZE_MD,
        color: ACCENT_COLOR,
      })
      .setOrigin(0.5),
  );

  const subtitle =
    pendingCount > 1
      ? `${pendingCount} picks remaining — choose 1 now (permanent).`
      : 'This choice is permanent for this save.';
  overlay.add(
    scene.add
      .text(cx, cy - MH / 2 + 50, subtitle, {
        fontFamily: FONT,
        fontSize: FONT_SIZE_SM,
        color: DIM_COLOR,
      })
      .setOrigin(0.5),
  );

  const cardsStartX = cx - totalCardW / 2 + CARD_W / 2;
  const cardY = cy - 8;

  SECONDARY_IDS.forEach((id, i) => {
    const ox = cardsStartX + i * (CARD_W + CARD_GAP);

    const cardBg = scene.add
      .rectangle(ox, cardY, CARD_W, CARD_H, PALETTE_NUM.panelLight)
      .setStrokeStyle(2, BORDER_COLOR)
      .setInteractive({ useHandCursor: true })
      .setName(`upgradeOffer:${id}`);
    overlay.add(cardBg);
    cardBgs.set(id, cardBg);

    cardBg.on('pointerover', () => {
      if (selectedId !== id) cardBg.setStrokeStyle(2, PALETTE_NUM.borderLight);
    });
    cardBg.on('pointerout', () => {
      if (selectedId !== id) cardBg.setStrokeStyle(2, BORDER_COLOR);
    });
    cardBg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.();
      selectCard(id);
    });

    const top = cardY - CARD_H / 2;
    overlay.add(
      scene.add
        .text(ox, top + 18, UPGRADE_LABELS[id], {
          fontFamily: FONT,
          fontSize: FONT_SIZE_SM,
          color: TEXT_COLOR,
          align: 'center',
        })
        .setOrigin(0.5, 0),
    );
    overlay.add(
      scene.add
        .text(ox, top + 42, 'Secondary Stat', {
          fontFamily: FONT,
          fontSize: '10px',
          color: ACCENT_COLOR,
        })
        .setOrigin(0.5, 0),
    );
    overlay.add(
      scene.add
        .text(ox, top + 60, UPGRADE_DESCS[id], {
          fontFamily: FONT,
          fontSize: '10px',
          color: DIM_COLOR,
          wordWrap: { width: CARD_W - 16 },
          align: 'center',
        })
        .setOrigin(0.5, 0),
    );
  });

  const confirmY = cy + MH / 2 - 28;
  const confirmRect = scene.add
    .rectangle(cx, confirmY, 180, 40, BUTTON_COLOR)
    .setStrokeStyle(2, BORDER_COLOR)
    .setInteractive({ useHandCursor: true })
    .setName('upgradeConfirm')
    .setAlpha(0.4);
  overlay.add(confirmRect);

  const confirmLabel = scene.add
    .text(cx, confirmY, 'Confirm', {
      fontFamily: FONT,
      fontSize: FONT_SIZE_SM,
      color: DIM_COLOR,
    })
    .setOrigin(0.5);
  overlay.add(confirmLabel);

  confirmRect.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    pointer.event?.stopPropagation?.();
    if (!selectedId) return;
    onConfirm(selectedId);
  });

  function selectCard(id: SecondaryId): void {
    selectedId = id;
    for (const [bid, bg] of cardBgs) {
      bg.setStrokeStyle(
        bid === id ? 3 : 2,
        bid === id ? PALETTE_NUM.gold : BORDER_COLOR,
      );
    }
    confirmRect.setAlpha(1).setStrokeStyle(2, PALETTE_NUM.gold);
    confirmLabel.setColor(ACCENT_COLOR);
  }
}
