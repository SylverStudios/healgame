/**
 * Config-driven skill-tree service.
 *
 * Public API: validateConfig, create, update, view, layoutSpots, withWallet,
 * snapshot/restore, walletOf, ownedOf, canPurchase, ownedContents.
 * See types.ts for the Model / Action / View shapes.
 */

export type {
  ConfigError,
  EdgeState,
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
  TreeEdge,
  TreeSnapshot,
  TreeState,
  TreeView,
  UpdateErr,
  UpdateOk,
  UpdateResult,
} from './types';

export type { GridPosition, GridSpacing, LayoutOptions, SpotPosition } from './layout';

export type { BuildGlyph } from './glyph';

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

export { layoutFromGrid, layoutSpots } from './layout';

export { buildGlyphFromTree } from './glyph';
