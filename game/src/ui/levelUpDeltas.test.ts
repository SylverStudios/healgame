import { describe, expect, it } from 'vitest';
import { buildLevelUpDeltas, buildRegenNote } from './levelUpDeltas';
import { PARTY_LEVEL_HP, LEVEL_MANA } from '../data/constants';

// ---------------------------------------------------------------------------
// buildRegenNote
// ---------------------------------------------------------------------------

describe('buildRegenNote', () => {
  it('returns empty string when after has no regen', () => {
    expect(buildRegenNote({ manaRegen: null }, { manaRegen: null })).toBe('');
    expect(
      buildRegenNote(
        { manaRegen: { amount: 1, intervalMs: 10_000 } },
        { manaRegen: null },
      ),
    ).toBe('');
  });

  it('returns empty string when regen amount did not increase', () => {
    const sameRegen = { manaRegen: { amount: 2, intervalMs: 10_000 } };
    expect(buildRegenNote(sameRegen, sameRegen)).toBe('');
    expect(
      buildRegenNote(
        { manaRegen: { amount: 3, intervalMs: 10_000 } },
        { manaRegen: { amount: 3, intervalMs: 10_000 } },
      ),
    ).toBe('');
  });

  it('reports unlock when before has no regen and after has regen (null → non-null)', () => {
    const result = buildRegenNote(
      { manaRegen: null },
      { manaRegen: { amount: 1, intervalMs: 10_000 } },
    );
    expect(result).toBe('Regen +1/10s');
  });

  it('reports rank gain when regen amount increases', () => {
    const result = buildRegenNote(
      { manaRegen: { amount: 1, intervalMs: 10_000 } },
      { manaRegen: { amount: 2, intervalMs: 10_000 } },
    );
    expect(result).toBe('Regen +1/10s');
  });

  it('formats multi-rank jumps correctly', () => {
    const result = buildRegenNote(
      { manaRegen: null },
      { manaRegen: { amount: 3, intervalMs: 10_000 } },
    );
    expect(result).toBe('Regen +3/10s');
  });

  it('rounds intervalMs to seconds', () => {
    const result = buildRegenNote(
      { manaRegen: null },
      { manaRegen: { amount: 1, intervalMs: 5_500 } },
    );
    expect(result).toBe('Regen +1/6s');
  });
});

// ---------------------------------------------------------------------------
// buildLevelUpDeltas — derived from PARTY_LEVEL_HP / LEVEL_MANA constants
// ---------------------------------------------------------------------------

describe('buildLevelUpDeltas', () => {
  it('level 1 → 2: reports HP gains per role using live constants', () => {
    const { hpLine } = buildLevelUpDeltas(1, 2);
    const { tankPerLevel, dpsPerLevel, healerPerLevel } = PARTY_LEVEL_HP;
    expect(hpLine).toContain(`Tank +${tankPerLevel}`);
    expect(hpLine).toContain(`DPS1 +${dpsPerLevel}`);
    expect(hpLine).toContain(`DPS2 +${dpsPerLevel}`);
    expect(hpLine).toContain(`Heal +${healerPerLevel}`);
    expect(hpLine.startsWith('HP')).toBe(true);
  });

  it('level 1 → 2: reports mana pool gain', () => {
    const { manaLine } = buildLevelUpDeltas(1, 2);
    const { poolPerLevel } = LEVEL_MANA;
    expect(manaLine).toContain(`Mana +${poolPerLevel}`);
  });

  it('multi-level jump: deltas are cumulative (level 1 → 3)', () => {
    const { hpLine } = buildLevelUpDeltas(1, 3);
    const { tankPerLevel, dpsPerLevel, healerPerLevel } = PARTY_LEVEL_HP;
    expect(hpLine).toContain(`Tank +${tankPerLevel * 2}`);
    expect(hpLine).toContain(`DPS1 +${dpsPerLevel * 2}`);
    expect(hpLine).toContain(`DPS2 +${dpsPerLevel * 2}`);
    expect(hpLine).toContain(`Heal +${healerPerLevel * 2}`);
  });

  it('same-level (no change): HP line shows "HP" prefix with no bonuses', () => {
    const { hpLine } = buildLevelUpDeltas(2, 2);
    expect(hpLine).toBe('HP');
  });

  it('manaLine includes regen note when first regen rank unlocks', () => {
    // regenFirstLevel is the first level with regen; 1→regenFirstLevel crosses that threshold
    const { regenFirstLevel, poolPerLevel, regenAmountPerRank, regenIntervalMs } = LEVEL_MANA;
    if (regenFirstLevel > 1) {
      const { manaLine } = buildLevelUpDeltas(regenFirstLevel - 1, regenFirstLevel);
      const expectedPool = poolPerLevel;
      const expectedRegen = regenAmountPerRank;
      const expectedInterval = Math.round(regenIntervalMs / 1000);
      expect(manaLine).toContain(`Mana +${expectedPool}`);
      expect(manaLine).toContain(`Regen +${expectedRegen}/${expectedInterval}s`);
    }
  });

  it('manaLine has no regen note when below regenFirstLevel', () => {
    const { regenFirstLevel } = LEVEL_MANA;
    if (regenFirstLevel > 2) {
      const { manaLine } = buildLevelUpDeltas(1, 2);
      expect(manaLine).not.toContain('Regen');
    }
  });

  it('manaLine is empty string when there is no mana change (same level)', () => {
    const { manaLine } = buildLevelUpDeltas(2, 2);
    expect(manaLine).toBe('');
  });

  it('level 2 → 3: mana pool increases by poolPerLevel', () => {
    const { poolPerLevel } = LEVEL_MANA;
    const { manaLine } = buildLevelUpDeltas(2, 3);
    expect(manaLine).toContain(`Mana +${poolPerLevel}`);
  });
});
