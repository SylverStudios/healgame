/**
 * Config-driven skill-tree service.
 *
 * Public API: validateConfig, create, update, view, withWallet, snapshot/restore,
 * walletOf, ownedOf, canPurchase. See types.ts for the Model / Action / View shapes.
 */

export type {
  ConfigError,
  NodeContent,
  NodeCost,
  NodeDef,
  NodeRequires,
  NodeView,
  RejectReason,
  SpotDef,
  SpotStatus,
  SpotView,
  TreeAction,
  TreeConfig,
  TreeSnapshot,
  TreeState,
  TreeView,
  UpdateErr,
  UpdateOk,
  UpdateResult,
} from './types';

export {
  canPurchase,
  create,
  ownedContents,
  ownedOf,
  restore,
  snapshot,
  update,
  validateConfig,
  view,
  walletOf,
  withWallet,
} from './tree';
