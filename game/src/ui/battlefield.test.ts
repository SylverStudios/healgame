import { describe, expect, it } from 'vitest';
import {
  ashGateHazeBandLayout,
  ashGateImageLayouts,
  BACKDROP_DEPTH_HAZE,
  BACKDROP_DEPTH_PLATFORM,
  BACKDROP_DEPTH_STRUCTURE,
  battlefieldTexturesForVariant,
} from './battlefield';

// CombatScene's frozen layout constants (docs/ui-theme-handoff.md "Locked
// decisions") — kept as local literals rather than importing CombatScene,
// which pulls in Phaser scene wiring this test doesn't need.
const VIEW_WIDTH = 960;
const GROUND_Y = 340;
const PARTY_CENTER_X = (80 + 380) / 2;
const ENEMY_CENTER_X = (580 + 880) / 2;

describe('battlefieldTexturesForVariant', () => {
  it('lists every ashgate PixelLab texture for BootScene preload', () => {
    const textures = battlefieldTexturesForVariant('ashgate');
    expect(textures.map((t) => t.key)).toEqual([
      'battlefield-ashgate-gate-arch',
      'battlefield-ashgate-wall-fragment',
      'battlefield-ashgate-platform',
    ]);
    for (const texture of textures) {
      expect(texture.nativeWidth).toBeGreaterThan(0);
      expect(texture.nativeHeight).toBeGreaterThan(0);
    }
  });
});

describe('ashGateImageLayouts', () => {
  const layouts = ashGateImageLayouts({
    viewWidth: VIEW_WIDTH,
    groundY: GROUND_Y,
    partyCenterX: PARTY_CENTER_X,
    enemyCenterX: ENEMY_CENTER_X,
  });

  it('places every layer behind unit bodies (depth <= -1, pinned contract)', () => {
    for (const layout of layouts) {
      expect(layout.depth).toBeLessThanOrEqual(-1);
    }
  });

  it('displays every texture at exactly 2x its native size (density rule)', () => {
    const textures = battlefieldTexturesForVariant('ashgate');
    for (const layout of layouts) {
      const texture = textures.find((t) => t.key === layout.textureKey);
      expect(texture).toBeDefined();
      expect(layout.displayWidth).toBe((texture?.nativeWidth ?? 0) * 2);
      expect(layout.displayHeight).toBe((texture?.nativeHeight ?? 0) * 2);
    }
  });

  it('centers the gate arch on the view and the platforms on the party/enemy lines', () => {
    const arch = layouts.find((l) => l.textureKey === 'battlefield-ashgate-gate-arch');
    expect(arch?.x).toBe(VIEW_WIDTH / 2);
    expect(arch?.depth).toBe(BACKDROP_DEPTH_STRUCTURE);

    const platforms = layouts.filter((l) => l.textureKey === 'battlefield-ashgate-platform');
    expect(platforms).toHaveLength(2);
    expect(platforms.map((p) => p.x).sort((a, b) => a - b)).toEqual(
      [PARTY_CENTER_X, ENEMY_CENTER_X].sort((a, b) => a - b),
    );
    for (const platform of platforms) expect(platform.depth).toBe(BACKDROP_DEPTH_PLATFORM);
  });

  it('mirrors the two wall-fragment props symmetrically around view center', () => {
    const fragments = layouts.filter((l) => l.textureKey === 'battlefield-ashgate-wall-fragment');
    expect(fragments).toHaveLength(2);
    const [left, right] = fragments.sort((a, b) => a.x - b.x);
    expect((left?.x ?? 0) + (right?.x ?? 0)).toBeCloseTo(VIEW_WIDTH, 5);
    expect(left?.flipX).toBe(true);
    expect(right?.flipX ?? false).toBe(false);
  });

  it('keeps platform slices under the feet line without drifting far from GROUND_Y', () => {
    const platforms = layouts.filter((l) => l.textureKey === 'battlefield-ashgate-platform');
    for (const platform of platforms) {
      expect(Math.abs(platform.y - GROUND_Y)).toBeLessThan(100);
    }
  });
});

describe('ashGateHazeBandLayout', () => {
  it('sits above GROUND_Y, in the haze depth band', () => {
    const { y, height } = ashGateHazeBandLayout(GROUND_Y);
    expect(y).toBeLessThan(GROUND_Y);
    expect(height).toBeGreaterThan(0);
    expect(BACKDROP_DEPTH_HAZE).toBeLessThan(BACKDROP_DEPTH_PLATFORM);
    expect(BACKDROP_DEPTH_HAZE).toBeGreaterThan(BACKDROP_DEPTH_STRUCTURE);
  });
});
