/**
 * v1 M3: probabilistic crit with injected rng.
 *
 * Contracts:
 *   - Applies to player heal AND player spell damage only.
 *   - Roll: rng() * 1000 < critChancePermille
 *   - Multiply: Math.floor(raw * (1000 + critBonusPermille) / 1000)
 *   - Crit flag emitted as crit?: boolean on heal and damage events.
 *   - Default rng (() => 1): rng()*1000 = 1000, never < any permille ≤ 999 → never crits.
 *   - Merc/enemy auto-attacks are NOT affected.
 *
 * Heal tests use the tank at full HP (amount=0, overheal=raw). The invariant
 *   `amount + overheal === raw_after_crit` holds regardless of missing-HP cap.
 * This avoids the need to pre-damage the tank while still verifying the crit
 * multiply and the crit flag.
 */

import { describe, expect, it } from 'vitest';
import { CombatEngine } from './engine';
import type { CombatEvent, SpellDef } from './types';
import { makeTestEncounter, TEST_SOLEMN_MEND, TEST_SPELLS } from './testFixtures';

/** Instant damage spell for crit damage tests (castMs=0 → no cast-window timing issues). */
const TEST_BONK: SpellDef = { id: 'bonk', name: 'Bonk', heal: 0, damage: 2, mana: 0, castMs: 0 };
const SPELLS_WITH_BONK = [TEST_BONK, ...TEST_SPELLS];

/**
 * Cast solemn-mend on the tank (full HP) and return the heal event.
 * Uses makeTestEncounter() (TRASH swingIntervalMs=3000), so no enemy swings
 * occur during the 2000ms cast window.
 */
function castHealAndGetEvent(opts: {
  critChancePermille: number;
  critBonusPermille: number;
  rng?: () => number;
}) {
  const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS, opts);
  engine.setTarget('tank');
  engine.castSpell(TEST_SOLEMN_MEND.id);
  engine.advance(0); // flush castStarted
  const events = engine.advance(2000);
  return events.find((e): e is Extract<CombatEvent, { type: 'heal' }> => e.type === 'heal')!;
}

describe('crit (v1 M3)', () => {
  // ---- default: never crits -----------------------------------------------

  it('default (no rng option) never crits even with high critChancePermille', () => {
    // Default rng = () => 1; check: 1*1000=1000 < 999 → false → no crit.
    const healEvt = castHealAndGetEvent({ critChancePermille: 999, critBonusPermille: 500 });
    expect(healEvt).toBeDefined();
    expect(healEvt.crit).toBeUndefined();
    // amount + overheal = raw (no crit) = TEST_SOLEMN_MEND.heal = 5
    expect(healEvt.amount + healEvt.overheal).toBe(TEST_SOLEMN_MEND.heal);
  });

  // ---- always-crit rng (rng=() => 0) -------------------------------------

  it('rng=()=>0 always crits heals and flag is on the event', () => {
    // raw=5; crit bonus=500 → floor(5 * 1500 / 1000) = 7; amount+overheal=7
    const healEvt = castHealAndGetEvent({
      critChancePermille: 500,
      critBonusPermille: 500,
      rng: () => 0,
    });
    expect(healEvt).toBeDefined();
    expect(healEvt.crit).toBe(true);
    expect(healEvt.amount + healEvt.overheal).toBe(7);
  });

  it('rng=()=>0 always crits player damage and flag is on the event', () => {
    const engine = new CombatEngine(makeTestEncounter(), SPELLS_WITH_BONK, {
      critChancePermille: 500,
      critBonusPermille: 500,
      rng: () => 0,
    });
    engine.setTarget('healer');
    engine.castSpell('bonk'); // instant
    const events = engine.advance(0);
    const dmgEvt = events.find(
      (e): e is Extract<CombatEvent, { type: 'damage' }> => e.type === 'damage' && e.sourceId === 'healer',
    );
    expect(dmgEvt).toBeDefined();
    expect(dmgEvt!.crit).toBe(true);
    // floor(2 * 1500 / 1000) = floor(3.0) = 3
    expect(dmgEvt!.amount).toBe(3);
  });

  // ---- crit multiply formula: floor(raw * (1000+bonus) / 1000) -----------

  it('floor is applied to the crit multiply (not round)', () => {
    // Bonk deals 2 damage.
    // critBonusPermille=500 → floor(2 * 1500 / 1000) = floor(3.0) = 3
    // critBonusPermille=999 → floor(2 * 1999 / 1000) = floor(3.998) = 3
    // critBonusPermille=1000 → floor(2 * 2000 / 1000) = 4
    const fireAndGetDmg = (bonus: number) => {
      const engine = new CombatEngine(makeTestEncounter(), SPELLS_WITH_BONK, {
        critChancePermille: 1000,
        critBonusPermille: bonus,
        rng: () => 0,
      });
      engine.setTarget('healer');
      engine.castSpell('bonk');
      const events = engine.advance(0);
      return events.find(
        (e): e is Extract<CombatEvent, { type: 'damage' }> => e.type === 'damage' && e.sourceId === 'healer',
      )!;
    };

    expect(fireAndGetDmg(500).amount).toBe(Math.floor((2 * 1500) / 1000)); // 3
    expect(fireAndGetDmg(999).amount).toBe(Math.floor((2 * 1999) / 1000)); // 3
    expect(fireAndGetDmg(1000).amount).toBe(Math.floor((2 * 2000) / 1000)); // 4
  });

  it('crit floor works correctly on a heal with non-integer intermediate', () => {
    // raw=5 (TEST_SOLEMN_MEND.heal); full-HP tank so amount+overheal=raw_after_crit.
    // bonus=100 → floor(5 * 1100 / 1000) = floor(5.5) = 5
    // bonus=200 → floor(5 * 1200 / 1000) = floor(6.0) = 6
    // bonus=501 → floor(5 * 1501 / 1000) = floor(7.505) = 7
    const makeHealEvt = (bonus: number) =>
      castHealAndGetEvent({ critChancePermille: 1000, critBonusPermille: bonus, rng: () => 0 });

    const h100 = makeHealEvt(100);
    expect(h100.amount + h100.overheal).toBe(Math.floor((5 * 1100) / 1000)); // 5

    const h200 = makeHealEvt(200);
    expect(h200.amount + h200.overheal).toBe(Math.floor((5 * 1200) / 1000)); // 6

    const h501 = makeHealEvt(501);
    expect(h501.amount + h501.overheal).toBe(Math.floor((5 * 1501) / 1000)); // 7
  });

  // ---- crit flag only set on crit; absent otherwise ----------------------

  it('crit is undefined/absent on a non-crit heal (rng just at or above threshold)', () => {
    // critChancePermille=500; rng returns 0.5 → 0.5*1000=500 which is NOT < 500 → no crit
    const healEvt = castHealAndGetEvent({
      critChancePermille: 500,
      critBonusPermille: 500,
      rng: () => 0.5,
    });
    expect(healEvt).toBeDefined();
    expect(healEvt.crit).toBeUndefined();
  });

  it('crit is set when rng is just below threshold', () => {
    // critChancePermille=500; rng returns 0.499 → 499 < 500 → crit
    const healEvt = castHealAndGetEvent({
      critChancePermille: 500,
      critBonusPermille: 500,
      rng: () => 0.499,
    });
    expect(healEvt).toBeDefined();
    expect(healEvt.crit).toBe(true);
  });

  // ---- crit does NOT apply to merc or enemy auto-attacks -----------------

  it('merc auto-attack damage events have no crit flag', () => {
    const engine = new CombatEngine(makeTestEncounter(), TEST_SPELLS, {
      critChancePermille: 1000,
      critBonusPermille: 1000,
      rng: () => 0,
    });
    // Advance enough for a DPS merc swing (MERCS.dpsSwingIntervalMs = 1000ms)
    const events = engine.advance(1000);
    const mercDmg = events.filter(
      (e): e is Extract<CombatEvent, { type: 'damage' }> =>
        e.type === 'damage' && (e.sourceId === 'dps1' || e.sourceId === 'dps2' || e.sourceId === 'tank'),
    );
    expect(mercDmg.length).toBeGreaterThan(0);
    expect(mercDmg.every((e) => e.crit === undefined)).toBe(true);
  });

  it('enemy auto-attack damage events have no crit flag', () => {
    // Use a fast-swinging enemy to guarantee an enemy hit in 100ms
    const engine = new CombatEngine(
      makeTestEncounter({
        waves: [{ enemies: [{ name: 'Enemy', hp: 99_999, count: 1, autoDamage: 1, swingIntervalMs: 100 }] }],
      }),
      TEST_SPELLS,
      {
        critChancePermille: 1000,
        critBonusPermille: 1000,
        rng: () => 0,
      },
    );
    const events = engine.advance(100);
    // Enemy IDs are generated as 'w0-0-0' etc.; sourceId will not match any party/healer id
    const enemyDmg = events.filter(
      (e): e is Extract<CombatEvent, { type: 'damage' }> =>
        e.type === 'damage' &&
        e.sourceId !== 'healer' &&
        e.sourceId !== 'tank' &&
        e.sourceId !== 'dps1' &&
        e.sourceId !== 'dps2',
    );
    expect(enemyDmg.length).toBeGreaterThan(0);
    expect(enemyDmg.every((e) => e.crit === undefined)).toBe(true);
  });

  // ---- crit on damage applies before armor --------------------------------

  it('player damage crit: critted raw is the amount on the damage event', () => {
    // Bonk deals 2. Enemies have no armor, so amount = critted raw.
    // critBonusPermille=500 → floor(2 * 1500 / 1000) = 3
    const engine = new CombatEngine(makeTestEncounter(), SPELLS_WITH_BONK, {
      critChancePermille: 1000,
      critBonusPermille: 500,
      rng: () => 0,
    });
    engine.setTarget('healer');
    engine.castSpell('bonk');
    const events = engine.advance(0);
    const dmgEvt = events.find(
      (e): e is Extract<CombatEvent, { type: 'damage' }> => e.type === 'damage' && e.sourceId === 'healer',
    )!;
    expect(dmgEvt.amount).toBe(3);
    expect(dmgEvt.crit).toBe(true);
  });

  // ---- crit amount+overheal invariant on overhealed crits -----------------

  it('crit that overheals: amount+overheal equals the critted raw', () => {
    // Tank at full HP (20/20): all heal is overheal.
    // raw=5, crit bonus=500 → raw_crit=7; applied=0, overheal=7
    const healEvt = castHealAndGetEvent({
      critChancePermille: 1000,
      critBonusPermille: 500,
      rng: () => 0,
    });
    expect(healEvt).toBeDefined();
    expect(healEvt.crit).toBe(true);
    expect(healEvt.amount).toBe(0);    // full overheal (tank at full HP)
    expect(healEvt.overheal).toBe(7);  // critted raw
  });

  // ---- rng is called per cast, not shared with block ----------------------

  it('rng call sequence: heal and damage each call rng independently', () => {
    // Sequence: rng returns 0, 1, 0, 1 alternately.
    // First cast (heal): rng()=0 → 0*1000=0 < 500 → crit=true
    // Second (bonk/damage): rng()=1 → 1*1000=1000 ≥ 500 → no crit
    let callIndex = 0;
    const seq = [0, 1, 0, 1];
    const engine = new CombatEngine(makeTestEncounter(), SPELLS_WITH_BONK, {
      critChancePermille: 500,
      critBonusPermille: 500,
      rng: () => seq[callIndex++ % seq.length]!,
    });

    // First: heal cast → rng()=0 → crit
    engine.setTarget('tank');
    engine.castSpell(TEST_SOLEMN_MEND.id);
    engine.advance(0);
    const healEvents = engine.advance(2000);
    const heal1 = healEvents.find((e): e is Extract<CombatEvent, { type: 'heal' }> => e.type === 'heal');
    expect(heal1).toBeDefined();
    expect(heal1!.crit).toBe(true);

    // Second: bonk damage → rng()=1 → 1*1000=1000 ≥ 500 → no crit
    engine.setTarget('healer'); // needed for castSpell to find a target (spell has damage)
    engine.castSpell('bonk');
    const bonkEvents = engine.advance(0);
    const bonk1 = bonkEvents.find(
      (e): e is Extract<CombatEvent, { type: 'damage' }> => e.type === 'damage' && e.sourceId === 'healer',
    );
    expect(bonk1).toBeDefined();
    expect(bonk1!.crit).toBeUndefined();
  });
});
