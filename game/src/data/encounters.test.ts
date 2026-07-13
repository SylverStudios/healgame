import { describe, expect, it } from 'vitest';
import { CombatEngine } from '../combat/engine';
import type { CombatEvent } from '../combat/types';
import { ALL_SPELLS } from './spells';
import { CONTENT_CATALOGS } from './content/catalogs';
import { compileAllDungeons } from './content/compile';
import {
  ASH_GATE,
  ENCOUNTERS,
  ENCOUNTER_BY_ID,
  getEncounterById,
  THE_MAW,
} from './encounters';

describe('live encounter registry', () => {
  it('is exactly the ordered compiled catalog output', () => {
    expect(ENCOUNTERS).toEqual(compileAllDungeons(CONTENT_CATALOGS));
    expect([...ENCOUNTER_BY_ID.values()]).toEqual(ENCOUNTERS);
    expect(getEncounterById('ash-gate')).toBe(ASH_GATE);
    expect(getEncounterById('the-maw')).toBe(THE_MAW);
    expect(getEncounterById('missing')).toBeUndefined();
  });

  it('boots every live dungeon with resolved catalog identities', () => {
    for (const encounter of ENCOUNTERS) {
      const engine = new CombatEngine(encounter, ALL_SPELLS);
      expect(engine.state.status).toBe('running');
      expect(engine.state.enemies.length).toBeGreaterThan(0);
      expect(engine.state.enemies.every(({ mobId }) => mobId !== undefined)).toBe(true);
    }
  });

  it('produces identical bounded simulations from identical live inputs', () => {
    for (const encounter of ENCOUNTERS) {
      const first = new CombatEngine(encounter, ALL_SPELLS);
      const second = new CombatEngine(encounter, ALL_SPELLS);
      const firstLog: CombatEvent[] = [];
      const secondLog: CombatEvent[] = [];

      for (let elapsed = 0; elapsed < 30_000; elapsed += 250) {
        firstLog.push(...first.advance(250));
        secondLog.push(...second.advance(250));
      }

      expect(secondLog).toEqual(firstLog);
      expect(second.state).toEqual(first.state);
      expect(second.rewards).toEqual(first.rewards);
    }
  });
});
