import { describe, expect, it } from 'vitest';
import type { UnitRole } from '../combat/types';
import { MOBS } from '../data/mobs';
import {
  ASH_HUSK_TEXTURE_KEY,
  attackAnimFrames,
  attackAnimKeyForUnit,
  DPS1_TEXTURE_KEY,
  DPS2_TEXTURE_KEY,
  frameForMobVisualKey,
  frameForUnit,
  HEALER_CAST_FRAME_DURATIONS_MS,
  HEALER_CAST_FRAMES,
  HEALER_CAST_RELEASE_LEAD_MS,
  HEALER_CHARGE_FRAME_DURATIONS_MS,
  HEALER_CHARGE_FRAMES,
  MERC_ATTACK_FRAME_DURATIONS_MS,
  presentationForUnit,
  TANK_TEXTURE_KEY,
  UNIT_ATTACK_ANIMS,
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

describe('merc attack exposure sheet', () => {
  it('skips the rest duplicate and holds contact longer than smear frames', () => {
    // FE timing: smears flash (1–2 @60Hz ≈ 16–33ms), contact holds (8+ ≈ 133ms+).
    expect(MERC_ATTACK_FRAME_DURATIONS_MS[0]).toBe(0);
    const smearMs = MERC_ATTACK_FRAME_DURATIONS_MS[3]!;
    const contactMs = MERC_ATTACK_FRAME_DURATIONS_MS[4]!;
    const anticMs = MERC_ATTACK_FRAME_DURATIONS_MS[1]!;
    expect(smearMs).toBeLessThanOrEqual(50);
    expect(contactMs).toBeGreaterThanOrEqual(133);
    expect(anticMs).toBeGreaterThanOrEqual(100);
    expect(contactMs).toBeGreaterThan(smearMs);
  });

  it('builds Phaser frames from the exposure sheet for every merc strip', () => {
    for (const def of UNIT_ATTACK_ANIMS) {
      const frames = attackAnimFrames(def);
      expect(frames.length).toBe(6); // rest frame omitted
      expect(frames[0]!.key).toBe(def.frameKey(1));
      expect(frames.every((f) => f.duration > 0)).toBe(true);
      const totalMs = frames.reduce((sum, f) => sum + f.duration, 0);
      expect(totalMs).toBeGreaterThan(400);
      expect(totalMs).toBeLessThan(800);
    }
  });
});

describe('healer charge / cast exposure sheets', () => {
  it('keeps charge and cast strip lengths matched to their duration tables', () => {
    expect(HEALER_CHARGE_FRAME_DURATIONS_MS.length).toBe(HEALER_CHARGE_FRAMES.length);
    expect(HEALER_CAST_FRAME_DURATIONS_MS.length).toBe(HEALER_CAST_FRAMES.length);
  });

  it('holds cast contact longer than the flash smear', () => {
    // Sheet: wind-up, orb, orb-peak, flash, contact, follow, settle.
    const flashMs = HEALER_CAST_FRAME_DURATIONS_MS[3]!;
    const contactMs = HEALER_CAST_FRAME_DURATIONS_MS[4]!;
    const orbPeakMs = HEALER_CAST_FRAME_DURATIONS_MS[2]!;
    expect(flashMs).toBeLessThanOrEqual(50);
    expect(contactMs).toBeGreaterThanOrEqual(133);
    expect(orbPeakMs).toBeGreaterThanOrEqual(100);
    expect(contactMs).toBeGreaterThan(flashMs);
  });

  it('dwells on the peak charge frame longer than the in-betweens', () => {
    const peakMs = HEALER_CHARGE_FRAME_DURATIONS_MS[3]!;
    const growMs = HEALER_CHARGE_FRAME_DURATIONS_MS[2]!;
    expect(peakMs).toBeGreaterThan(growMs);
  });

  it('leads the cast-action so flash lands near castFinished', () => {
    expect(HEALER_CAST_RELEASE_LEAD_MS).toBe(
      HEALER_CAST_FRAME_DURATIONS_MS.slice(0, 4).reduce((sum, ms) => sum + ms, 0),
    );
    expect(HEALER_CAST_RELEASE_LEAD_MS).toBeGreaterThan(200);
    expect(HEALER_CAST_RELEASE_LEAD_MS).toBeLessThan(500);
  });
});

describe('mob visual frame coverage', () => {
  it('supports every live catalog mob visual key', () => {
    for (const mob of MOBS) {
      expect(frameForMobVisualKey(mob.visualKey), mob.id).toBeDefined();
    }
  });
});
