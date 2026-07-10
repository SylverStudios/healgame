/**
 * Config-driven skill-tree service (Elm-style Model / update / view).
 *
 * - Config is pure data: nodes, costs, prerequisites, spot chains.
 * - TreeState is opaque; only this module reads or mutates it.
 * - `update` is pure: accept → new state, or reject → same state + feedback.
 * - Node `content` is never inspected here — passed through for UI/loadout.
 *
 * No Phaser, no wall clock, no Math.random.
 */

import type {
  ConfigError,
  NodeDef,
  NodeView,
  SpotDef,
  SpotStatus,
  SpotView,
  TreeAction,
  TreeConfig,
  TreeSnapshot,
  TreeState,
  TreeView,
  UpdateResult,
} from './types';

interface InternalState {
  owned: ReadonlySet<string>;
  wallet: Readonly<Record<string, number>>;
}

interface CompiledConfig {
  nodesById: ReadonlyMap<string, NodeDef>;
  spotsById: ReadonlyMap<string, SpotDef>;
  /** nodeId → spotId that contains it. */
  spotOfNode: ReadonlyMap<string, string>;
  rootNodeId: string;
  edges: readonly { fromSpotId: string; toSpotId: string }[];
}

function asInternal(state: TreeState): InternalState {
  return state as unknown as InternalState;
}

function asOpaque(state: InternalState): TreeState {
  return state as unknown as TreeState;
}

function freezeWallet(wallet: Record<string, number>): Readonly<Record<string, number>> {
  return Object.freeze({ ...wallet });
}

function emptyRequires(node: NodeDef): boolean {
  return node.requires === undefined || node.requires.nodes.length === 0;
}

/**
 * Validates a config. Returns null when valid.
 * Enforced: unique ids, exactly one root, every node in exactly one spot,
 * non-empty chains, requires reference existing nodes.
 *
 * A "root" is a node with no explicit `requires` that is also first in its
 * spot chain. Later chain entries may omit `requires` — spot order gates them.
 */
export function validateConfig(config: TreeConfig): ConfigError | null {
  const nodeIds = new Set<string>();
  for (const node of config.nodes) {
    if (nodeIds.has(node.id)) {
      return { reason: 'invalid-config', message: `Duplicate node id "${node.id}"` };
    }
    nodeIds.add(node.id);
    if (!Number.isInteger(node.cost.amount) || node.cost.amount < 0) {
      return {
        reason: 'invalid-config',
        message: `Node "${node.id}" cost.amount must be a non-negative integer`,
      };
    }
    if (node.cost.currency.trim() === '') {
      return { reason: 'invalid-config', message: `Node "${node.id}" has empty currency` };
    }
  }

  for (const node of config.nodes) {
    if (emptyRequires(node)) continue;
    const req = node.requires!;
    if (req.mode !== 'all' && req.mode !== 'any') {
      return { reason: 'invalid-config', message: `Node "${node.id}" has invalid requires.mode` };
    }
    for (const id of req.nodes) {
      if (!nodeIds.has(id)) {
        return {
          reason: 'invalid-config',
          message: `Node "${node.id}" requires unknown node "${id}"`,
        };
      }
    }
  }

  const spotIds = new Set<string>();
  const spotOfNode = new Map<string, string>();
  const chainIndex = new Map<string, number>();
  for (const spot of config.spots) {
    if (spotIds.has(spot.id)) {
      return { reason: 'invalid-config', message: `Duplicate spot id "${spot.id}"` };
    }
    spotIds.add(spot.id);
    if (spot.chain.length === 0) {
      return { reason: 'invalid-config', message: `Spot "${spot.id}" has an empty chain` };
    }
    for (let i = 0; i < spot.chain.length; i++) {
      const nodeId = spot.chain[i]!;
      if (!nodeIds.has(nodeId)) {
        return {
          reason: 'invalid-config',
          message: `Spot "${spot.id}" chain references unknown node "${nodeId}"`,
        };
      }
      if (spotOfNode.has(nodeId)) {
        return {
          reason: 'invalid-config',
          message: `Node "${nodeId}" appears in multiple spots ("${spotOfNode.get(nodeId)}" and "${spot.id}")`,
        };
      }
      spotOfNode.set(nodeId, spot.id);
      chainIndex.set(nodeId, i);
    }
  }

  for (const id of nodeIds) {
    if (!spotOfNode.has(id)) {
      return { reason: 'invalid-config', message: `Node "${id}" is not assigned to any spot` };
    }
  }

  const roots = config.nodes.filter((n) => emptyRequires(n) && chainIndex.get(n.id) === 0);
  if (roots.length !== 1) {
    return {
      reason: 'invalid-config',
      message: `Expected exactly one root node (no prerequisites), found ${roots.length}`,
    };
  }

  return null;
}

function compile(config: TreeConfig): CompiledConfig | ConfigError {
  const err = validateConfig(config);
  if (err) return err;

  const nodesById = new Map(config.nodes.map((n) => [n.id, n]));
  const spotsById = new Map(config.spots.map((s) => [s.id, s]));
  const spotOfNode = new Map<string, string>();
  for (const spot of config.spots) {
    for (const nodeId of spot.chain) spotOfNode.set(nodeId, spot.id);
  }

  const rootNodeId = config.nodes.find(emptyRequires)!.id;

  // Edges: for each spot, connect from spots that own any prerequisite of the
  // first chain node (stable layout edges, independent of ownership).
  const edgeKeys = new Set<string>();
  const edges: { fromSpotId: string; toSpotId: string }[] = [];
  for (const spot of config.spots) {
    const first = nodesById.get(spot.chain[0]!)!;
    if (emptyRequires(first)) continue;
    for (const reqId of first.requires!.nodes) {
      const fromSpotId = spotOfNode.get(reqId)!;
      const key = `${fromSpotId}->${spot.id}`;
      if (edgeKeys.has(key) || fromSpotId === spot.id) continue;
      edgeKeys.add(key);
      edges.push({ fromSpotId, toSpotId: spot.id });
    }
  }

  return { nodesById, spotsById, spotOfNode, rootNodeId, edges };
}

function requirementsMet(node: NodeDef, owned: ReadonlySet<string>): boolean {
  if (emptyRequires(node)) return true;
  const { mode, nodes } = node.requires!;
  return mode === 'all' ? nodes.every((id) => owned.has(id)) : nodes.some((id) => owned.has(id));
}

function nextInChain(spot: SpotDef, owned: ReadonlySet<string>): string | null {
  for (const nodeId of spot.chain) {
    if (!owned.has(nodeId)) return nodeId;
  }
  return null;
}

function toNodeView(node: NodeDef): NodeView {
  return { id: node.id, content: node.content, cost: { ...node.cost } };
}

function reject(
  state: TreeState,
  reason: 'unknown-spot' | 'spot-complete' | 'requirements-unmet' | 'cannot-afford' | 'invalid-config',
  message: string,
): UpdateResult {
  return { ok: false, state, reason, message };
}

/**
 * Create initial opaque state. `owned` defaults to empty (root not auto-granted).
 * Fails closed on invalid config via thrown Error — prefer `validateConfig` first
 * in authoring tools; runtime callers should use configs that already passed tests.
 */
export function create(
  config: TreeConfig,
  wallet: Record<string, number>,
  owned: readonly string[] = [],
): TreeState {
  const compiled = compile(config);
  if ('reason' in compiled) {
    throw new Error(compiled.message);
  }
  for (const id of owned) {
    if (!compiled.nodesById.has(id)) {
      throw new Error(`Owned node "${id}" is not in config`);
    }
  }
  return asOpaque({
    owned: new Set(owned),
    wallet: freezeWallet(wallet),
  });
}

/** Replace the wallet slice (e.g. after combat rewards) without touching owned nodes. */
export function withWallet(state: TreeState, wallet: Record<string, number>): TreeState {
  const internal = asInternal(state);
  return asOpaque({ owned: internal.owned, wallet: freezeWallet(wallet) });
}

export function walletOf(state: TreeState): Readonly<Record<string, number>> {
  return asInternal(state).wallet;
}

export function ownedOf(state: TreeState): readonly string[] {
  return [...asInternal(state).owned];
}

export function snapshot(state: TreeState): TreeSnapshot {
  const internal = asInternal(state);
  return {
    owned: [...internal.owned],
    wallet: { ...internal.wallet },
  };
}

/** Restore opaque state from a snapshot; validates owned ids against config. */
export function restore(config: TreeConfig, snap: TreeSnapshot): TreeState {
  return create(config, snap.wallet, snap.owned);
}

/**
 * Attempt an action. On success returns a new state; on failure returns the
 * same state reference plus a reason/message (no mutation).
 */
export function update(config: TreeConfig, state: TreeState, action: TreeAction): UpdateResult {
  const compiled = compile(config);
  if ('reason' in compiled) {
    return reject(state, 'invalid-config', compiled.message);
  }

  if (action.type !== 'purchase') {
    return reject(state, 'invalid-config', `Unknown action type`);
  }

  const spot = compiled.spotsById.get(action.spotId);
  if (!spot) {
    return reject(state, 'unknown-spot', `Unknown spot "${action.spotId}"`);
  }

  const internal = asInternal(state);
  const nextId = nextInChain(spot, internal.owned);
  if (nextId === null) {
    return reject(state, 'spot-complete', `Spot "${action.spotId}" is already fully purchased`);
  }

  const node = compiled.nodesById.get(nextId)!;
  if (!requirementsMet(node, internal.owned)) {
    return reject(
      state,
      'requirements-unmet',
      `Node "${node.id}" prerequisites are not met`,
    );
  }

  const balance = internal.wallet[node.cost.currency] ?? 0;
  if (balance < node.cost.amount) {
    return reject(
      state,
      'cannot-afford',
      `Need ${node.cost.amount} ${node.cost.currency}, have ${balance}`,
    );
  }

  const owned = new Set(internal.owned);
  owned.add(node.id);
  const wallet = { ...internal.wallet, [node.cost.currency]: balance - node.cost.amount };

  return {
    ok: true,
    state: asOpaque({ owned, wallet: freezeWallet(wallet) }),
  };
}

function spotStatus(
  next: NodeDef | null,
  owned: ReadonlySet<string>,
  wallet: Readonly<Record<string, number>>,
): SpotStatus {
  if (next === null) return 'complete';
  if (!requirementsMet(next, owned)) return 'locked';
  const balance = wallet[next.cost.currency] ?? 0;
  return balance >= next.cost.amount ? 'affordable' : 'unaffordable';
}

function parentSpotIdsFor(spot: SpotDef, compiled: CompiledConfig): string[] {
  const first = compiled.nodesById.get(spot.chain[0]!)!;
  if (emptyRequires(first)) return [];
  const parents = new Set<string>();
  for (const reqId of first.requires!.nodes) {
    const from = compiled.spotOfNode.get(reqId);
    if (from && from !== spot.id) parents.add(from);
  }
  return [...parents];
}

/** Derive everything a renderer needs from config + opaque state. */
export function view(config: TreeConfig, state: TreeState): TreeView {
  const compiled = compile(config);
  if ('reason' in compiled) {
    throw new Error(compiled.message);
  }

  const internal = asInternal(state);
  const spots: SpotView[] = config.spots.map((spot) => {
    const ownedViews: NodeView[] = [];
    for (const nodeId of spot.chain) {
      if (!internal.owned.has(nodeId)) break;
      ownedViews.push(toNodeView(compiled.nodesById.get(nodeId)!));
    }
    const nextId = nextInChain(spot, internal.owned);
    const nextNode = nextId === null ? null : compiled.nodesById.get(nextId)!;
    return {
      id: spot.id,
      status: spotStatus(nextNode, internal.owned, internal.wallet),
      owned: ownedViews,
      next: nextNode ? toNodeView(nextNode) : null,
      parentSpotIds: parentSpotIdsFor(spot, compiled),
    };
  });

  return {
    spots,
    wallet: internal.wallet,
    ownedNodeIds: [...internal.owned],
    edges: compiled.edges,
  };
}

/** Convenience: whether a purchase on this spot would succeed right now. */
export function canPurchase(config: TreeConfig, state: TreeState, spotId: string): boolean {
  const result = update(config, state, { type: 'purchase', spotId });
  return result.ok;
}
