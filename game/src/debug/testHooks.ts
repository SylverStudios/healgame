/**
 * Playwright/journey test plumbing: resolve semantic GameObject names to
 * canvas coordinates. Installed once from main.ts into window.__healgame.
 * Ships in the production build on purpose (journey drives vite preview);
 * it is read-only lookup, invisible to players.
 *
 * See docs/semantic-targets.md.
 */

import Phaser from 'phaser';

declare global {
  interface Window {
    __healgame?: {
      /** Center of the first visible object named `name` on any active
       *  scene, in game-world px (= canvas px; 960×540 fixed). */
      locate(name: string): { x: number; y: number } | null;
      /** All names currently resolvable — for debugging journey failures. */
      list(): string[];
    };
  }
}

type NamedHit = {
  obj: Phaser.GameObjects.GameObject;
  scene: Phaser.Scene;
};

/** Phaser mixins are not on the GameObject base type — probe at runtime. */
type BoundsCapable = Phaser.GameObjects.GameObject & {
  getBounds(): Phaser.Geom.Rectangle;
  visible: boolean;
  scrollFactorX?: number;
  scrollFactorY?: number;
};

function asBoundsCapable(obj: Phaser.GameObjects.GameObject): BoundsCapable | null {
  const candidate = obj as unknown as BoundsCapable;
  if (typeof candidate.getBounds !== 'function') return null;
  if (typeof candidate.visible !== 'boolean') return null;
  return candidate;
}

function isContainer(obj: Phaser.GameObjects.GameObject): obj is Phaser.GameObjects.Container {
  return Array.isArray((obj as Phaser.GameObjects.Container).list);
}

/** Walk a display-list node and its Container children; first match wins. */
function collectVisibleNamed(
  obj: Phaser.GameObjects.GameObject,
  scene: Phaser.Scene,
  into: Map<string, NamedHit>,
): void {
  const capable = asBoundsCapable(obj);
  if (capable && capable.visible && typeof obj.name === 'string' && obj.name.length > 0) {
    if (!into.has(obj.name)) into.set(obj.name, { obj, scene });
  }
  if (isContainer(obj)) {
    for (const child of obj.list) {
      collectVisibleNamed(child, scene, into);
    }
  }
}

/**
 * Convert getBounds() world-space center to canvas/screen px, accounting for
 * camera scroll and the object's scrollFactor (TreeScene HUD uses 0).
 */
function screenCenter(hit: NamedHit): { x: number; y: number } | null {
  const capable = asBoundsCapable(hit.obj);
  if (!capable) return null;
  const bounds = capable.getBounds();
  const cam = hit.scene.cameras.main;
  const sfX = typeof capable.scrollFactorX === 'number' ? capable.scrollFactorX : 1;
  const sfY = typeof capable.scrollFactorY === 'number' ? capable.scrollFactorY : 1;
  return {
    x: bounds.centerX - cam.scrollX * sfX,
    y: bounds.centerY - cam.scrollY * sfY,
  };
}

function snapshot(game: Phaser.Game): Map<string, NamedHit> {
  const into = new Map<string, NamedHit>();
  for (const scene of game.scene.getScenes(true)) {
    for (const child of scene.children.list) {
      collectVisibleNamed(child, scene, into);
    }
  }
  return into;
}

export function installTestHooks(game: Phaser.Game): void {
  window.__healgame = {
    locate(name: string): { x: number; y: number } | null {
      const hit = snapshot(game).get(name);
      if (!hit) return null;
      return screenCenter(hit);
    },
    list(): string[] {
      return [...snapshot(game).keys()].sort();
    },
  };
}
