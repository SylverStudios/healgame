import { describe, expect, it } from 'vitest';
import type { UnitRole } from '../combat/types';
import { MOBS } from '../data/mobs';
import { frameForMobVisualKey, frameForUnit } from './sprites';

function catalogUnit(id: string, role: UnitRole, mobId?: string) {
  return { id, role, ...(mobId === undefined ? {} : { mobId }) };
}

describe('frameForUnit', () => {
  it('uses catalog mob identity instead of generated runtime unit ids', () => {
    const first = frameForUnit(catalogUnit('ash-husk-0', 'enemy', 'ash-husk'));
    const second = frameForUnit(catalogUnit('wave-9-spawn-42', 'enemy', 'ash-husk'));
    expect(first).toBe(second);
    expect(first).toBe(frameForMobVisualKey('ash-husk'));
  });

  it('preserves enemy and boss fallbacks for missing catalog identity', () => {
    expect(frameForUnit(catalogUnit('unknown-trash', 'enemy'))).toBe(121);
    expect(frameForUnit(catalogUnit('unknown-boss', 'boss', 'not-in-catalog'))).toBe(110);
    expect(frameForUnit(catalogUnit('inherited-key', 'boss', 'toString'))).toBe(110);
  });
});

describe('mob visual frame coverage', () => {
  it('supports every live catalog mob visual key', () => {
    for (const mob of MOBS) {
      expect(frameForMobVisualKey(mob.visualKey), mob.id).toBeDefined();
    }
  });
});
