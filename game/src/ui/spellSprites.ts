/**
 * PixelLab spell/cooldown action icons (16×16 native, 32px display in the
 * 100×52 spell/cooldown button — bible item 3, chunk 3 of
 * docs/ui-theme-handoff.md) plus the spell-bar/HUD framing kit textures
 * (button frame, keycap chip, cast-bar frame). Presentation-only — gameplay
 * lives in data/constants.ts (SPELLS) and data/cooldowns.ts (COOLDOWNS).
 *
 * Icon registry mirrors `relicSprites.ts`'s pattern: BootScene preloads every
 * id below; SpellButton/CooldownButton fall back to `glyphChar()` (glyph.ts)
 * when an id has no texture (unmapped spells/cooldowns keep working with
 * zero code changes — the fallback is exercised by spellSprites.test.ts).
 */

/** Native canvas size for every spell/cooldown icon PNG (2× at button display size). */
export const SPELL_ICON_SIZE = 16;

/** Every spell id (data/constants.ts SPELLS) that ships a PixelLab icon. */
export const SPELL_ICON_IDS: readonly string[] = [
  'bonk',
  'solemn-mend',
  'zealous-mending',
  'solemn-vigil',
  'zealous-flare',
  'vowstrike-virtue',
  'vowstrike-vengeance',
];

/** Every major-cooldown id (data/cooldowns.ts COOLDOWNS) that ships a PixelLab icon. */
export const COOLDOWN_ICON_IDS: readonly string[] = ['still-waters', 'frenzied-liturgy', 'wrath-ascendant'];

/** Phaser texture key for a spell id (`solemn-mend` → `spell-icon-solemn-mend`). */
export function spellIconTextureKey(spellId: string): string {
  return `spell-icon-${spellId}`;
}

/** Public URL for a spell icon still. */
export function spellIconTextureUrl(spellId: string): string {
  return `assets/ui/spell-icons/${spellId}.png`;
}

/** Phaser texture key for a cooldown id (`still-waters` → `cooldown-icon-still-waters`). */
export function cooldownIconTextureKey(cooldownId: string): string {
  return `cooldown-icon-${cooldownId}`;
}

/** Public URL for a cooldown icon still. */
export function cooldownIconTextureUrl(cooldownId: string): string {
  return `assets/ui/spell-icons/cd-${cooldownId}.png`;
}

// ---- framing kit (button frame / keycap chip / cast-bar frame) ------------

/** Spell/cooldown button frame: native 50×26 art px, displayed at 100×52
 *  (BUTTON_WIDTH/HEIGHT in spellBar.ts — frozen layout, re-skin in place). */
export const BUTTON_FRAME_TEXTURE_KEY = 'ui-spell-button-frame';
export const BUTTON_FRAME_TEXTURE_URL = 'assets/ui/frame/button-frame.png';
export const BUTTON_FRAME_NATIVE_SIZE = { width: 50, height: 26 } as const;

/** Hotkey keycap chip: native 9×7 art px, displayed at 18×14 (KEYCAP_WIDTH/HEIGHT). */
export const KEYCAP_FRAME_TEXTURE_KEY = 'ui-keycap-frame';
export const KEYCAP_FRAME_TEXTURE_URL = 'assets/ui/frame/keycap-frame.png';
export const KEYCAP_FRAME_NATIVE_SIZE = { width: 9, height: 7 } as const;

/** Player cast-bar frame: native 160×10 art px, displayed at 320×20
 *  (PLAYER_CAST_BAR_WIDTH/HEIGHT in CombatScene.ts). Transparent center
 *  window so the existing `Bar` fill shows through — see `ui/bar.ts`. */
export const CAST_BAR_FRAME_TEXTURE_KEY = 'ui-cast-bar-frame';
export const CAST_BAR_FRAME_TEXTURE_URL = 'assets/ui/frame/cast-bar-frame.png';
export const CAST_BAR_FRAME_NATIVE_SIZE = { width: 160, height: 10 } as const;

/** Tooltip panel corner ornament: native 8×8 art px, displayed at 16×16,
 *  pinned to each of the panel's four corners (spellTooltip.ts) — the panel
 *  itself stays a plain bordered rectangle since its size is content-driven
 *  every frame (see spellTooltip.ts / pixellab-3 ledger "why not NineSlice").
 *  Code-drawn (not PixelLab) — generated rivet/corner crops read as
 *  illegible mush at this size; see the ledger. */
export const TOOLTIP_CORNER_TEXTURE_KEY = 'ui-tooltip-corner';
export const TOOLTIP_CORNER_TEXTURE_URL = 'assets/ui/frame/tooltip-corner.png';
export const TOOLTIP_CORNER_NATIVE_SIZE = { width: 8, height: 8 } as const;

/** One entry per framing-kit / icon texture BootScene must preload. */
export interface SpellUiTexture {
  readonly key: string;
  readonly url: string;
}

/** Every spell-bar/HUD framing + icon texture this chunk ships — BootScene
 *  loops this once instead of preloading each constant by hand. */
export function spellBarTextures(): readonly SpellUiTexture[] {
  const icons: SpellUiTexture[] = SPELL_ICON_IDS.map((id) => ({
    key: spellIconTextureKey(id),
    url: spellIconTextureUrl(id),
  }));
  const cooldownIcons: SpellUiTexture[] = COOLDOWN_ICON_IDS.map((id) => ({
    key: cooldownIconTextureKey(id),
    url: cooldownIconTextureUrl(id),
  }));
  const frames: SpellUiTexture[] = [
    { key: BUTTON_FRAME_TEXTURE_KEY, url: BUTTON_FRAME_TEXTURE_URL },
    { key: KEYCAP_FRAME_TEXTURE_KEY, url: KEYCAP_FRAME_TEXTURE_URL },
    { key: CAST_BAR_FRAME_TEXTURE_KEY, url: CAST_BAR_FRAME_TEXTURE_URL },
    { key: TOOLTIP_CORNER_TEXTURE_KEY, url: TOOLTIP_CORNER_TEXTURE_URL },
  ];
  return [...icons, ...cooldownIcons, ...frames];
}
