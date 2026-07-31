/**
 * v1 M3: deterministic tank block (every-N carry model).
 *
 * Contract:
 *   carry += postArmorDamage
 *   blocked = floor(carry / N)
 *   carry   = carry % N
 *   finalDamage = max(0, postArmorDamage - blocked)
 *
 * Armor floor-1 applies ONLY to the postArmor step; after block the final
 * may be 0 (full block).  Non-tank roles receive no block.
 */

import { describe, expect, it } from 'vitest';
import { CombatEngine } from './engine';
import type { CombatEvent } from './types';
import { makeTestEncounter, TEST_SOLEMN_MEND, TEST_SPELLS } from './testFixtures';

/** Collect all `damage` events from an advance. */
function damageEvents(events: CombatEvent[]) {
  return events.filter((e): e is Extract<CombatEvent, { type: 'damage' }> => e.type === 'damage');
}

/** Build an encounter whose trash enemy swings for `autoDamage` every `swingIntervalMs`. */
function makeBlockEncounter(autoDamage: number, swingIntervalMs: number) {
  return makeTestEncounter({
    waves: [
      {
        enemies: [
          {
            name: 'Punching Bag',
            hp: 99_999,
            count: 1,
            autoDamage,
            swingIntervalMs,
          },
        ],
      },
    ],
  });
}

describe('block (v1 M3)', () => {
  // ---- basic carry model --------------------------------------------------

  it('without blockThresholdN, no block is applied and carry is never updated', () => {
    const engine = new CombatEngine(makeBlockEncounter(3, 100), TEST_SPELLS);
    // Let enemy swing once
    const events = engine.advance(100);
    const dmg = damageEvents(events).filter((e) => e.targetId === 'tank');
    expect(dmg.length).toBeGreaterThanOrEqual(1);
    // No blocked field on any tank hit
    expect(dmg.every((e) => e.blocked === undefined)).toBe(true);
    // Amount equals the raw post-armor damage (armor 0, so 3)
    expect(dmg[0]!.amount).toBe(3);
  });

  it('N=3, hit=3: every hit blocks exactly 1 (carry stays 0)', () => {
    // carry: 0→3 blocked=1 carry=0 final=2, then repeat identically each swing
    const engine = new CombatEngine(makeBlockEncounter(3, 100), TEST_SPELLS, {
      blockThresholdN: 3,
    });
    const events1 = engine.advance(100);
    const events2 = engine.advance(100);
    const events3 = engine.advance(100);

    const hit1 = damageEvents(events1).find((e) => e.targetId === 'tank')!;
    const hit2 = damageEvents(events2).find((e) => e.targetId === 'tank')!;
    const hit3 = damageEvents(events3).find((e) => e.targetId === 'tank')!;

    expect(hit1.amount).toBe(2);
    expect(hit1.blocked).toBe(1);
    expect(hit2.amount).toBe(2);
    expect(hit2.blocked).toBe(1);
    expect(hit3.amount).toBe(2);
    expect(hit3.blocked).toBe(1);
  });

  it('N=5, hit=3: carry accumulates correctly across hits (non-uniform blocking)', () => {
    // Sequence (starting carry=0):
    //   hit 1: carry=3 blocked=0 carry=3 final=3  (no blocked field)
    //   hit 2: carry=6 blocked=1 carry=1 final=2
    //   hit 3: carry=4 blocked=0 carry=4 final=3  (no blocked field)
    //   hit 4: carry=7 blocked=1 carry=2 final=2
    //   hit 5: carry=5 blocked=1 carry=0 final=2
    const engine = new CombatEngine(makeBlockEncounter(3, 100), TEST_SPELLS, {
      blockThresholdN: 5,
    });
    const getHit = () => {
      const events = engine.advance(100);
      return damageEvents(events).find((e) => e.targetId === 'tank')!;
    };

    const h1 = getHit();
    expect(h1.amount).toBe(3);
    expect(h1.blocked).toBeUndefined();

    const h2 = getHit();
    expect(h2.amount).toBe(2);
    expect(h2.blocked).toBe(1);

    const h3 = getHit();
    expect(h3.amount).toBe(3);
    expect(h3.blocked).toBeUndefined();

    const h4 = getHit();
    expect(h4.amount).toBe(2);
    expect(h4.blocked).toBe(1);

    const h5 = getHit();
    expect(h5.amount).toBe(2);
    expect(h5.blocked).toBe(1);
  });

  // ---- full block (finalDamage === 0) -------------------------------------

  it('N=3, hit=1: every 3rd hit is fully blocked (finalDamage=0), armor floor-1 NOT re-applied', () => {
    // carry starts at 0; after 3 hits of postArmor=1:
    //   hit 1: carry=1 blocked=0 final=1
    //   hit 2: carry=2 blocked=0 final=1
    //   hit 3: carry=3 blocked=1 carry=0 final=max(0, 1-1)=0  ← full block
    const engine = new CombatEngine(makeBlockEncounter(1, 100), TEST_SPELLS, {
      blockThresholdN: 3,
    });
    const hit1 = damageEvents(engine.advance(100)).find((e) => e.targetId === 'tank')!;
    const hit2 = damageEvents(engine.advance(100)).find((e) => e.targetId === 'tank')!;
    const hit3 = damageEvents(engine.advance(100)).find((e) => e.targetId === 'tank')!;

    expect(hit1.amount).toBe(1);
    expect(hit2.amount).toBe(1);
    // Full block: 0, not clamped to 1
    expect(hit3.amount).toBe(0);
    expect(hit3.blocked).toBe(1);
  });

  it('N=1, any hit: always fully blocked (carry never accumulates)', () => {
    // carry += postArmor; blocked = floor(carry/1) = carry; carry = 0; final = 0
    const engine = new CombatEngine(makeBlockEncounter(5, 100), TEST_SPELLS, {
      blockThresholdN: 1,
    });
    for (let i = 0; i < 5; i++) {
      const hit = damageEvents(engine.advance(100)).find((e) => e.targetId === 'tank')!;
      expect(hit.amount).toBe(0);
      expect(hit.blocked).toBe(5); // all 5 blocked
    }
  });

  // ---- tank HP changes ------------etically -------------------------------

  it('tank HP reflects the blocked (reduced) damage, not the raw hit', () => {
    // N=3, hit=3: each hit deals 2 instead of 3
    const engine = new CombatEngine(makeBlockEncounter(3, 100), TEST_SPELLS, {
      blockThresholdN: 3,
    });
    const tankHpBefore = engine.state.party.find((u) => u.id === 'tank')!.hp;
    engine.advance(100); // one hit: finalDamage=2
    const tankHpAfter = engine.state.party.find((u) => u.id === 'tank')!.hp;
    expect(tankHpAfter).toBe(tankHpBefore - 2);
  });

  it('fully blocked hit does not change tank HP', () => {
    // N=3, hit=1: third hit is fully blocked
    const engine = new CombatEngine(makeBlockEncounter(1, 100), TEST_SPELLS, {
      blockThresholdN: 3,
    });
    engine.advance(100); // hit 1 — 1 damage
    engine.advance(100); // hit 2 — 1 damage
    const hpBeforeFullBlock = engine.state.party.find((u) => u.id === 'tank')!.hp;
    engine.advance(100); // hit 3 — 0 damage
    const hpAfterFullBlock = engine.state.party.find((u) => u.id === 'tank')!.hp;
    expect(hpAfterFullBlock).toBe(hpBeforeFullBlock); // unchanged
  });

  // ---- non-tank roles receive no block ------------------------------------

  it('player damage to an enemy emits no blocked field even with blockThresholdN set', () => {
    // Enemy targets have role='enemy', never 'tank' — so the block branch never fires.
    const TEST_BONK = { id: 'bonk', name: 'Bonk', heal: 0, damage: 2, mana: 0, castMs: 0 };
    const engine = new CombatEngine(makeBlockEncounter(99_999, 9_999_999), [TEST_BONK, ...TEST_SPELLS], {
      blockThresholdN: 3,
    });
    engine.setTarget('healer');
    engine.castSpell('bonk');
    const events = engine.advance(0);
    const dmg = damageEvents(events).find((e) => e.sourceId === 'healer')!;
    expect(dmg).toBeDefined();
    expect(dmg.blocked).toBeUndefined();
  });

  // ---- blocked field presence --------------------------------------------

  it('blocked field is absent (undefined) when blocked === 0', () => {
    // N=5, hit=3: first hit carry=3, blocked=0 — no blocked field
    const engine = new CombatEngine(makeBlockEncounter(3, 100), TEST_SPELLS, {
      blockThresholdN: 5,
    });
    const hit = damageEvents(engine.advance(100)).find((e) => e.targetId === 'tank')!;
    expect(hit.blocked).toBeUndefined();
  });

  it('blocked field appears on events where blocked > 0', () => {
    // N=3, hit=3: every hit blocks 1
    const engine = new CombatEngine(makeBlockEncounter(3, 100), TEST_SPELLS, {
      blockThresholdN: 3,
    });
    const hit = damageEvents(engine.advance(100)).find((e) => e.targetId === 'tank')!;
    expect(typeof hit.blocked).toBe('number');
    expect(hit.blocked).toBeGreaterThan(0);
  });

  // ---- carry resets and persists -----------------------------------------

  it('carry resets to 0 after a hit that clears it, restart accumulates cleanly', () => {
    // N=3, hit=3: carry 0→3→blocked=1,carry=0→3→blocked=1,carry=0 (cyclic)
    const engine = new CombatEngine(makeBlockEncounter(3, 100), TEST_SPELLS, {
      blockThresholdN: 3,
    });
    // Hit 1: blocked=1, carry=0
    const h1 = damageEvents(engine.advance(100)).find((e) => e.targetId === 'tank')!;
    expect(h1.blocked).toBe(1);
    // Hit 2: blocked=1, carry=0 again
    const h2 = damageEvents(engine.advance(100)).find((e) => e.targetId === 'tank')!;
    expect(h2.blocked).toBe(1);
  });

  // ---- interaction with heals (block is tank-damage-only) ----------------

  it('block does not affect heals on the tank', () => {
    // Use makeTestEncounter (slow TRASH enemies, swingIntervalMs=3000) so the tank
    // does not die during the 2000ms cast window. blockThresholdN is still set,
    // proving that the block code path only runs on applyDamageToUnit, never heals.
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS, {
      blockThresholdN: 3,
    });
    engine.setTarget('tank');
    engine.castSpell(TEST_SOLEMN_MEND.id);
    engine.advance(0); // flush castStarted
    const allEvents = engine.advance(2000);
    const healEvt = allEvents.find((e) => e.type === 'heal' && e.targetId === 'tank');
    // Heal event must exist and carry no blocked field (heals never go through block).
    expect(healEvt).toBeDefined();
    expect((healEvt as { blocked?: number }).blocked).toBeUndefined();
  });
});
