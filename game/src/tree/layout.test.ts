import { describe, expect, it } from 'vitest';
import { create, layoutSpots, update, view, type TreeConfig } from './index';

const TINY: TreeConfig = {
  nodes: [
    { id: 'root', content: { name: 'Root' }, cost: { currency: 'gold', amount: 1 } },
    {
      id: 'left',
      content: { name: 'Left' },
      cost: { currency: 'gold', amount: 1 },
      requires: { mode: 'all', nodes: ['root'] },
    },
    {
      id: 'right',
      content: { name: 'Right' },
      cost: { currency: 'gold', amount: 1 },
      requires: { mode: 'all', nodes: ['root'] },
    },
  ],
  spots: [
    { id: 'root', chain: ['root'] },
    { id: 'left', chain: ['left'] },
    { id: 'right', chain: ['right'] },
  ],
};

describe('layoutSpots', () => {
  it('places the root above its children and honors overrides', () => {
    const state = create(TINY, { gold: 10 });
    const treeView = view(TINY, state);
    const auto = layoutSpots(treeView, { width: 960 });
    expect(auto.get('root')?.y).toBeLessThan(auto.get('left')?.y ?? 0);
    expect(auto.get('left')?.y).toBe(auto.get('right')?.y);

    const overridden = layoutSpots(treeView, {
      width: 960,
      overrides: { root: { x: 10, y: 20 } },
    });
    expect(overridden.get('root')).toEqual({ x: 10, y: 20 });
  });

  it('still lays out after purchases (complete spots stay positioned)', () => {
    let state = create(TINY, { gold: 10 });
    const bought = update(TINY, state, { type: 'purchase', spotId: 'root' });
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    state = bought.state;
    const positions = layoutSpots(view(TINY, state), { width: 960 });
    expect(positions.size).toBe(3);
  });
});
