export const SceneKeys = {
  Boot: 'Boot',
  Tutorial: 'Tutorial',
  Combat: 'Combat',
  Hub: 'Hub',
  Tree: 'Tree',
} as const;

export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];
