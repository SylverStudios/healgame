import { describe, expect, it } from 'vitest';
import {
  bubbleHorizontalExtents,
  bubbleTotalHeight,
  layoutSegmentCenters,
  segmentsForMarkedWord,
} from './speechBubble';

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

describe('layoutSegmentCenters', () => {
  it('centers a single segment at 0', () => {
    expect(layoutSegmentCenters([40])).toEqual({ totalWidth: 40, centersX: [0] });
  });

  it('lays out multiple segments as one centered run', () => {
    const { totalWidth, centersX } = layoutSegmentCenters([10, 20, 10]);
    expect(totalWidth).toBe(40);
    expect(centersX[0]).toBe(-15);
    expect(centersX[1]).toBe(0);
    expect(centersX[2]).toBe(15);
  });
});

describe('segmentsForMarkedWord', () => {
  it('marks the first occurrence of the word', () => {
    expect(segmentsForMarkedWord('but WHO should I aid first?', 'WHO')).toEqual([
      { text: 'but ' },
      { text: 'WHO', emphasize: true },
      { text: ' should I aid first?' },
    ]);
  });

  it('returns a single plain segment when the word is absent', () => {
    expect(segmentsForMarkedWord('steady', 'WHO')).toEqual([{ text: 'steady' }]);
  });
});
