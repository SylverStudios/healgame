/**
 * Playwright/journey test plumbing: resolve semantic GameObject names to
 * canvas coordinates. Installed once from main.ts into window.__healgame.
 * Ships in the production build on purpose (journey drives vite preview);
 * it is read-only lookup, invisible to players.
 *
 * See docs/semantic-targets-handoff.md.
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

function isContainer(obj: Phaser.GameObjects.GameObject): obj is Phaser.GameObjects.Container {
  return Array.isArray((obj as Phaser.GameObjects.Container).list);
}

function hasGetBounds(
  obj: Phaser.GameObjects.GameObject,
): obj is Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.GetBounds {
  return typeof (obj as Phaser.GameObjects.Components.GetBounds).getBounds === 'function';
}

/** Walk a display-list node and its Container children; first match wins. */
function collectVisibleNamed(
  obj: Phaser.GameObjects.GameObject,
  scene: Phaser.Scene,
  into: Map<string, NamedHit>,
): void {
  if (obj.visible !== false && typeof obj.name === 'string' && obj.name.length > 0) {
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
  if (!hasGetBounds(hit.obj)) return null;
  const bounds = hit.obj.getBounds();
  const cam = hit.scene.cameras.main;
  const tf = hit.obj as Phaser.GameObjects.Components.Transform;
  const sfX = typeof tf.scrollFactorX === 'number' ? tf.scrollFactorX : 1;
  const sfY = typeof tf.scrollFactorY === 'number' ? tf.scrollFactorY : 1;
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
