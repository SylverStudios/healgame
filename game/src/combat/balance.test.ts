import { describe, expect, it } from 'vitest';
import {
  BASE_KIT,
  runBot,
  runBuildBot,
  VIGIL_EFFICIENCY_LOADOUT,
  VIGIL_LOADOUT,
  VIGIL_MID_TREE_LOADOUT,
  VIGIL_VENGEANCE_LOADOUT,
  ZEALOT_LOADOUT,
  ZEALOT_MID_TREE_LOADOUT,
  ZEALOT_VENGEANCE_LOADOUT,
  type BotRunOptions,
} from './balanceBot';
import { ASH_GATE, BLACK_CHOIR, CINDER_VAULT, IRON_PASS, THE_MAW, VERDANT_RIFT } from '../data/encounters';
import { SPELLS } from '../data/constants';
import { RELICS } from '../data/relics';

/**
 * Balance gates for poc-spec §4.1 ("threat is mana, not raw HPS") and §7
 * ("Dungeon 2 cannot be cleared"), extended by alpha-0.1-handoff §Balance gate
 * amendments for Iron Pass (Dungeon 2) + relics, mid-tier Cinder Vault /
 * Verdant Rift, and Black Choir / The Maw end-game gates.
 * Alpha 0.2 (oathbound-depth-handoff §D9): all maxed builds are now crown kits
 * (oath × Vowstrike aspect × Wrath Ascendant); Black Choir is clearable.
 *
 *   1. Ash Gate with no healing at all → wipe (a healer must matter).
 *   2. Ash Gate, NAIVE healing on the starting kit → wipe.
 *   3. Ash Gate, disciplined healing on the starting kit → never a comfortable clear.
 *   4. Ash Gate, maxed crown kits → victory, ≥3 alive.
 *   5. Bonehowl lands ≥1 in a winning Ash Gate run.
 *   6–7. Maxed crown kits clear Iron Pass; Tunnel Vision + CDs fire.
 *   8. Maxed crown kits (+ relics) wipe on The Maw.
 *   9. Maxed crown kits clear Cinder Vault; Emberfall lands ≥1.
 *  10. Maxed crown kits clear Verdant Rift; Needle Gaze focus lands ≥1.
 *  11. Black Choir is clearable with all four oath×aspect crown kits; Soul Toll burns ≥1.
 *  12. Black Choir wipes oath-path kits that lack Vowstrike / Wrath / crown (tree-depth).
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

  it('is cleared with disciplined healing on maxed crown builds, most of the party standing', () => {
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
  it('a maxed Vigil crown build clears Iron Pass with disciplined play, Tunnel Vision landing at least once', () => {
    const run = runBuildBot(IRON_PASS, VIGIL_LOADOUT, 'disciplined');
    expect(run.status).toBe('victory');
    expect(run.survivors).toBeGreaterThanOrEqual(3);
    expect(run.bossFocusStarted).toBeGreaterThanOrEqual(1);
    expect(run.cdActivations).toBeGreaterThanOrEqual(1);
  });

  it('the Vigil efficiency crown build also clears Iron Pass', () => {
    const run = runBuildBot(IRON_PASS, VIGIL_EFFICIENCY_LOADOUT, 'disciplined');
    expect(run.status).toBe('victory');
    expect(run.survivors).toBeGreaterThanOrEqual(3);
    expect(run.bossFocusStarted).toBeGreaterThanOrEqual(1);
    expect(run.cdActivations).toBeGreaterThanOrEqual(1);
  });

  it('a maxed Zealot crown build clears Iron Pass with disciplined play', () => {
    const run = runBuildBot(IRON_PASS, ZEALOT_LOADOUT, 'disciplined');
    expect(run.status).toBe('victory');
    expect(run.survivors).toBeGreaterThanOrEqual(3);
    expect(run.cdActivations).toBeGreaterThanOrEqual(1);
  });
});

describe('Cinder Vault difficulty shape (mid-tier Dungeon 3)', () => {
  it('a maxed Vigil crown build clears Cinder Vault with disciplined play, Emberfall landing at least once', () => {
    const run = runBuildBot(CINDER_VAULT, VIGIL_LOADOUT, 'disciplined');
    expect(run.status).toBe('victory');
    expect(run.survivors).toBeGreaterThanOrEqual(3);
    expect(run.partyDoTStarted).toBeGreaterThanOrEqual(1);
  });

  it('the Vigil efficiency crown build also clears Cinder Vault', () => {
    const run = runBuildBot(CINDER_VAULT, VIGIL_EFFICIENCY_LOADOUT, 'disciplined');
    expect(run.status).toBe('victory');
    expect(run.survivors).toBeGreaterThanOrEqual(3);
    expect(run.partyDoTStarted).toBeGreaterThanOrEqual(1);
  });

  it('a maxed Zealot crown build clears Cinder Vault with disciplined play', () => {
    const run = runBuildBot(CINDER_VAULT, ZEALOT_LOADOUT, 'disciplined');
    expect(run.status).toBe('victory');
    expect(run.survivors).toBeGreaterThanOrEqual(3);
    expect(run.partyDoTStarted).toBeGreaterThanOrEqual(1);
  });
});

describe('Verdant Rift difficulty shape (Dungeon 4)', () => {
  it('a maxed Vigil crown build clears Verdant Rift with Needle Gaze landing at least once', () => {
    const run = runBuildBot(VERDANT_RIFT, VIGIL_LOADOUT, 'disciplined');
    expect(run.status).toBe('victory');
    expect(run.survivors).toBeGreaterThanOrEqual(3);
    expect(run.bossFocusStarted).toBeGreaterThanOrEqual(1);
  });

  it('the Vigil efficiency crown build also clears Verdant Rift', () => {
    const run = runBuildBot(VERDANT_RIFT, VIGIL_EFFICIENCY_LOADOUT, 'disciplined');
    expect(run.status).toBe('victory');
    expect(run.survivors).toBeGreaterThanOrEqual(3);
    expect(run.bossFocusStarted).toBeGreaterThanOrEqual(1);
  });

  it('a maxed Zealot crown build clears Verdant Rift with disciplined play', () => {
    const run = runBuildBot(VERDANT_RIFT, ZEALOT_LOADOUT, 'disciplined');
    expect(run.status).toBe('victory');
    expect(run.survivors).toBeGreaterThanOrEqual(3);
    expect(run.bossFocusStarted).toBeGreaterThanOrEqual(1);
  });
});

describe('Black Choir is clearable with crown kits (Dungeon 5, oathbound-depth §D9)', () => {
  it('each of the four oath×aspect crown kits clears Black Choir with ≥3 alive', () => {
    const vigilVirtue = runBuildBot(BLACK_CHOIR, VIGIL_LOADOUT, 'disciplined');
    const vigilVengeance = runBuildBot(BLACK_CHOIR, VIGIL_VENGEANCE_LOADOUT, 'disciplined');
    const zealotVirtue = runBuildBot(BLACK_CHOIR, ZEALOT_LOADOUT, 'disciplined');
    const zealotVengeance = runBuildBot(BLACK_CHOIR, ZEALOT_VENGEANCE_LOADOUT, 'disciplined');

    expect(vigilVirtue.status).toBe('victory');
    expect(vigilVirtue.survivors).toBeGreaterThanOrEqual(3);

    expect(vigilVengeance.status).toBe('victory');
    expect(vigilVengeance.survivors).toBeGreaterThanOrEqual(3);

    expect(zealotVirtue.status).toBe('victory');
    expect(zealotVirtue.survivors).toBeGreaterThanOrEqual(3);

    expect(zealotVengeance.status).toBe('victory');
    expect(zealotVengeance.survivors).toBeGreaterThanOrEqual(3);
  });

  it('Soul Toll burns mana at least once across the crown kit runs', () => {
    const vigilVirtue = runBuildBot(BLACK_CHOIR, VIGIL_LOADOUT, 'disciplined');
    const vigilVengeance = runBuildBot(BLACK_CHOIR, VIGIL_VENGEANCE_LOADOUT, 'disciplined');
    const zealotVirtue = runBuildBot(BLACK_CHOIR, ZEALOT_LOADOUT, 'disciplined');
    const zealotVengeance = runBuildBot(BLACK_CHOIR, ZEALOT_VENGEANCE_LOADOUT, 'disciplined');
    expect(
      vigilVirtue.manaBurns + vigilVengeance.manaBurns + zealotVirtue.manaBurns + zealotVengeance.manaBurns,
    ).toBeGreaterThanOrEqual(1);
  });

  it('wipes oath-path kits that stop before Vowstrike / Wrath / crown — later clears want the tree', () => {
    expect(runBuildBot(BLACK_CHOIR, VIGIL_MID_TREE_LOADOUT, 'disciplined').status).toBe('wipe');
    expect(runBuildBot(BLACK_CHOIR, ZEALOT_MID_TREE_LOADOUT, 'disciplined').status).toBe('wipe');
  });
});

describe('The Maw is an unwinnable sandbox (poc-spec §7, alpha-0.1-handoff §D7 chunk 9a)', () => {
  // The Maw boss (Hollow King, 9999 HP) is intentionally unkillable. The fight
  // either wipes naturally or the 10-minute simulation cap is hit (boss still alive =
  // "never won" = wipe by design). capAsWipe:true treats the cap as a wipe outcome.
  const mawOpts: BotRunOptions = { capAsWipe: true };

  it('wipes even with maxed crown kits and disciplined healing (no relic)', () => {
    expect(runBuildBot(THE_MAW, VIGIL_LOADOUT, 'disciplined', [], mawOpts).status).toBe('wipe');
    expect(runBuildBot(THE_MAW, VIGIL_VENGEANCE_LOADOUT, 'disciplined', [], mawOpts).status).toBe('wipe');
    expect(runBuildBot(THE_MAW, VIGIL_EFFICIENCY_LOADOUT, 'disciplined', [], mawOpts).status).toBe('wipe');
    expect(runBuildBot(THE_MAW, ZEALOT_LOADOUT, 'disciplined', [], mawOpts).status).toBe('wipe');
    expect(runBuildBot(THE_MAW, ZEALOT_VENGEANCE_LOADOUT, 'disciplined', [], mawOpts).status).toBe('wipe');
  });

  it.each(RELICS)('wipes with every maxed crown build even holding the $name relic', (relic) => {
    expect(runBuildBot(THE_MAW, VIGIL_LOADOUT, 'disciplined', [relic], mawOpts).status).toBe('wipe');
    expect(runBuildBot(THE_MAW, VIGIL_VENGEANCE_LOADOUT, 'disciplined', [relic], mawOpts).status).toBe('wipe');
    expect(runBuildBot(THE_MAW, VIGIL_EFFICIENCY_LOADOUT, 'disciplined', [relic], mawOpts).status).toBe('wipe');
    expect(runBuildBot(THE_MAW, ZEALOT_LOADOUT, 'disciplined', [relic], mawOpts).status).toBe('wipe');
    expect(runBuildBot(THE_MAW, ZEALOT_VENGEANCE_LOADOUT, 'disciplined', [relic], mawOpts).status).toBe('wipe');
  });
});
