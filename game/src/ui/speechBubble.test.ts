import { describe, expect, it } from 'vitest';
import { bubbleHorizontalExtents, bubbleTotalHeight } from './speechBubble';

describe('bubbleHorizontalExtents', () => {
  it('no portrait: left and right are both the box half-width', () => {
    expect(bubbleHorizontalExtents(100, false)).toEqual({ left: 50, right: 50 });
  });

  it('with a portrait: left widens by the portrait + gap, right is untouched', () => {
    const { left, right } = bubbleHorizontalExtents(100, true);
    expect(right).toBe(50);
    expect(left).toBeGreaterThan(right);
    // left = boxWidth/2 + gap(6) + portraitDisplay(96)
    expect(left).toBe(50 + 6 + 96);
  });
});

describe('bubbleTotalHeight', () => {
  it('no portrait: matches the box height plus the tail', () => {
    expect(bubbleTotalHeight(40, false)).toBe(40 + 7);
  });

  it('with a portrait taller than the box, the portrait height wins', () => {
    // portraitDisplay(96) + tail(7) = 103, taller than a 40px box + tail (47)
    expect(bubbleTotalHeight(40, true)).toBe(96 + 7);
  });

  it('with a portrait shorter than a very tall box, the box height wins', () => {
    expect(bubbleTotalHeight(200, true)).toBe(200 + 7);
  });
});
