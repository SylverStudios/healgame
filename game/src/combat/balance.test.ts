import { describe, expect, it } from 'vitest';
import {
  BASE_KIT,
  runBot,
  runBuildBot,
  VIGIL_EFFICIENCY_LOADOUT,
  VIGIL_LOADOUT,
  ZEALOT_LOADOUT,
} from './balanceBot';
import { ASH_GATE, BLACK_CHOIR, CINDER_VAULT, IRON_PASS, THE_MAW, VERDANT_RIFT } from '../data/encounters';
import { SPELLS } from '../data/constants';
import { RELICS } from '../data/relics';

/**
 * Balance gates for poc-spec §4.1 ("threat is mana, not raw HPS") and §7
 * ("Dungeon 2 cannot be cleared"), extended by alpha-0.1-handoff §Balance gate
 * amendments for Iron Pass (Dungeon 2) + relics, mid-tier Cinder Vault / Black
 * Choir, and later catalog dungeons. Bot implementation lives in balanceBot.ts
 * (shared with `npm run content -- balance`).
 *
 *   1. Ash Gate with no healing at all → wipe (a healer must matter).
 *   2. Ash Gate, NAIVE healing on the starting kit → wipe.
 *   3. Ash Gate, disciplined healing on the starting kit → never a comfortable clear.
 *   4. Ash Gate, maxed Vigil/Zealot → victory, ≥3 alive.
 *   5. Bonehowl lands ≥1 in a winning Ash Gate run.
 *   6–7. Maxed kits clear Iron Pass; Tunnel Vision + CDs fire.
 *   8. Maxed kits (+ relics) wipe on The Maw.
 *   9. Maxed kits clear Cinder Vault; Emberfall lands ≥1.
 *  10. Maxed kits clear Verdant Rift; Needle Gaze focus lands ≥1.
 *  11. Maxed kits wipe on Black Choir; Soul Toll burns mana ≥1.
 */

describe('Ash Gate difficulty shape (poc-spec §4.1)', () => {
  it('wipes with no healing at all — the healer must matter', () => {
    const run = runBot(ASH_GATE, BASE_KIT, {}, 'none');
    expect(run.status).toBe('wipe');
  });

  it('wipes with naive spam-healing on the starting kit — the expected first run; overheal loses', () => {
    const run = runBot(ASH_GATE, BASE_KIT, {}, 'naive');
    expect(run.status).toBe('wipe');
  });

  it('never cruises with perfect discipline on the starting kit — wipe or pyrrhic OOM scrape at best', () => {
    const run = runBot(ASH_GATE, BASE_KIT, {}, 'disciplined');
    if (run.status === 'victory') {
      expect(run.healerManaLeft).toBeLessThan(SPELLS.solemnMend.mana);
      expect(run.survivors).toBeLessThanOrEqual(2);
    }
  });

  it('is cleared with disciplined healing on both maxed subclass builds, most of the party standing', () => {
    const vigilRun = runBuildBot(ASH_GATE, VIGIL_LOADOUT, 'disciplined');
    expect(vigilRun.status).toBe('victory');
    expect(vigilRun.healsCast).toBeGreaterThan(0);
    expect(vigilRun.survivors).toBeGreaterThanOrEqual(3);

    const vigilEfficiencyRun = runBuildBot(ASH_GATE, VIGIL_EFFICIENCY_LOADOUT, 'disciplined');
    expect(vigilEfficiencyRun.status).toBe('victory');
    expect(vigilEfficiencyRun.healsCast).toBeGreaterThan(0);
    expect(vigilEfficiencyRun.survivors).toBeGreaterThanOrEqual(3);

    const zealotRun = runBuildBot(ASH_GATE, ZEALOT_LOADOUT, 'disciplined');
    expect(zealotRun.status).toBe('victory');
    expect(zealotRun.healsCast).toBeGreaterThan(0);
    expect(zealotRun.survivors).toBeGreaterThanOrEqual(3);
  });

  it('the Bonehowl telegraph lands at least once in a winning run (either subclass build)', () => {
    const vigilRun = runBuildBot(ASH_GATE, VIGIL_LOADOUT, 'disciplined');
    const zealotRun = runBuildBot(ASH_GATE, ZEALOT_LOADOUT, 'disciplined');
    expect(vigilRun.bossCastFinished >= 1 || zealotRun.bossCastFinished >= 1).toBe(true);
  });
});

describe('Iron Pass difficulty shape (alpha-0.1-handoff §D2/§D3, chunk 9a)', () => {
  it('a maxed Vigil build clears Iron Pass with disciplined play, Tunnel Vision landing at least once', () => {
    const run = runBuildBot(IRON_PASS, VIGIL_LOADOUT, 'disciplined');
    expect(run.status).toBe('victory');
    expect(run.survivors).toBeGreaterThanOrEqual(3);
    expect(run.bossFocusStarted).toBeGreaterThanOrEqual(1);
    expect(run.cdActivations).toBeGreaterThanOrEqual(1);
  });

  it('the mutually exclusive Vigil efficiency build also clears Iron Pass', () => {
    const run = runBuildBot(IRON_PASS, VIGIL_EFFICIENCY_LOADOUT, 'disciplined');
    expect(run.status).toBe('victory');
    expect(run.survivors).toBeGreaterThanOrEqual(3);
    expect(run.bossFocusStarted).toBeGreaterThanOrEqual(1);
    expect(run.cdActivations).toBeGreaterThanOrEqual(1);
  });

  it('a maxed Zealot build clears Iron Pass with disciplined play', () => {
    const run = runBuildBot(IRON_PASS, ZEALOT_LOADOUT, 'disciplined');
    expect(run.status).toBe('victory');
    expect(run.survivors).toBeGreaterThanOrEqual(3);
    expect(run.cdActivations).toBeGreaterThanOrEqual(1);
  });
});

describe('Cinder Vault difficulty shape (mid-tier Dungeon 3)', () => {
  it('a maxed Vigil build clears Cinder Vault with disciplined play, Emberfall landing at least once', () => {
    const run = runBuildBot(CINDER_VAULT, VIGIL_LOADOUT, 'disciplined');
    expect(run.status).toBe('victory');
    expect(run.survivors).toBeGreaterThanOrEqual(3);
    expect(run.partyDoTStarted).toBeGreaterThanOrEqual(1);
  });

  it('the mutually exclusive Vigil efficiency build also clears Cinder Vault', () => {
    const run = runBuildBot(CINDER_VAULT, VIGIL_EFFICIENCY_LOADOUT, 'disciplined');
    expect(run.status).toBe('victory');
    expect(run.survivors).toBeGreaterThanOrEqual(3);
    expect(run.partyDoTStarted).toBeGreaterThanOrEqual(1);
  });

  it('a maxed Zealot build clears Cinder Vault with disciplined play', () => {
    const run = runBuildBot(CINDER_VAULT, ZEALOT_LOADOUT, 'disciplined');
    expect(run.status).toBe('victory');
    expect(run.survivors).toBeGreaterThanOrEqual(3);
    expect(run.partyDoTStarted).toBeGreaterThanOrEqual(1);
  });
});

describe('Verdant Rift difficulty shape (Dungeon 4)', () => {
  it('a maxed Vigil build clears Verdant Rift with Needle Gaze landing at least once', () => {
    const run = runBuildBot(VERDANT_RIFT, VIGIL_LOADOUT, 'disciplined');
    expect(run.status).toBe('victory');
    expect(run.survivors).toBeGreaterThanOrEqual(3);
    expect(run.bossFocusStarted).toBeGreaterThanOrEqual(1);
  });

  it('the mutually exclusive Vigil efficiency build also clears Verdant Rift', () => {
    const run = runBuildBot(VERDANT_RIFT, VIGIL_EFFICIENCY_LOADOUT, 'disciplined');
    expect(run.status).toBe('victory');
    expect(run.survivors).toBeGreaterThanOrEqual(3);
    expect(run.bossFocusStarted).toBeGreaterThanOrEqual(1);
  });

  it('a maxed Zealot build clears Verdant Rift with disciplined play', () => {
    const run = runBuildBot(VERDANT_RIFT, ZEALOT_LOADOUT, 'disciplined');
    expect(run.status).toBe('victory');
    expect(run.survivors).toBeGreaterThanOrEqual(3);
    expect(run.bossFocusStarted).toBeGreaterThanOrEqual(1);
  });
});

describe('Black Choir is a soft talent-point gate (Dungeon 5)', () => {
  it('wipes with either maxed subclass build and disciplined healing (no relic)', () => {
    const vigil = runBuildBot(BLACK_CHOIR, VIGIL_LOADOUT, 'disciplined');
    const vigilEff = runBuildBot(BLACK_CHOIR, VIGIL_EFFICIENCY_LOADOUT, 'disciplined');
    const zealot = runBuildBot(BLACK_CHOIR, ZEALOT_LOADOUT, 'disciplined');
    expect(vigil.status).toBe('wipe');
    expect(vigilEff.status).toBe('wipe');
    expect(zealot.status).toBe('wipe');
    expect(vigil.manaBurns + vigilEff.manaBurns + zealot.manaBurns).toBeGreaterThanOrEqual(1);
  });
});

describe('The Maw is an unwinnable sandbox (poc-spec §7, alpha-0.1-handoff §D7 chunk 9a)', () => {
  it('wipes even with either maxed subclass build and disciplined healing (no relic)', () => {
    expect(runBuildBot(THE_MAW, VIGIL_LOADOUT, 'disciplined').status).toBe('wipe');
    expect(runBuildBot(THE_MAW, VIGIL_EFFICIENCY_LOADOUT, 'disciplined').status).toBe('wipe');
    expect(runBuildBot(THE_MAW, ZEALOT_LOADOUT, 'disciplined').status).toBe('wipe');
  });

  it.each(RELICS)('wipes with either maxed build even holding the $name relic', (relic) => {
    expect(runBuildBot(THE_MAW, VIGIL_LOADOUT, 'disciplined', [relic]).status).toBe('wipe');
    expect(runBuildBot(THE_MAW, VIGIL_EFFICIENCY_LOADOUT, 'disciplined', [relic]).status).toBe('wipe');
    expect(runBuildBot(THE_MAW, ZEALOT_LOADOUT, 'disciplined', [relic]).status).toBe('wipe');
  });
});
