/**
 * Skill-tree service tests — config-driven Model / update / view.
 *
 * Example 1: nested branches that converge on Special1 (OR prerequisites).
 * Example 2: multi-unlock chain at one spot (Buff1 → Buff2 → Buff3).
 */

import { describe, expect, it } from 'vitest';
import {
  canPurchase,
  create,
  ownedOf,
  restore,
  snapshot,
  update,
  validateConfig,
  view,
  walletOf,
  withWallet,
  type NodeContent,
  type TreeConfig,
  type TreeState,
} from './index';

// ---------------------------------------------------------------------------
// Content helpers (opaque to the tree — only tests/UI interpret these)
// ---------------------------------------------------------------------------

type ExampleContent =
  | { kind: 'ability'; ref: string }
  | { kind: 'buff'; ref: string }
  | { kind: 'mutation'; ref: string }
  | { kind: 'special'; ref: string };

function content(c: ExampleContent): NodeContent {
  return c;
}

function purchase(config: TreeConfig, state: TreeState, spotId: string) {
  return update(config, state, { type: 'purchase', spotId });
}

function mustBuy(config: TreeConfig, state: TreeState, spotId: string): TreeState {
  const result = purchase(config, state, spotId);
  expect(result.ok, result.ok ? '' : result.message).toBe(true);
  if (!result.ok) throw new Error(result.message);
  return result.state;
}

// ---------------------------------------------------------------------------
// Example 1 — Nested + connected (diamond / multi-path)
//
//   Ability1
//     ├─ Buff1 → Buff2 ─┐
//     │                 ├─ Special1
//     └─ Mutation1 → Mutation2 ─┘
// ---------------------------------------------------------------------------

const EXAMPLE_1: TreeConfig = {
  nodes: [
    {
      id: 'ability1',
      content: content({ kind: 'ability', ref: 'Ability1' }),
      cost: { currency: 'gold', amount: 1 },
    },
    {
      id: 'buff1',
      content: content({ kind: 'buff', ref: 'Buff1' }),
      cost: { currency: 'gold', amount: 2 },
      requires: { mode: 'all', nodes: ['ability1'] },
    },
    {
      id: 'buff2',
      content: content({ kind: 'buff', ref: 'Buff2' }),
      cost: { currency: 'gold', amount: 3 },
      requires: { mode: 'all', nodes: ['buff1'] },
    },
    {
      id: 'mutation1',
      content: content({ kind: 'mutation', ref: 'Mutation1' }),
      cost: { currency: 'gold', amount: 2 },
      requires: { mode: 'all', nodes: ['ability1'] },
    },
    {
      id: 'mutation2',
      content: content({ kind: 'mutation', ref: 'Mutation2' }),
      cost: { currency: 'gold', amount: 3 },
      requires: { mode: 'all', nodes: ['mutation1'] },
    },
    {
      id: 'special1',
      content: content({ kind: 'special', ref: 'Special1' }),
      cost: { currency: 'ruby', amount: 1 },
      // Either path unlocks Special1
      requires: { mode: 'any', nodes: ['buff2', 'mutation2'] },
    },
  ],
  spots: [
    { id: 'root', chain: ['ability1'] },
    { id: 'buff1', chain: ['buff1'] },
    { id: 'buff2', chain: ['buff2'] },
    { id: 'mutation1', chain: ['mutation1'] },
    { id: 'mutation2', chain: ['mutation2'] },
    { id: 'special1', chain: ['special1'] },
  ],
};

// ---------------------------------------------------------------------------
// Example 2 — Multi-unlock chain at one spot
//
//   Ability1
//     ├─ Ability2
//     └─ (Buff1 → Buff2 → Buff3)   // one spot, sequential
// ---------------------------------------------------------------------------

const EXAMPLE_2: TreeConfig = {
  nodes: [
    {
      id: 'ability1',
      content: content({ kind: 'ability', ref: 'Ability1' }),
      cost: { currency: 'gold', amount: 1 },
    },
    {
      id: 'ability2',
      content: content({ kind: 'ability', ref: 'Ability2' }),
      cost: { currency: 'gold', amount: 2 },
      requires: { mode: 'all', nodes: ['ability1'] },
    },
    {
      id: 'buff1',
      content: content({ kind: 'buff', ref: 'Buff1' }),
      cost: { currency: 'gold', amount: 2 },
      requires: { mode: 'all', nodes: ['ability1'] },
    },
    {
      id: 'buff2',
      content: content({ kind: 'buff', ref: 'Buff2' }),
      // Scaling-style costs: 2 → 5 → 10 expressed as distinct chain nodes
      cost: { currency: 'gold', amount: 5 },
      // Chain order gates this; no extra requires needed
    },
    {
      id: 'buff3',
      content: content({ kind: 'buff', ref: 'Buff3' }),
      cost: { currency: 'gold', amount: 10 },
    },
  ],
  spots: [
    { id: 'root', chain: ['ability1'] },
    { id: 'ability2', chain: ['ability2'] },
    { id: 'buffs', chain: ['buff1', 'buff2', 'buff3'] },
  ],
};

// ---------------------------------------------------------------------------
// Config validation
// ---------------------------------------------------------------------------

describe('validateConfig', () => {
  it('accepts Example 1 and Example 2', () => {
    expect(validateConfig(EXAMPLE_1)).toBeNull();
    expect(validateConfig(EXAMPLE_2)).toBeNull();
  });

  it('rejects zero or multiple roots', () => {
    const noRoot: TreeConfig = {
      nodes: [
        {
          id: 'a',
          content: null,
          cost: { currency: 'gold', amount: 1 },
          requires: { mode: 'all', nodes: ['b'] },
        },
        {
          id: 'b',
          content: null,
          cost: { currency: 'gold', amount: 1 },
          requires: { mode: 'all', nodes: ['a'] },
        },
      ],
      spots: [
        { id: 'a', chain: ['a'] },
        { id: 'b', chain: ['b'] },
      ],
    };
    expect(validateConfig(noRoot)?.message).toMatch(/exactly one root/);
  });

  it('rejects a node missing from every spot', () => {
    const orphan: TreeConfig = {
      nodes: [
        { id: 'root', content: null, cost: { currency: 'gold', amount: 1 } },
        { id: 'orphan', content: null, cost: { currency: 'gold', amount: 1 } },
      ],
      spots: [{ id: 'root', chain: ['root'] }],
    };
    expect(validateConfig(orphan)?.message).toMatch(/not assigned/);
  });

  it('rejects a node appearing in two spots', () => {
    const dup: TreeConfig = {
      nodes: [{ id: 'root', content: null, cost: { currency: 'gold', amount: 1 } }],
      spots: [
        { id: 'a', chain: ['root'] },
        { id: 'b', chain: ['root'] },
      ],
    };
    expect(validateConfig(dup)?.message).toMatch(/multiple spots/);
  });
});

// ---------------------------------------------------------------------------
// Example 1 behavior
// ---------------------------------------------------------------------------

describe('Example 1 — nested + converging Special1', () => {
  it('starts with only the root purchasable', () => {
    const state = create(EXAMPLE_1, { gold: 100, ruby: 1 });
    const v = view(EXAMPLE_1, state);

    const byId = Object.fromEntries(v.spots.map((s) => [s.id, s]));
    expect(byId.root?.status).toBe('affordable');
    expect(byId.root?.next?.id).toBe('ability1');
    expect(byId.buff1?.status).toBe('locked');
    expect(byId.mutation1?.status).toBe('locked');
    expect(byId.special1?.status).toBe('locked');

    expect(v.edges).toEqual(
      expect.arrayContaining([
        { fromSpotId: 'root', toSpotId: 'buff1' },
        { fromSpotId: 'root', toSpotId: 'mutation1' },
        { fromSpotId: 'buff1', toSpotId: 'buff2' },
        { fromSpotId: 'mutation1', toSpotId: 'mutation2' },
        { fromSpotId: 'buff2', toSpotId: 'special1' },
        { fromSpotId: 'mutation2', toSpotId: 'special1' },
      ]),
    );
    expect(v.edges).toHaveLength(6);
  });

  it('rejects purchasing a locked child and leaves state unchanged', () => {
    const state = create(EXAMPLE_1, { gold: 100, ruby: 1 });
    const result = purchase(EXAMPLE_1, state, 'buff1');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('requirements-unmet');
    expect(result.state).toBe(state);
    expect(ownedOf(result.state)).toEqual([]);
    expect(walletOf(result.state)).toEqual({ gold: 100, ruby: 1 });
  });

  it('unlocks both branches after buying the root', () => {
    let state = create(EXAMPLE_1, { gold: 100, ruby: 1 });
    state = mustBuy(EXAMPLE_1, state, 'root');
    expect(ownedOf(state)).toEqual(['ability1']);
    expect(walletOf(state).gold).toBe(99);

    const v = view(EXAMPLE_1, state);
    const byId = Object.fromEntries(v.spots.map((s) => [s.id, s]));
    expect(byId.root?.status).toBe('complete');
    expect(byId.buff1?.status).toBe('affordable');
    expect(byId.mutation1?.status).toBe('affordable');
    expect(byId.special1?.status).toBe('locked');
  });

  it('reaches Special1 via the Buff path alone (OR prerequisite)', () => {
    let state = create(EXAMPLE_1, { gold: 100, ruby: 1 });
    state = mustBuy(EXAMPLE_1, state, 'root');
    state = mustBuy(EXAMPLE_1, state, 'buff1');
    state = mustBuy(EXAMPLE_1, state, 'buff2');

    const beforeSpecial = view(EXAMPLE_1, state);
    expect(beforeSpecial.spots.find((s) => s.id === 'special1')?.status).toBe('affordable');
    // Mutation path never purchased — Special1 still available
    expect(ownedOf(state)).toEqual(['ability1', 'buff1', 'buff2']);

    state = mustBuy(EXAMPLE_1, state, 'special1');
    expect(ownedOf(state)).toContain('special1');
    expect(walletOf(state).ruby).toBe(0);
    expect(view(EXAMPLE_1, state).spots.find((s) => s.id === 'special1')?.status).toBe('complete');
  });

  it('reaches Special1 via the Mutation path alone', () => {
    let state = create(EXAMPLE_1, { gold: 100, ruby: 1 });
    state = mustBuy(EXAMPLE_1, state, 'root');
    state = mustBuy(EXAMPLE_1, state, 'mutation1');
    state = mustBuy(EXAMPLE_1, state, 'mutation2');
    state = mustBuy(EXAMPLE_1, state, 'special1');
    expect([...ownedOf(state)].sort()).toEqual(['ability1', 'mutation1', 'mutation2', 'special1']);
  });

  it('passes opaque content through the view untouched', () => {
    const state = create(EXAMPLE_1, { gold: 1, ruby: 0 });
    const next = view(EXAMPLE_1, state).spots.find((s) => s.id === 'root')?.next;
    expect(next?.content).toEqual({ kind: 'ability', ref: 'Ability1' });
  });

  it('rejects unaffordable purchases without mutating', () => {
    const state = create(EXAMPLE_1, { gold: 0, ruby: 0 });
    const result = purchase(EXAMPLE_1, state, 'root');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('cannot-afford');
    expect(result.state).toBe(state);
  });
});

// ---------------------------------------------------------------------------
// Example 2 behavior
// ---------------------------------------------------------------------------

describe('Example 2 — multi-unlock chain at one spot', () => {
  it('shows Buff1 as next, then Buff2, then Buff3 on the same spot', () => {
    let state = create(EXAMPLE_2, { gold: 100 });
    state = mustBuy(EXAMPLE_2, state, 'root');

    let buffs = view(EXAMPLE_2, state).spots.find((s) => s.id === 'buffs')!;
    expect(buffs.status).toBe('affordable');
    expect(buffs.next?.id).toBe('buff1');
    expect(buffs.owned).toEqual([]);
    expect((buffs.next?.content as ExampleContent).ref).toBe('Buff1');

    state = mustBuy(EXAMPLE_2, state, 'buffs');
    buffs = view(EXAMPLE_2, state).spots.find((s) => s.id === 'buffs')!;
    expect(buffs.owned.map((n) => n.id)).toEqual(['buff1']);
    expect(buffs.next?.id).toBe('buff2');
    expect(buffs.next?.cost.amount).toBe(5);

    state = mustBuy(EXAMPLE_2, state, 'buffs');
    buffs = view(EXAMPLE_2, state).spots.find((s) => s.id === 'buffs')!;
    expect(buffs.owned.map((n) => n.id)).toEqual(['buff1', 'buff2']);
    expect(buffs.next?.id).toBe('buff3');
    expect(buffs.next?.cost.amount).toBe(10);

    state = mustBuy(EXAMPLE_2, state, 'buffs');
    buffs = view(EXAMPLE_2, state).spots.find((s) => s.id === 'buffs')!;
    expect(buffs.status).toBe('complete');
    expect(buffs.next).toBeNull();
    expect(buffs.owned.map((n) => n.id)).toEqual(['buff1', 'buff2', 'buff3']);

    const again = purchase(EXAMPLE_2, state, 'buffs');
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.reason).toBe('spot-complete');
  });

  it('does not skip ahead in the chain even if later nodes have no requires', () => {
    let state = create(EXAMPLE_2, { gold: 100 });
    state = mustBuy(EXAMPLE_2, state, 'root');
    // buff2/buff3 have no requires field — chain order still blocks them
    expect(canPurchase(EXAMPLE_2, state, 'buffs')).toBe(true);
    state = mustBuy(EXAMPLE_2, state, 'buffs'); // buys buff1 only
    expect(ownedOf(state)).toEqual(['ability1', 'buff1']);
    expect(ownedOf(state)).not.toContain('buff2');
  });

  it('allows Ability2 in parallel with the buff chain', () => {
    let state = create(EXAMPLE_2, { gold: 100 });
    state = mustBuy(EXAMPLE_2, state, 'root');
    state = mustBuy(EXAMPLE_2, state, 'ability2');
    state = mustBuy(EXAMPLE_2, state, 'buffs');
    expect([...ownedOf(state)].sort()).toEqual(['ability1', 'ability2', 'buff1']);
  });

  it('reports unaffordable when the next chain cost exceeds the wallet', () => {
    let state = create(EXAMPLE_2, { gold: 3 }); // root=1, buff1=2 → 0 left; buff2 costs 5
    state = mustBuy(EXAMPLE_2, state, 'root');
    state = mustBuy(EXAMPLE_2, state, 'buffs');
    const buffs = view(EXAMPLE_2, state).spots.find((s) => s.id === 'buffs')!;
    expect(buffs.next?.id).toBe('buff2');
    expect(buffs.status).toBe('unaffordable');
    const result = purchase(EXAMPLE_2, state, 'buffs');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('cannot-afford');
  });
});

// ---------------------------------------------------------------------------
// Opaque state / wallet sync / snapshot
// ---------------------------------------------------------------------------

describe('opaque state helpers', () => {
  it('withWallet updates currency without changing owned nodes', () => {
    let state = create(EXAMPLE_2, { gold: 1 });
    state = mustBuy(EXAMPLE_2, state, 'root');
    expect(walletOf(state).gold).toBe(0);
    state = withWallet(state, { gold: 50 });
    expect(walletOf(state).gold).toBe(50);
    expect(ownedOf(state)).toEqual(['ability1']);
  });

  it('snapshot / restore round-trips', () => {
    let state = create(EXAMPLE_1, { gold: 20, ruby: 1 });
    state = mustBuy(EXAMPLE_1, state, 'root');
    state = mustBuy(EXAMPLE_1, state, 'buff1');
    const snap = snapshot(state);
    const restored = restore(EXAMPLE_1, snap);
    expect([...ownedOf(restored)].sort()).toEqual([...ownedOf(state)].sort());
    expect(walletOf(restored)).toEqual(walletOf(state));
  });

  it('rejects unknown spot ids', () => {
    const state = create(EXAMPLE_1, { gold: 10, ruby: 0 });
    const result = purchase(EXAMPLE_1, state, 'no-such-spot');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('unknown-spot');
  });
});
