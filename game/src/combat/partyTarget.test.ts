import { describe, expect, it } from 'vitest';
import { nextPartyTargetId } from './partyTarget';

const FULL = [
  { id: 'tank', alive: true },
  { id: 'dps1', alive: true },
  { id: 'dps2', alive: true },
  { id: 'healer', alive: true },
];

describe('nextPartyTargetId', () => {
  it('starts on tank when nothing is selected', () => {
    expect(nextPartyTargetId(FULL, null)).toBe('tank');
  });

  it('cycles tank → dps1 → dps2 → healer → tank', () => {
    expect(nextPartyTargetId(FULL, 'tank')).toBe('dps1');
    expect(nextPartyTargetId(FULL, 'dps1')).toBe('dps2');
    expect(nextPartyTargetId(FULL, 'dps2')).toBe('healer');
    expect(nextPartyTargetId(FULL, 'healer')).toBe('tank');
  });

  it('skips dead members and wraps among the living', () => {
    const party = [
      { id: 'tank', alive: false },
      { id: 'dps1', alive: true },
      { id: 'dps2', alive: false },
      { id: 'healer', alive: true },
    ];
    expect(nextPartyTargetId(party, null)).toBe('dps1');
    expect(nextPartyTargetId(party, 'dps1')).toBe('healer');
    expect(nextPartyTargetId(party, 'healer')).toBe('dps1');
    // Stale target on a corpse → first living
    expect(nextPartyTargetId(party, 'tank')).toBe('dps1');
  });

  it('returns null when everyone is dead', () => {
    expect(
      nextPartyTargetId(
        [
          { id: 'tank', alive: false },
          { id: 'dps1', alive: false },
        ],
        'tank',
      ),
    ).toBeNull();
  });
});
