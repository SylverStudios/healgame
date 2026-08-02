/**
 * Tiny seeded LCG for playtest bots. Deterministic across runs; not for crypto.
 * Kept out of combat/data purity zones so bots can own their randomness.
 */

export function createSeededRng(seed: number): () => number {
  let state = (Math.floor(seed) >>> 0) || 1;
  return () => {
    // Numerical Recipes LCG
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** Pick one element; empty array → undefined. */
export function pickRandom<T>(items: readonly T[], random: () => number): T | undefined {
  if (items.length === 0) return undefined;
  const idx = Math.min(items.length - 1, Math.floor(random() * items.length));
  return items[idx];
}
