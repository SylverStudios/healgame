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
}

/**
 * A visual slot on the tree. `chain` length 1 is a normal node; length >1 is
 * a linked-list of unlocks at one spot (e.g. Buff1 → Buff2 → Buff3), shown
 * one-at-a-time as the next available purchase.
 */
export interface SpotDef {
  id: string;
  chain: string[];
}

/** Entire tree definition — pure data, safe to author outside code. */
export interface TreeConfig {
  nodes: NodeDef[];
  spots: SpotDef[];
}

/** Player action attempted against the tree. */
export type TreeAction = { type: 'purchase'; spotId: string };

export type RejectReason =
  | 'unknown-spot'
  | 'spot-complete'
  | 'requirements-unmet'
  | 'cannot-afford'
  | 'exclusive-locked'
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

export interface TreeView {
  spots: SpotView[];
  wallet: Readonly<Record<string, number>>;
  ownedNodeIds: readonly string[];
  /** Config-derived edges for rendering (fromSpot → toSpot). */
  edges: readonly { fromSpotId: string; toSpotId: string }[];
}

/** Persistable slice of tree state (owned nodes + wallet). */
export interface TreeSnapshot {
  owned: string[];
  wallet: Record<string, number>;
}

export type ConfigError = { reason: 'invalid-config'; message: string };
