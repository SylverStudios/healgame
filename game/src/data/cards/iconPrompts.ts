/**
 * Art-generation prompts for cards-mode spell / cooldown / chip icons.
 *
 * Where a shipped PixelLab icon exists, `iconPrompt` is the item_description
 * used to make it (artifacts/pixellab-3). Entries without an icon may still
 * carry a planned prompt for future generation — the Catalogue scene shows
 * whichever fields are present.
 */

export interface IconArtMeta {
  /** Gameplay id (spell, cooldown, or chip). */
  id: string;
  /**
   * Texture key suffix for an existing spell/cooldown icon asset.
   * Spell icons: `spell-icon-<iconAssetId>`; CD icons: `cooldown-icon-<iconAssetId>`.
   * Omit when no runtime icon ships yet.
   */
  iconAssetId?: string;
  /** `spell` uses SPELL_ICON_IDS paths; `cooldown` uses COOLDOWN_ICON_IDS. */
  iconKind?: 'spell' | 'cooldown';
  /** PixelLab / art prompt used (or intended) to generate the icon. */
  iconPrompt?: string;
}

/**
 * Cards-mode content → icon art metadata.
 * Spells without a dedicated cards icon leave `iconAssetId` unset; CDs reuse
 * the combat spell-bar icons. Chip prompts are authored here as they land.
 */
export const CARD_ICON_ART: readonly IconArtMeta[] = [
  // ----- spells (cards unlock table) -----
  {
    id: 'heal',
    iconPrompt:
      'gold holy healing rune, soft warm glow, dark-fantasy heavy-metal spell icon, single centered object, transparent background',
  },
  {
    id: 'mend',
    iconPrompt:
      'ember healing rune with a thin gold crack, dark-fantasy heavy-metal spell icon, single centered object, transparent background',
  },
  {
    id: 'bonk',
    iconAssetId: 'bonk',
    iconKind: 'spell',
    iconPrompt:
      'iron mace head, dark-fantasy heavy-metal spell icon, single centered object, transparent background',
  },
  {
    id: 'vowstrike',
    iconPrompt:
      'holy vow sword tip-down, dark-fantasy heavy-metal spell icon, single centered object, transparent background',
  },
  // ----- major cooldowns -----
  {
    id: 'still-waters',
    iconAssetId: 'still-waters',
    iconKind: 'cooldown',
    iconPrompt:
      'chalice with a single water droplet, dark-fantasy heavy-metal spell icon, single centered object, transparent background',
  },
  {
    id: 'wrath-ascendant',
    iconAssetId: 'wrath-ascendant',
    iconKind: 'cooldown',
    iconPrompt:
      'flaming iron crown, dark-fantasy heavy-metal spell icon, single centered object, transparent background',
  },
  {
    id: 'frenzied-liturgy',
    iconAssetId: 'frenzied-liturgy',
    iconKind: 'cooldown',
    iconPrompt:
      'burning open prayer book, dark-fantasy heavy-metal spell icon, single centered object, transparent background',
  },
];

const byId = new Map(CARD_ICON_ART.map((e) => [e.id, e]));

export function iconArtFor(id: string): IconArtMeta | undefined {
  return byId.get(id);
}
