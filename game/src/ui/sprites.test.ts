import { describe, expect, it } from 'vitest';
import type { UnitRole } from '../combat/types';
import { GCD_MS } from '../data/constants';
import { MOBS } from '../data/mobs';
import {
  ASH_HUSK_TEXTURE_KEY,
  attackAnimFrames,
  attackAnimKeyForUnit,
  DPS1_ATTACK_FRAME_DURATIONS_MS,
  DPS1_HURT_FRAME_DURATIONS_MS,
  DPS1_TEXTURE_KEY,
  DPS2_ATTACK_FRAME_DURATIONS_MS,
  DPS2_HURT_FRAME_DURATIONS_MS,
  DPS2_TEXTURE_KEY,
  frameForMobVisualKey,
  frameForUnit,
  HEALER_CAST_FRAME_DURATIONS_MS,
  HEALER_CAST_RELEASE_LEAD_MS,
  HEALER_CAST_STYLE_ANIMS,
  HEALER_CHARGE_FRAME_DURATIONS_MS,
  HEALER_IDLE_ANIM,
  HEALER_IDLE_ANIM_KEY,
  HEALER_IDLE_FRAME_DURATIONS_MS,
  HEALER_SOLEMN_CAST_ANIM,
  HEALER_SOLEMN_CHARGE_ANIM,
  HEALER_STRIP_ANIMS,
  HEALER_ZEALOUS_CAST_ANIM,
  HEALER_ZEALOUS_CHARGE_ANIM,
  HEALER_VOWSTRIKE_ANIM,
  HEALER_VOWSTRIKE_ANIM_KEY,
  HEALER_VOWSTRIKE_CLIMAX_FRAME_INDEX,
  HEALER_VOWSTRIKE_FRAME_DURATIONS_MS,
  HEALER_VOWSTRIKE_IMPACT_LEAD_MS,
  HEALER_ZAP_ANIM,
  HEALER_ZAP_ANIM_KEY,
  HEALER_ZAP_CLIMAX_FRAME_INDEX,
  HEALER_ZAP_FRAME_DURATIONS_MS,
  HEALER_ZAP_IMPACT_LEAD_MS,
  healerCastStyleForSpell,
  healerStripAnimFrames,
  isVowstrikeSpell,
  hurtAnimFrames,
  hurtAnimKeyForUnit,
  MERC_ATTACK_FRAME_DURATIONS_MS,
  presentationForUnit,
  TANK_ATTACK_FRAME_DURATIONS_MS,
  TANK_HURT_FRAME_DURATIONS_MS,
  TANK_TEXTURE_KEY,
  UNIT_ATTACK_ANIMS,
  UNIT_HURT_ANIMS,
  ZAP_VFX_FRAME_COUNT,
  ZAP_VFX_FRAME_DURATIONS_MS,
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

  it('wires the hurt anim key for tank, dps1, and dps2', () => {
    expect(hurtAnimKeyForUnit(catalogUnit('tank', 'tank'))).toBe('unit-tank-hurt');
    expect(hurtAnimKeyForUnit(catalogUnit('dps1', 'dps'))).toBe('unit-dps1-hurt');
    expect(hurtAnimKeyForUnit(catalogUnit('dps2', 'dps'))).toBe('unit-dps2-hurt');
    expect(hurtAnimKeyForUnit(catalogUnit('healer', 'healer'))).toBeUndefined();
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
      // Frame count omitted from the anim = however many durations are ≤0 (the shared
      // rest-duplicate convention) — tank keeps its rest hold, so nothing is skipped.
      const expectedLength = def.frameDurationsMs.filter((ms) => ms > 0).length;
      expect(frames.length).toBe(expectedLength);
      expect(frames.every((f) => f.duration > 0)).toBe(true);
    }
  });

  it('gives the tank its own faster 7-frame exposure sheet, not the shared merc one', () => {
    const tankDef = UNIT_ATTACK_ANIMS.find((def) => def.unitId === 'tank')!;
    expect(tankDef.frameDurationsMs).toBe(TANK_ATTACK_FRAME_DURATIONS_MS);
    expect(tankDef.frameDurationsMs.length).toBe(tankDef.frameCount);
    expect(tankDef.frameCount).toBe(7);
    expect(new Set(TANK_ATTACK_FRAME_DURATIONS_MS).size).toBeGreaterThan(1);
  });

  it('gives dps1 its own tight 7-frame exposure sheet, not the shared merc one', () => {
    const dps1Def = UNIT_ATTACK_ANIMS.find((def) => def.unitId === 'dps1')!;
    expect(dps1Def.frameDurationsMs).toBe(DPS1_ATTACK_FRAME_DURATIONS_MS);
    expect(dps1Def.frameDurationsMs.length).toBe(dps1Def.frameCount);
    expect(dps1Def.frameCount).toBe(7);
    expect(new Set(DPS1_ATTACK_FRAME_DURATIONS_MS).size).toBeGreaterThan(1);
  });

  it('gives dps2 its own tight 7-frame exposure sheet, not the shared merc one', () => {
    const dps2Def = UNIT_ATTACK_ANIMS.find((def) => def.unitId === 'dps2')!;
    expect(dps2Def.frameDurationsMs).toBe(DPS2_ATTACK_FRAME_DURATIONS_MS);
    expect(dps2Def.frameDurationsMs.length).toBe(dps2Def.frameCount);
    expect(dps2Def.frameCount).toBe(7);
    expect(new Set(DPS2_ATTACK_FRAME_DURATIONS_MS).size).toBeGreaterThan(1);
  });
});

describe('tank / dps1 / dps2 hurt exposure sheets', () => {
  it('keeps the hurt strip length matched to its duration table (never equal times)', () => {
    const def = UNIT_HURT_ANIMS.find((d) => d.unitId === 'tank')!;
    expect(def.frameDurationsMs).toBe(TANK_HURT_FRAME_DURATIONS_MS);
    expect(TANK_HURT_FRAME_DURATIONS_MS.length).toBe(def.frameCount);
    expect(def.frameCount).toBe(5);
    expect(new Set(TANK_HURT_FRAME_DURATIONS_MS).size).toBeGreaterThan(1);
  });

  it('gives dps1 its own hurt exposure sheet matched to its duration table (never equal times)', () => {
    const def = UNIT_HURT_ANIMS.find((d) => d.unitId === 'dps1')!;
    expect(def.frameDurationsMs).toBe(DPS1_HURT_FRAME_DURATIONS_MS);
    expect(DPS1_HURT_FRAME_DURATIONS_MS.length).toBe(def.frameCount);
    expect(def.frameCount).toBe(5);
    expect(new Set(DPS1_HURT_FRAME_DURATIONS_MS).size).toBeGreaterThan(1);
  });

  it('gives dps2 its own hurt exposure sheet matched to its duration table (never equal times)', () => {
    const def = UNIT_HURT_ANIMS.find((d) => d.unitId === 'dps2')!;
    expect(def.frameDurationsMs).toBe(DPS2_HURT_FRAME_DURATIONS_MS);
    expect(DPS2_HURT_FRAME_DURATIONS_MS.length).toBe(def.frameCount);
    expect(def.frameCount).toBe(5);
    expect(new Set(DPS2_HURT_FRAME_DURATIONS_MS).size).toBeGreaterThan(1);
  });

  it('builds Phaser frames from the hurt exposure sheet', () => {
    for (const def of UNIT_HURT_ANIMS) {
      const frames = hurtAnimFrames(def);
      expect(frames.length).toBe(def.frameCount);
      expect(frames.every((f) => f.duration > 0)).toBe(true);
      expect(frames[0]!.key).toBe(def.frameKey(0));
    }
  });
});

describe('healer charge / cast exposure sheets (Solemn / Zealous)', () => {
  it('keeps charge and cast strip lengths matched to their duration tables', () => {
    expect(HEALER_CHARGE_FRAME_DURATIONS_MS.length).toBe(HEALER_SOLEMN_CHARGE_ANIM.frameCount);
    expect(HEALER_CHARGE_FRAME_DURATIONS_MS.length).toBe(HEALER_ZEALOUS_CHARGE_ANIM.frameCount);
    expect(HEALER_CAST_FRAME_DURATIONS_MS.length).toBe(HEALER_SOLEMN_CAST_ANIM.frameCount);
    expect(HEALER_CAST_FRAME_DURATIONS_MS.length).toBe(HEALER_ZEALOUS_CAST_ANIM.frameCount);
  });

  it('holds release contact longer than the approach frames', () => {
    const contactMs = HEALER_CAST_FRAME_DURATIONS_MS[HEALER_CAST_FRAME_DURATIONS_MS.length - 1]!;
    const approachMs = HEALER_CAST_FRAME_DURATIONS_MS[HEALER_CAST_FRAME_DURATIONS_MS.length - 2]!;
    expect(contactMs).toBeGreaterThanOrEqual(133);
    expect(contactMs).toBeGreaterThan(approachMs);
  });

  it('dwells on the peak charge frame longer than the in-betweens', () => {
    const peakMs = HEALER_CHARGE_FRAME_DURATIONS_MS[2]!;
    const settleMs = HEALER_CHARGE_FRAME_DURATIONS_MS[0]!;
    expect(peakMs).toBeGreaterThan(settleMs);
  });

  it('leads the cast-action so contact begins near castFinished', () => {
    expect(HEALER_CAST_RELEASE_LEAD_MS).toBe(
      HEALER_CAST_FRAME_DURATIONS_MS.slice(0, -1).reduce((sum, ms) => sum + ms, 0),
    );
    expect(HEALER_CAST_RELEASE_LEAD_MS).toBeGreaterThan(200);
    expect(HEALER_CAST_RELEASE_LEAD_MS).toBeLessThan(500);
  });

  it('maps solemn / zealous spells to the matching cast style', () => {
    expect(healerCastStyleForSpell('solemn-mend')).toBe('solemn');
    expect(healerCastStyleForSpell('solemn-vigil')).toBe('solemn');
    expect(healerCastStyleForSpell('zealous-mending')).toBe('zealous');
    expect(healerCastStyleForSpell('zealous-flare')).toBe('zealous');
    // Vowstrike uses its own attack strip; cast-style mapping is unused for it.
    expect(isVowstrikeSpell('vowstrike-virtue')).toBe(true);
    expect(isVowstrikeSpell('vowstrike-vengeance')).toBe(true);
    expect(isVowstrikeSpell('bonk')).toBe(false);
  });

  it('registers charge as loops and cast as one-shots for both styles', () => {
    expect(HEALER_SOLEMN_CHARGE_ANIM.loop).toBe(true);
    expect(HEALER_ZEALOUS_CHARGE_ANIM.loop).toBe(true);
    expect(HEALER_SOLEMN_CAST_ANIM.loop).toBe(false);
    expect(HEALER_ZEALOUS_CAST_ANIM.loop).toBe(false);
    expect(HEALER_CAST_STYLE_ANIMS.solemn.chargeAnimKey).toBe(HEALER_SOLEMN_CHARGE_ANIM.animKey);
    expect(HEALER_CAST_STYLE_ANIMS.zealous.castAnimKey).toBe(HEALER_ZEALOUS_CAST_ANIM.animKey);
  });
});

describe('healer idle / zap exposure sheets (chunk 1B)', () => {
  it('keeps idle / zap / vowstrike strip lengths matched to their duration tables', () => {
    expect(HEALER_IDLE_FRAME_DURATIONS_MS.length).toBe(HEALER_IDLE_ANIM.frameCount);
    expect(HEALER_ZAP_FRAME_DURATIONS_MS.length).toBe(HEALER_ZAP_ANIM.frameCount);
    expect(HEALER_VOWSTRIKE_FRAME_DURATIONS_MS.length).toBe(HEALER_VOWSTRIKE_ANIM.frameCount);
  });

  it('never uses equal frame times (FE holds, not a uniform GIF cadence)', () => {
    expect(new Set(HEALER_IDLE_FRAME_DURATIONS_MS).size).toBeGreaterThan(1);
    expect(new Set(HEALER_ZAP_FRAME_DURATIONS_MS).size).toBeGreaterThan(1);
    expect(new Set(HEALER_VOWSTRIKE_FRAME_DURATIONS_MS).size).toBeGreaterThan(1);
    expect(new Set(ZAP_VFX_FRAME_DURATIONS_MS).size).toBeGreaterThan(1);
  });

  it('dwells on the idle loop peak longer than its settle frames', () => {
    // Sheet: settle, rise, peak (dwell), fall, settle.
    const peakMs = HEALER_IDLE_FRAME_DURATIONS_MS[2]!;
    const riseMs = HEALER_IDLE_FRAME_DURATIONS_MS[1]!;
    expect(peakMs).toBeGreaterThan(riseMs);
  });

  it('holds the zap spark longer than the antic and recovery frames', () => {
    // Sheet: antic, spark-antic, spark hold (contact), snap, recover, settle, rest.
    const sparkMs = HEALER_ZAP_FRAME_DURATIONS_MS[HEALER_ZAP_CLIMAX_FRAME_INDEX]!;
    const anticMs = HEALER_ZAP_FRAME_DURATIONS_MS[0]!;
    expect(sparkMs).toBeGreaterThan(anticMs);
    expect(sparkMs).toBeGreaterThanOrEqual(200);
  });

  it('delays Bonk hit presentation until the zap spark frame begins', () => {
    expect(HEALER_ZAP_IMPACT_LEAD_MS).toBe(
      HEALER_ZAP_FRAME_DURATIONS_MS.slice(0, HEALER_ZAP_CLIMAX_FRAME_INDEX).reduce(
        (sum, ms) => sum + ms,
        0,
      ),
    );
    expect(HEALER_ZAP_IMPACT_LEAD_MS).toBe(200);
    expect(HEALER_ZAP_IMPACT_LEAD_MS).toBeLessThan(GCD_MS);
  });

  it('holds the Vowstrike climax longer than the raise frames and stays under GCD', () => {
    const climaxMs = HEALER_VOWSTRIKE_FRAME_DURATIONS_MS[HEALER_VOWSTRIKE_CLIMAX_FRAME_INDEX]!;
    const firstMs = HEALER_VOWSTRIKE_FRAME_DURATIONS_MS[0]!;
    expect(climaxMs).toBeGreaterThan(firstMs);
    expect(HEALER_VOWSTRIKE_IMPACT_LEAD_MS).toBe(
      HEALER_VOWSTRIKE_FRAME_DURATIONS_MS.slice(0, HEALER_VOWSTRIKE_CLIMAX_FRAME_INDEX).reduce(
        (sum, ms) => sum + ms,
        0,
      ),
    );
    const totalMs = HEALER_VOWSTRIKE_FRAME_DURATIONS_MS.reduce((sum, ms) => sum + ms, 0);
    expect(totalMs).toBeLessThan(GCD_MS);
    expect(HEALER_VOWSTRIKE_IMPACT_LEAD_MS).toBeLessThan(300);
  });

  it('registers idle as a loop and zap / vowstrike as one-shots', () => {
    expect(HEALER_IDLE_ANIM.loop).toBe(true);
    expect(HEALER_ZAP_ANIM.loop).toBe(false);
    expect(HEALER_VOWSTRIKE_ANIM.loop).toBe(false);
    expect(HEALER_STRIP_ANIMS.map((d) => d.animKey)).toEqual([
      HEALER_IDLE_ANIM_KEY,
      HEALER_ZAP_ANIM_KEY,
      HEALER_VOWSTRIKE_ANIM_KEY,
      HEALER_SOLEMN_CHARGE_ANIM.animKey,
      HEALER_ZEALOUS_CHARGE_ANIM.animKey,
      HEALER_SOLEMN_CAST_ANIM.animKey,
      HEALER_ZEALOUS_CAST_ANIM.animKey,
    ]);
  });

  it('builds Phaser frames from each healer strip exposure sheet', () => {
    for (const def of HEALER_STRIP_ANIMS) {
      const frames = healerStripAnimFrames(def);
      expect(frames.length).toBe(def.frameCount);
      expect(frames.every((f) => f.duration > 0)).toBe(true);
      expect(frames[0]!.key).toBe(def.frameKey(0));
    }
  });

  it('keeps the zap impact VFX exposure sheet matched to its frame count', () => {
    expect(ZAP_VFX_FRAME_DURATIONS_MS.length).toBe(ZAP_VFX_FRAME_COUNT);
  });
});

describe('mob visual frame coverage', () => {
  it('supports every live catalog mob visual key', () => {
    for (const mob of MOBS) {
      expect(frameForMobVisualKey(mob.visualKey), mob.id).toBeDefined();
    }
  });
});
