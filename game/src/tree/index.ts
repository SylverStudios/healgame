/**
 * Config-driven skill-tree service.
 *
 * Public API: validateConfig, create, update, view, layoutSpots, withWallet,
 * snapshot/restore, walletOf, ownedOf, canPurchase, ownedContents.
 * See types.ts for the Model / Action / View shapes.
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

export type { LayoutOptions, SpotPosition } from './layout';

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

export { layoutSpots } from './layout';
