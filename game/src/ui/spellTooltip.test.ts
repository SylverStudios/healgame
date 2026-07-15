import { describe, expect, it } from 'vitest';
import { FRENZIED_LITURGY, STILL_WATERS } from '../data/cooldowns';
import { buildCooldownTooltipLines } from './cooldownTooltip';

describe('buildCooldownTooltipLines', () => {
  it('describes a timed buff and its independent reuse timer', () => {
    expect(buildCooldownTooltipLines(FRENZIED_LITURGY).map((line) => line.text)).toEqual([
      'Frenzied Liturgy',
      'For 30s, heals cost 1 less mana.',
      'Duration: 30s',
      'Cooldown: 40s',
    ]);
  });

  it('describes a charge-based cooldown without inventing a timed duration', () => {
    expect(buildCooldownTooltipLines(STILL_WATERS).map((line) => line.text)).toEqual([
      'Still Waters',
      'Next completed heal costs no mana.',
      'Duration: Until next heal',
      'Cooldown: 60s',
    ]);
  });
});
