export const SceneKeys = {
  Boot: 'Boot',
  Tutorial: 'Tutorial',
  Combat: 'Combat',
  Hub: 'Hub',
  Tree: 'Tree',
  Subclass: 'Subclass',
} as const;

export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];
