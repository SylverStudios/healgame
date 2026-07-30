/**
 * Battle Mend armed overhead cue (Wave 5b). Shown above the healer while
 * `CombatState.armedManaDiscountSpellIds` is non-empty. Prefers a mapped spell
 * icon; otherwise a gold diamond (distinct from the Arming Mend side rune).
 */

import Phaser from 'phaser';
import { SPELL_ICON_SIZE, spellIconTextureKey } from './spellSprites';

/** Matches unitSprite hpY = -(height/2 + 10) for a 64px healer, then 2× that. */
export const BATTLE_MEND_ICON_Y_OFFSET = 2 * (64 / 2 + 10);
const ICON_DISPLAY = SPELL_ICON_SIZE * 2;
const GOLD = 0xf2c14e;
const STROKE = 0x8a7868;

export type BattleMendIcon = Phaser.GameObjects.Image | Phaser.GameObjects.Polygon;

/** Sync overhead Battle Mend cue; pass null/undefined healer to clear. */
export function syncBattleMendIcon(
  scene: Phaser.Scene,
  current: BattleMendIcon | null,
  armedSpellIds: readonly string[],
  healer: { getHomeX(): number; getHomeY(): number } | null | undefined,
): BattleMendIcon | null {
  if (armedSpellIds.length === 0 || !healer) {
    current?.destroy();
    return null;
  }

  const x = healer.getHomeX();
  const y = healer.getHomeY() - BATTLE_MEND_ICON_Y_OFFSET;
  const iconSpellId = armedSpellIds.find((id) =>
    scene.textures.exists(spellIconTextureKey(id)),
  );
  const textureKey = iconSpellId !== undefined ? spellIconTextureKey(iconSpellId) : null;
  const needsSprite = textureKey !== null;
  const hasSprite = current instanceof Phaser.GameObjects.Image;

  let icon = current;
  if (icon && needsSprite !== hasSprite) {
    icon.destroy();
    icon = null;
  }

  if (!icon) {
    if (textureKey !== null) {
      return scene.add
        .image(x, y, textureKey)
        .setOrigin(0.5)
        .setDisplaySize(ICON_DISPLAY, ICON_DISPLAY)
        .setDepth(40);
    }
    return scene.add
      .polygon(x, y, [0, -7, 6, 0, 0, 7, -6, 0], GOLD)
      .setStrokeStyle(1, STROKE)
      .setDepth(40);
  }

  icon.setPosition(x, y);
  if (icon instanceof Phaser.GameObjects.Image && textureKey !== null) {
    icon.setTexture(textureKey);
  }
  return icon;
}
