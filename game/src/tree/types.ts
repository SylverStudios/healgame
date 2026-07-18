/**
 * Public types for the config-driven skill-tree service.
 *
 * The tree never interprets node `content` — that payload is opaque and only
 * passed through to views for UI / loadout resolution. Gameplay numbers,
 * node kinds, and graph shape live entirely in `TreeConfig`.
 */

/** Cost of one purchase. Currency is a free string (not hard-coded to gold/ruby). */
export interface NodeCost {
  currency: string;
  amount: number;
}

/**
 * Opaque payload attached to a node. The tree service never reads this;
 * renderers and loadout builders do.
 */
export type NodeContent = unknown;

/** Prerequisite rule for unlocking a node (in addition to spot-chain order). */
export interface NodeRequires {
  /** 'all' = AND; 'any' = OR (multiple paths into the same node). */
  mode: 'all' | 'any';
  nodes: string[];
}

export interface NodeDef {
  id: string;
  content: NodeContent;
  cost: NodeCost;
  /**
   * Omitted or empty `nodes` = no prerequisite (root candidate).
   * Exactly one such node is allowed per config.
   */
  requires?: NodeRequires;
  /**
   * Mutual exclusion: owning any node in this group permanently locks the
   * rest (e.g. subclass oaths). Omitted = no exclusivity.
   */
  exclusiveGroup?: string;
  /**
   * When the spot's natural next node is exclusive-locked, the resolver may
   * skip to this node if requires are met. Used for forsaken-path rewards.
   */
  availableIfExclusiveLocked?: boolean;
  /**
   * v0.3 lattice: minimum player level required to purchase this node, in
   * addition to `requires`/`exclusiveGroup`. Enforced by `update` (and
   * reflected in `view`'s spot status as `locked`) only when the caller
   * supplies a `level`; omitted level = gate not enforced (back-compat for
   * callers that don't track level, e.g. most existing tests). Integer >= 1
   * when present.
   */
  minLevel?: number;
}

/**
 * A visual slot on the tree. `chain` length 1 is a normal node; length >1 is
 * a linked-list of unlocks at one spot (e.g. Buff1 → Buff2 → Buff3), shown
 * one-at-a-time as the next available purchase.
 */
export interface SpotDef {
  id: string;
  chain: string[];
  /**
   * v0.3 lattice: integer grid coordinates for this spot (column = progression
   * depth, row = string/lane). Pure layout data — no pixels, no Phaser. Drives
   * both `buildGlyphFromTree` segments and chunk D's tree layout. Optional so
   * configs that don't care about a lattice glyph (tests, other trees) can
   * omit it; `buildGlyphFromTree` silently skips edges missing grid data.
   */
  grid?: { col: number; row: number };
}

/** Entire tree definition — pure data, safe to author outside code. */
export interface TreeConfig {
  nodes: NodeDef[];
  spots: SpotDef[];
}

/**
 * Player action attempted against the tree. `level` (v0.3) is the player's
 * current level, forwarded to `minLevel` gate checks; omit when the caller
 * doesn't track level (gate then goes unenforced for that call).
 */
export type TreeAction = { type: 'purchase'; spotId: string; level?: number };

export type RejectReason =
  | 'unknown-spot'
  | 'spot-complete'
  | 'requirements-unmet'
  | 'cannot-afford'
  | 'exclusive-locked'
  | 'level-too-low'
  | 'invalid-config';

export type UpdateOk = { ok: true; state: TreeState };
export type UpdateErr = {
  ok: false;
  state: TreeState;
  reason: RejectReason;
  message: string;
};
export type UpdateResult = UpdateOk | UpdateErr;

/** Opaque player tree state — only this module may read/mutate it. */
export type TreeState = { readonly __treeState: unique symbol };

export type SpotStatus =
  /** Next node exists but its prerequisites are not met. */
  | 'locked'
  /** A rival in the next node's exclusiveGroup is already owned. */
  | 'exclusive-locked'
  /** Next node is purchasable right now. */
  | 'affordable'
  /** Next node is unlocked but the wallet cannot pay. */
  | 'unaffordable'
  /** Every node in the chain is owned. */
  | 'complete';

export interface NodeView {
  id: string;
  content: NodeContent;
  cost: NodeCost;
  /** Present when this node participates in mutual exclusion. */
  exclusiveGroup?: string;
  /** Present when this node is level-gated (v0.3 lattice crowns). */
  minLevel?: number;
}

export interface SpotView {
  id: string;
  status: SpotStatus;
  /** Owned nodes in this chain, in chain order. */
  owned: NodeView[];
  /** Next purchase candidate, or null when complete. */
  next: NodeView | null;
  /** Total nodes in this spot's chain (for rank pips). */
  chainLength: number;
  /**
   * Spots that contain prerequisite nodes of this spot's *first* chain node.
   * Used to draw edges; independent of runtime ownership.
   */
  parentSpotIds: string[];
}

/**
 * v0.3 lattice: rendering state of a config-derived edge, from the current
 * player's point of view (owned nodes + wallet + level).
 *
 * - `traversed`   — both the edge's source and destination spots have at
 *                    least one owned node (the edge has been walked; light
 *                    it brightly).
 * - `available`   — the source spot is owned but the destination is not, and
 *                    the destination is not exclusive-locked (a legitimate
 *                    next step, though it may still be `unaffordable` or
 *                    `locked` behind a level/other-prereq gate at the spot
 *                    level — the edge itself is still "reachable").
 * - `locked`      — the edge's destination node (the spot's first chain
 *                    entry, the one whose `requires` produced this edge) is
 *                    permanently exclusive-locked by a rival pick (the oath
 *                    lock destroying the rival string's entry). This holds
 *                    even after a forsaken-path consolation on that same
 *                    spot is purchased — the entry route itself stays
 *                    destroyed.
 * - `inactive`    — the source spot is not yet owned; this route has not
 *                    been reached at all.
 */
export type EdgeState = 'traversed' | 'available' | 'locked' | 'inactive';

export interface TreeEdge {
  fromSpotId: string;
  toSpotId: string;
  state: EdgeState;
}

export interface TreeView {
  spots: SpotView[];
  wallet: Readonly<Record<string, number>>;
  ownedNodeIds: readonly string[];
  /** Config-derived edges for rendering (fromSpot → toSpot), with lattice state. */
  edges: readonly TreeEdge[];
}

/** Persistable slice of tree state (owned nodes + wallet). */
export interface TreeSnapshot {
  owned: string[];
  wallet: Record<string, number>;
}

export type ConfigError = { reason: 'invalid-config'; message: string };
