/**
 * Overhead healer cues, grouped so CombatScene keeps a single call site
 * (Wave 6 R3): the armed-synergy rune, the Battle Mend mana-discount icon, and
 * the stacked Blessed Bonk cues. Presentation-only — reads CombatState, draws
 * above the healer sprite. Pure layout/copy lives in `bonkStacksIcon.ts`.
 */

import Phaser from 'phaser';
import type { CombatState } from '../combat/types';
import { syncBattleMendIcon, type BattleMendIcon } from './battleMendIcon';
import { bonkStackIconPositions } from './bonkStacksIcon';
import { SPELL_ICON_SIZE, spellIconTextureKey } from './spellSprites';

const GOLD = 0xf2c14e;
const STROKE = 0x8a7868;
const CUE_DEPTH = 40;
/** Small stacked cues (1× native) — deliberately smaller than the 2× Battle Mend icon. */
const STACK_ICON_DISPLAY = SPELL_ICON_SIZE;

type HealerHome = { getHomeX(): number; getHomeY(): number };
type StackIcon = Phaser.GameObjects.Image | Phaser.GameObjects.Polygon;

export interface HealerCueHandles {
  rune: Phaser.GameObjects.Triangle | null;
  battleMend: BattleMendIcon | null;
  bonkStacks: StackIcon[];
}

export function emptyHealerCueHandles(): HealerCueHandles {
  return { rune: null, battleMend: null, bonkStacks: [] };
}

/** Armed-synergy rune (left of the healer); null cue when nothing is armed. */
function syncSynergyRune(
  scene: Phaser.Scene,
  current: Phaser.GameObjects.Triangle | null,
  armedBuffedSpellIds: readonly string[],
  healer: HealerHome | null | undefined,
): Phaser.GameObjects.Triangle | null {
  if (armedBuffedSpellIds.length === 0 || !healer) {
    current?.destroy();
    return null;
  }
  const x = healer.getHomeX() - 36;
  const y = healer.getHomeY() - 24;
  const rune =
    current ??
    scene.add
      .triangle(x, y, 0, -7, 6, 3, -6, 3, GOLD)
      .setStrokeStyle(1, STROKE)
      .setDepth(CUE_DEPTH);
  rune.setPosition(x, y);
  return rune;
}

function makeStackIcon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  textureKey: string | null,
): StackIcon {
  if (textureKey !== null) {
    return scene.add
      .image(x, y, textureKey)
      .setOrigin(0.5)
      .setDisplaySize(STACK_ICON_DISPLAY, STACK_ICON_DISPLAY)
      .setDepth(CUE_DEPTH);
  }
  return scene.add
    .polygon(x, y, [0, -5, 5, 0, 0, 5, -5, 0], GOLD)
    .setStrokeStyle(1, STROKE)
    .setDepth(CUE_DEPTH);
}

/**
 * Stacked Blessed Bonk cue: one icon per stack, fanned above the healer.
 * Rebuilds when the icon count or texture-vs-diamond kind changes; otherwise
 * repositions in place. Clears at 0 stacks / no healer.
 */
function syncBonkStacks(
  scene: Phaser.Scene,
  current: StackIcon[],
  stacks: number,
  iconSpellId: string | null,
  healer: HealerHome | null | undefined,
): StackIcon[] {
  if (stacks <= 0 || !healer) {
    for (const icon of current) icon.destroy();
    return [];
  }

  const textureKey =
    iconSpellId !== null && scene.textures.exists(spellIconTextureKey(iconSpellId))
      ? spellIconTextureKey(iconSpellId)
      : null;
  const needsSprite = textureKey !== null;
  const positions = bonkStackIconPositions(healer.getHomeX(), healer.getHomeY(), stacks);

  const matches =
    current.length === positions.length &&
    current.every((icon) => icon instanceof Phaser.GameObjects.Image === needsSprite);

  if (!matches) {
    for (const icon of current) icon.destroy();
    return positions.map(({ x, y }) => makeStackIcon(scene, x, y, textureKey));
  }

  current.forEach((icon, i) => {
    const pos = positions[i]!;
    icon.setPosition(pos.x, pos.y);
    if (icon instanceof Phaser.GameObjects.Image && textureKey !== null) {
      icon.setTexture(textureKey);
    }
  });
  return current;
}

/** Sync all three overhead cues from one CombatState snapshot; returns updated handles. */
export function syncHealerCues(
  scene: Phaser.Scene,
  handles: HealerCueHandles,
  state: CombatState,
  bonkIconSpellId: string | null,
  healer: HealerHome | null | undefined,
): HealerCueHandles {
  return {
    rune: syncSynergyRune(scene, handles.rune, state.armedBuffedSpellIds, healer),
    battleMend: syncBattleMendIcon(
      scene,
      handles.battleMend,
      state.armedManaDiscountSpellIds,
      healer,
    ),
    bonkStacks: syncBonkStacks(scene, handles.bonkStacks, state.bonkHealStacks, bonkIconSpellId, healer),
  };
}
