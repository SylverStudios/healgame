import { describe, expect, it } from 'vitest';
import type { UnitRole } from '../combat/types';
import { MOBS } from '../data/mobs';
import {
  ASH_HUSK_TEXTURE_KEY,
  attackAnimKeyForUnit,
  DPS1_TEXTURE_KEY,
  DPS2_TEXTURE_KEY,
  frameForMobVisualKey,
  frameForUnit,
  presentationForUnit,
  TANK_TEXTURE_KEY,
} from './sprites';

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

describe('presentationForUnit', () => {
  it('maps party mercs and ash-husk to PixelLab still textures', () => {
    expect(presentationForUnit(catalogUnit('tank', 'tank'))).toEqual({
      kind: 'texture',
      key: TANK_TEXTURE_KEY,
    });
    expect(presentationForUnit(catalogUnit('dps1', 'dps'))).toEqual({
      kind: 'texture',
      key: DPS1_TEXTURE_KEY,
    });
    expect(presentationForUnit(catalogUnit('dps2', 'dps'))).toEqual({
      kind: 'texture',
      key: DPS2_TEXTURE_KEY,
    });
    expect(presentationForUnit(catalogUnit('ash-husk-0', 'enemy', 'ash-husk'))).toEqual({
      kind: 'texture',
      key: ASH_HUSK_TEXTURE_KEY,
    });
  });

  it('keeps healer and other mob units on Kenney / sheet paths', () => {
    expect(presentationForUnit(catalogUnit('healer', 'healer'))).toEqual({
      kind: 'kenney',
      frame: frameForUnit(catalogUnit('healer', 'healer')),
    });
    expect(presentationForUnit(catalogUnit('iron-0', 'enemy', 'iron-husk'))).toEqual({
      kind: 'kenney',
      frame: frameForMobVisualKey('iron-husk'),
    });
  });

  it('wires attack anim keys for tank and both DPS', () => {
    expect(attackAnimKeyForUnit(catalogUnit('tank', 'tank'))).toBe('unit-tank-attack');
    expect(attackAnimKeyForUnit(catalogUnit('dps1', 'dps'))).toBe('unit-dps1-attack');
    expect(attackAnimKeyForUnit(catalogUnit('dps2', 'dps'))).toBe('unit-dps2-attack');
    expect(attackAnimKeyForUnit(catalogUnit('healer', 'healer'))).toBeUndefined();
  });
});

describe('mob visual frame coverage', () => {
  it('supports every live catalog mob visual key', () => {
    for (const mob of MOBS) {
      expect(frameForMobVisualKey(mob.visualKey), mob.id).toBeDefined();
    }
  });
});
