import { describe, expect, it } from 'vitest';
import { CombatEngine } from './engine';
import { GCD_MS, SPELLS } from '../data/constants';
import { makeTestEncounter, TEST_SPELLS } from './testFixtures';
import type { CombatEvent } from './types';

const BONK = { ...SPELLS.bonk };

describe('Bonk (player damage, front enemy)', () => {
  it('deals 1 damage to the front living enemy with no ally target and starts GCD', () => {
    const engine = new CombatEngine(makeTestEncounter(), [...TEST_SPELLS, BONK]);
    const front = engine.state.enemies.find((e) => e.alive)!;
    const hpBefore = front.hp;

    engine.castSpell(BONK.id);
    const events = engine.advance(0);

    expect(events.some((e) => e.type === 'castStarted')).toBe(true);
    expect(events.some((e) => e.type === 'castFinished' && e.spellId === BONK.id)).toBe(true);
    const dmg = events.find(
      (e): e is Extract<CombatEvent, { type: 'damage' }> =>
        e.type === 'damage' && e.sourceId === 'healer',
    );
    expect(dmg).toEqual({ type: 'damage', targetId: front.id, amount: 1, sourceId: 'healer' });
    expect(engine.state.enemies.find((e) => e.id === front.id)!.hp).toBe(hpBefore - 1);
    expect(engine.state.playerCast).toBeNull();
    expect(engine.state.gcdRemainingMs).toBe(GCD_MS);
    expect(events.some((e) => e.type === 'heal')).toBe(false);
  });
});
