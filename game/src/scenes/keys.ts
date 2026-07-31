export const SceneKeys = {
  Boot: 'Boot',
  Tutorial: 'Tutorial',
  Combat: 'Combat',
  Hub: 'Hub',
  Tree: 'Tree',
  /** Wave 5 radial wheel — separate from lattice TreeScene. */
  RadialTree: 'RadialTree',
  /** Spell-card album (cards progression mode). */
  CardAlbum: 'CardAlbum',
  Relic: 'Relic',
  Loadout: 'Loadout',
  Settings: 'Settings',
  /** Cards-mode content catalogue (Settings → Catalogue). */
  Catalogue: 'Catalogue',
} as const;

export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];
