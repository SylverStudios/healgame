import { describe, expect, it } from 'vitest';
import {
  EDGE_AVAILABLE,
  EDGE_INACTIVE,
  EDGE_LOCKED,
  EDGE_TRAVERSED,
  edgeAlpha,
  edgeDisplayWeight,
  edgeGeometry,
  edgeTint,
  edgeUsesTexturedStrip,
  socketRingTint,
  socketVisualState,
} from './treeSockets';
import { PALETTE_NUM } from './theme';

describe('socketVisualState', () => {
  it('exclusive-locked wins regardless of armed/owned', () => {
    expect(socketVisualState('exclusive-locked', true, true)).toBe('exclusive-locked');
    expect(socketVisualState('exclusive-locked', false, false)).toBe('exclusive-locked');
  });

  it('armed beats affordable while a purchase confirm is pending', () => {
    expect(socketVisualState('affordable', false, true)).toBe('armed');
  });

  it('affordable when purchasable and not armed', () => {
    expect(socketVisualState('affordable', false, false)).toBe('affordable');
  });

  it('owned when complete', () => {
    expect(socketVisualState('complete', true, false)).toBe('owned');
  });

  it('owned when any rank owned and not freshly locked', () => {
    expect(socketVisualState('unaffordable', true, false)).toBe('owned');
  });

  it('locked otherwise', () => {
    expect(socketVisualState('locked', false, false)).toBe('locked');
    expect(socketVisualState('unaffordable', false, false)).toBe('locked');
  });
});

describe('socketRingTint', () => {
  it('maps every state to a distinct PALETTE_NUM-derived color', () => {
    expect(socketRingTint('affordable')).toBe(PALETTE_NUM.gold);
    expect(socketRingTint('armed')).toBe(PALETTE_NUM.danger);
    expect(socketRingTint('owned')).toBe(PALETTE_NUM.health);
    expect(socketRingTint('exclusive-locked')).toBe(EDGE_LOCKED);
    expect(socketRingTint('locked')).toBe(PALETTE_NUM.borderDark);
  });
});

describe('edge state mappings', () => {
  it('edgeTint matches the four-state palette', () => {
    expect(edgeTint('traversed')).toBe(EDGE_TRAVERSED);
    expect(edgeTint('available')).toBe(EDGE_AVAILABLE);
    expect(edgeTint('inactive')).toBe(EDGE_INACTIVE);
    expect(edgeTint('locked')).toBe(EDGE_LOCKED);
  });

  it('edgeDisplayWeight keeps inactive thinnest and traversed heaviest', () => {
    const w = {
      traversed: edgeDisplayWeight('traversed'),
      available: edgeDisplayWeight('available'),
      locked: edgeDisplayWeight('locked'),
      inactive: edgeDisplayWeight('inactive'),
    };
    expect(w.inactive).toBeLessThan(w.available);
    expect(w.available).toBeLessThanOrEqual(w.locked);
    expect(w.locked).toBeLessThan(w.traversed);
  });

  it('edgeAlpha keeps traversed fully opaque and inactive dimmest', () => {
    expect(edgeAlpha('traversed')).toBe(1);
    expect(edgeAlpha('inactive')).toBeLessThan(edgeAlpha('available'));
    expect(edgeAlpha('available')).toBeLessThan(edgeAlpha('locked'));
  });

  it('only inactive skips the textured strip renderer', () => {
    expect(edgeUsesTexturedStrip('inactive')).toBe(false);
    expect(edgeUsesTexturedStrip('traversed')).toBe(true);
    expect(edgeUsesTexturedStrip('available')).toBe(true);
    expect(edgeUsesTexturedStrip('locked')).toBe(true);
  });
});

describe('edgeGeometry', () => {
  it('computes length, angle, and midpoint for a horizontal edge', () => {
    const g = edgeGeometry(0, 0, 100, 0);
    expect(g.length).toBe(100);
    expect(g.angleRad).toBe(0);
    expect(g.midX).toBe(50);
    expect(g.midY).toBe(0);
  });

  it('computes a diagonal edge (3-4-5 triangle)', () => {
    const g = edgeGeometry(0, 0, 3, 4);
    expect(g.length).toBe(5);
    expect(g.midX).toBe(1.5);
    expect(g.midY).toBe(2);
  });

  it('is direction-aware (reversed points negate the angle sign for a vertical flip)', () => {
    const forward = edgeGeometry(0, 0, 10, 10);
    const reversed = edgeGeometry(10, 10, 0, 0);
    expect(reversed.length).toBe(forward.length);
    expect(reversed.angleRad).not.toBe(forward.angleRad);
  });
});
