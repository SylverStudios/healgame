import { describe, expect, it } from 'vitest';
import { CombatEngine } from './engine';
import { GCD_MS, PARTY, SPELLS } from '../data/constants';
import type { CombatEvent, EncounterDef } from './types';

const VIRTUE = SPELLS.vowstrikeVirtue;
const VENGEANCE = SPELLS.vowstrikeVengeance;

/** Quiet encounter so long CD waits do not kill the party or punch through trash. */
function vowstrikeEncounter(): EncounterDef {
  return {
    id: 'vowstrike-test',
    name: 'Vowstrike Test',
    waves: [{ enemies: [{ name: 'Punching Bag', hp: 200, count: 1, autoDamage: 0, swingIntervalMs: 60_000 }] }],
    boss: {
      id: 'quiet-boss',
      name: 'Quiet Boss',
      hp: 200,
      autoDamage: 0,
      swingIntervalMs: 60_000,
    },
  };
}

describe('Vowstrike (damage + castBuff + personal CD)', () => {
  it('virtue deals 5 damage to the front enemy on cast', () => {
    const engine = new CombatEngine(vowstrikeEncounter(), [VIRTUE]);
    const enemyBefore = engine.state.enemies[0]!.hp;

    engine.castSpell(VIRTUE.id);
    const events = engine.advance(0);
    const damage = events.find(
      (e): e is Extract<CombatEvent, { type: 'damage' }> => e.type === 'damage',
    );

    expect(damage?.amount).toBe(5);
    expect(damage?.targetId).toBe(engine.state.enemies[0]!.id);
    expect(engine.state.enemies[0]!.hp).toBe(enemyBefore - 5);
  });

  it('virtue arms nextSpellManaReduction for the following spell', () => {
    const engine = new CombatEngine(vowstrikeEncounter(), [VIRTUE, SPELLS.solemnMend]);
    engine.setTarget('tank');
    engine.castSpell(VIRTUE.id);
    engine.advance(0);
    expect(engine.state.nextSpellManaReduction).toBe(2);

    engine.castSpell(SPELLS.solemnMend.id);
    engine.advance(GCD_MS);
    expect(engine.state.nextSpellManaReduction).toBe(0);
    expect(engine.state.party.find((u) => u.id === 'healer')!.mana).toBe(
      PARTY.startingMana - VIRTUE.mana - (SPELLS.solemnMend.mana - 2),
    );
  });

  it('vengeance arms nextHealPotencyPct for the following heal', () => {
    const scratchEncounter: EncounterDef = {
      ...vowstrikeEncounter(),
      waves: [{ enemies: [{ name: 'Scratch', hp: 200, count: 1, autoDamage: 3, swingIntervalMs: 1000 }] }],
    };
    const engine = new CombatEngine(scratchEncounter, [VENGEANCE, SPELLS.solemnMend]);
    engine.setTarget('tank');
    engine.advance(3000);

    engine.castSpell(VENGEANCE.id);
    engine.advance(0);
    expect(engine.state.nextHealPotencyPct).toBe(25);

    engine.castSpell(SPELLS.solemnMend.id);
    const events = engine.advance(GCD_MS + SPELLS.solemnMend.castMs);
    const heal = events.find((e): e is Extract<CombatEvent, { type: 'heal' }> => e.type === 'heal');
    const expectedPotency = Math.ceil((SPELLS.solemnMend.heal * 25) / 100);
    expect(heal?.amount).toBe(SPELLS.solemnMend.heal + expectedPotency);
    expect(engine.state.nextHealPotencyPct).toBe(0);
  });

  it('personal cooldown blocks a second cast until it recovers', () => {
    const engine = new CombatEngine(vowstrikeEncounter(), [VIRTUE]);
    engine.castSpell(VIRTUE.id);
    engine.advance(0);
    expect(engine.state.spellCooldowns).toEqual([
      { spellId: VIRTUE.id, remainingMs: VIRTUE.cooldownMs! },
    ]);

    engine.castSpell(VIRTUE.id);
    const blocked = engine.advance(0);
    expect(blocked.filter((e) => e.type === 'damage')).toHaveLength(0);

    engine.advance(VIRTUE.cooldownMs!);
    engine.castSpell(VIRTUE.id);
    const second = engine.advance(0);
    expect(second.some((e) => e.type === 'damage')).toBe(true);
  });
});
