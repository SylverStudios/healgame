/**
 * v1 M2: haste applies to player castMs only — GCD is never shortened.
 *
 * Formula (locked contract):
 *   effectiveCastMs = max(0, floor(spell.castMs * (1000 - hastePermille) / 1000))
 *
 * Secondary manaRegen: the `options.manaRegen` path is already exercised by
 * the "applies options.manaRegen on the simulation interval" test in
 * engine.options.test.ts. `loadoutFromCardSave` folds secondary manaRegen
 * into that same field, so no duplicate coverage is needed here.
 */

import { describe, expect, it } from 'vitest';
import { CombatEngine } from './engine';
import { makeTestEncounter, TEST_SPELLS, TEST_SOLEMN_MEND } from './testFixtures';

describe('haste (v1 M2)', () => {
  it('hastePermille=0 (default) leaves castMs unchanged', () => {
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS);
    engine.setTarget('healer');
    engine.castSpell('solemn-mend');
    const started = [...engine.advance(0)].find((e) => e.type === 'castStarted');
    expect(started?.type).toBe('castStarted');
    if (started?.type === 'castStarted') {
      expect(started.cast.totalMs).toBe(TEST_SOLEMN_MEND.castMs);
      expect(started.cast.remainingMs).toBe(TEST_SOLEMN_MEND.castMs);
    }
  });

  it('hastePermille reduces castMs by the correct fraction', () => {
    // 200‰ haste: floor(2000 * 800 / 1000) = 1600
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS, { hastePermille: 200 });
    engine.setTarget('healer');
    engine.castSpell('solemn-mend');
    const events = engine.advance(0);
    const started = events.find((e) => e.type === 'castStarted');
    expect(started?.type).toBe('castStarted');
    if (started?.type === 'castStarted') {
      expect(started.cast.totalMs).toBe(1600);
      expect(started.cast.remainingMs).toBe(1600);
    }
  });

  it('cast completes after effectiveCastMs, not the original spell.castMs', () => {
    // 200‰ haste → effectiveCastMs = 1600 ms for solemn-mend (castMs 2000)
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS, { hastePermille: 200 });
    engine.setTarget('healer');
    engine.castSpell('solemn-mend');
    engine.advance(0); // flush castStarted

    // Just under effectiveCastMs: cast must NOT have finished yet
    const midEvents = engine.advance(1599);
    expect(midEvents.some((e) => e.type === 'castFinished')).toBe(false);

    // One more ms: cast finishes
    const finishEvents = engine.advance(1);
    expect(finishEvents.some((e) => e.type === 'castFinished')).toBe(true);
  });

  it('haste does NOT shorten GCD', () => {
    // 800‰ haste → effectiveCastMs = floor(2000 * 200 / 1000) = 400 ms
    // GCD_MS = 1000 ms, so after the cast completes GCD has 600 ms left
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS, { hastePermille: 800 });
    engine.setTarget('healer');
    engine.castSpell('solemn-mend');
    engine.advance(0); // flush castStarted

    engine.advance(400); // cast finishes; GCD still has 600 ms remaining
    expect(engine.state.gcdRemainingMs).toBeGreaterThan(0);
    expect(engine.state.playerCast).toBeNull(); // cast is done
  });

  it('hastePermille=1000 makes any cast instant (effectiveCastMs=0)', () => {
    // floor(2000 * 0 / 1000) = 0 → instant
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS, { hastePermille: 1000 });
    engine.setTarget('healer');
    engine.castSpell('solemn-mend');
    const events = engine.advance(0);
    // castStarted AND castFinished must appear in the same advance batch
    expect(events.some((e) => e.type === 'castStarted')).toBe(true);
    expect(events.some((e) => e.type === 'castFinished')).toBe(true);
    // heal should also have fired
    expect(events.some((e) => e.type === 'heal')).toBe(true);
  });

  it('floor truncates the effective cast duration (not round)', () => {
    // 333‰ haste: floor(2000 * 667 / 1000) = floor(1334) = 1334
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS, { hastePermille: 333 });
    engine.setTarget('healer');
    engine.castSpell('solemn-mend');
    const events = engine.advance(0);
    const started = events.find((e) => e.type === 'castStarted');
    if (started?.type === 'castStarted') {
      expect(started.cast.totalMs).toBe(Math.floor((2000 * (1000 - 333)) / 1000));
    }
  });

  it('secondary manaRegen reaches engine via options.manaRegen (path verification)', () => {
    // Mirrors what loadoutFromCardSave emits for manaRegen rank 2:
    //   manaRegenFromRank(2) → { amount: 2, intervalMs: 10_000 }
    // Regen interval starts from engine construction (t=0). Cast takes 2000 ms,
    // so at t=2000 mana = startingMana - spellCost. The interval fires at t=10000,
    // which is 7999 ms after cast end (t=2000 + 7999 = 9999 < 10000, no tick)
    // then 1 ms later lands at t=10000 exactly.
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS, {
      manaRegen: { amount: 2, intervalMs: 10_000 },
    });
    engine.setTarget('healer');
    engine.castSpell('solemn-mend');
    engine.advance(2000); // let the cast finish (t=2000)

    const manaBefore = engine.state.party.find((u) => u.id === 'healer')!.mana;
    engine.advance(7999); // t=9999 — regen interval has not elapsed yet
    expect(engine.state.party.find((u) => u.id === 'healer')!.mana).toBe(manaBefore);
    engine.advance(1); // t=10000 — tick fires
    expect(engine.state.party.find((u) => u.id === 'healer')!.mana).toBe(manaBefore + 2);
  });
});
