import { describe, expect, it } from 'vitest';
import { CombatEngine } from './engine';
import { ASH_GATE, IRON_PASS, THE_MAW } from '../data/encounters';
import { SPELLS } from '../data/constants';
import { loadoutFromSave, type CombatMods } from '../data/spellTree';
import { RELICS } from '../data/relics';
import type { SaveData } from '../save/save';
import type { CombatEngineOptions, EncounterDef, RelicDef, SpellDef, Unit } from './types';

/**
 * Balance gates for poc-spec §4.1 ("threat is mana, not raw HPS") and §7
 * ("Dungeon 2 cannot be cleared"), extended by alpha-0.1-handoff §Balance gate
 * amendments for Iron Pass (Dungeon 2) + relics:
 *
 *   1. Ash Gate with no healing at all → wipe (a healer must matter).
 *   2. Ash Gate, NAIVE healing (spam Solemn on the tank, overheal freely) on
 *      the starting kit → wipe. This is the spec's "expected first run":
 *      wasted mana loses the run, not raw HPS.
 *   3. Ash Gate, disciplined zero-overheal healing on the starting kit → no
 *      comfortable clear: either a wipe, or a pyrrhic win (healer fully OOM,
 *      at most 2 party members standing). Perfect play may scrape through;
 *      it must never cruise.
 *   4. Ash Gate, disciplined healing, BOTH maxed subclass builds (Vigil and
 *      Zealot — phase-2-handoff) → victory with at least 3 party members
 *      alive (the journey's step 6 must be reachable and progression felt,
 *      regardless of which subclass the player picked).
 *   5. Bonehowl actually lands at least once in a winning run (the 10s
 *      telegraph is part of the PoC experience) — checked on either build.
 *   6. Maxed Vigil save vs Iron Pass, disciplined healing → victory, >=3
 *      party alive, Tunnel Vision fires >=1 (alpha-0.1-handoff §Balance gate
 *      amendments gate 5).
 *   7. Maxed Zealot save vs Iron Pass, disciplined healing → victory, >=3
 *      party alive (gate 6).
 *   8. Maxed either build + any relic vs The Maw → wipe (sandbox; gate 7).
 */

const STEP_MS = 250;
const MAX_MS = 10 * 60 * 1000;

const BASE_KIT: SpellDef[] = [SPELLS.solemnMend];

/** Minimal synthetic SaveData for loadoutFromSave — only the fields the two maxed builds below need. */
function makeSave(overrides: Partial<SaveData>): SaveData {
  return {
    version: 4,
    tutorialDone: true,
    gold: 0,
    xp: 0,
    rubies: 0,
    unlockedSpells: [],
    treeRanks: {},
    subclass: null,
    clearedDungeons: [],
    combatPaceTenths: 10,
    relicId: null,
    relicPickPending: false,
    ...overrides,
  };
}

/**
 * Maxed Vigil build (phase-2-handoff Chunk 1 brief, extended alpha-0.1-handoff
 * §D5 chunk 9a): Deep Reserves x5, Vigil oath + Patient Vow x3 (Mend->Vigil
 * synergy) + Measured Devotion (Solemn Vigil slower/cheaper), plus ALL Vigil
 * tree layer-2 nodes — Deep Well (+4 max mana), Thrift (Solemn Mend -1 mana),
 * Still Waters (grants the CD).
 */
const VIGIL_SAVE: SaveData = makeSave({
  unlockedSpells: ['solemn-mend', 'zealous-mending'],
  treeRanks: {
    'deep-reserves': 5,
    'vigil-oath': 1,
    'vigil-patient-vow': 3,
    'vigil-measured-devotion': 1,
    'vigil-deep-well': 1,
    'vigil-thrift': 1,
    'vigil-still-waters': 1,
  },
  subclass: 'vigil',
});

/**
 * Maxed Zealot build: Deep Reserves x5, Zealot oath + Fervent Chain x3
 * (Mending->Flare synergy) + Steady Hands (Alpha 0.1 §D4: Zealous Mending's
 * full-health bonus, replacing retired Desperate Zeal), plus ALL Zealot tree
 * layer-2 nodes (§D5 chunk 9a) — Quick Breath (Zealous Flare -200ms cast),
 * Spendthrift Grace (+3 max mana), Frenzied Liturgy (grants the CD).
 */
const ZEALOT_SAVE: SaveData = makeSave({
  unlockedSpells: ['solemn-mend', 'zealous-mending'],
  treeRanks: {
    'deep-reserves': 5,
    'zealot-oath': 1,
    'zealot-fervent-chain': 3,
    'zealot-steady-hands': 1,
    'zealot-quick-breath': 1,
    'zealot-spendthrift-grace': 1,
    'zealot-frenzied-liturgy': 1,
  },
  subclass: 'zealot',
});

const VIGIL_LOADOUT: CombatMods = loadoutFromSave(VIGIL_SAVE);
const ZEALOT_LOADOUT: CombatMods = loadoutFromSave(ZEALOT_SAVE);

interface BotRun {
  status: 'victory' | 'wipe';
  elapsedMs: number;
  bonehowlLandings: number;
  /** Alpha 0.1 §D3 chunk 9a: Tunnel Vision telegraph->channel activations (Iron Pass only). */
  bossFocusStarted: number;
  healsCast: number;
  survivors: number;
  healerManaLeft: number;
  /** Alpha 0.1 §D6 chunk 9a: cooldown activations issued by the bot's CD policy. */
  cdActivations: number;
}

type BotStyle = 'none' | 'naive' | 'disciplined';

/**
 * Healer bots:
 * - 'none': never casts (control run — proves the healer matters).
 * - 'naive': the expected first-timer — targets the tank and spams Solemn
 *   Mend whenever it can, overhealing freely. Mana discipline is the fight's
 *   real threat, so this should lose.
 * - 'disciplined': ceiling play — only casts when free (never queues blind),
 *   heals the most-injured living ally, and only for full-value heals (zero
 *   overheal) outside emergencies. Two emergencies permit overheal, using the
 *   fastest available cast (Zealous Flare, else Zealous Mending, else Solemn
 *   Mend): a tank at <=6 hp (tank death cascades — mercs and the healer both
 *   lean on the tank soaking hits), and (alpha-0.1-handoff §D3, chunk 9a) a
 *   live Tunnel Vision focus target once it's dropped to <=50% hp — the
 *   marker a disciplined player reacts to, gated so the bot doesn't blow mana
 *   overhealing a target still near full between channel ticks. A critical
 *   tank outranks a critical focus target (losing the tank threatens the
 *   whole party), which outranks the plain lowest-hp%-ratio pick used the
 *   rest of the time. Outside emergencies it prefers Solemn Vigil (Vigil) at
 *   full value — the efficient big heal, arming/consuming the Mend<->Vigil
 *   synergy cadence — then falls back to Solemn Mend (which also arms both
 *   subclasses' synergies) and finally Zealous Mending. Solemn Vigil's slow
 *   cast is never used as the emergency button — far too slow.
 *
 * Cooldown policy (alpha-0.1-handoff §D6, chunk 9a): simple and rule-based,
 * driven off the build's granted `CooldownDef`s (not hardcoded ids) so it
 * generalizes to whichever cooldown a loadout owns:
 * - `manaCostReduction` (Frenzied Liturgy): activate whenever ready — a pure
 *   tempo window with no downside to popping early.
 * - `freeNextHeal` (Still Waters): activate only when ready AND the healer's
 *   mana is already short of the heal they'd otherwise cast next (the OOM
 *   panic button) — computed from the same target/emergency logic as the
 *   cast decision, just ignoring affordability so the "intended" spell is
 *   known before mana is checked.
 */
function runBot(
  encounter: EncounterDef,
  spells: SpellDef[],
  options: CombatEngineOptions,
  style: BotStyle,
): BotRun {
  const engine = new CombatEngine(encounter, spells, options);
  const solemnMend = spells.find((s) => s.id === SPELLS.solemnMend.id);
  const zealousMending = spells.find((s) => s.id === SPELLS.zealousMending.id);
  const solemnVigil = spells.find((s) => s.id === SPELLS.solemnVigil.id);
  const zealousFlare = spells.find((s) => s.id === SPELLS.zealousFlare.id);
  const cooldownDefs = options.cooldowns ?? [];
  let elapsed = 0;
  let bonehowlLandings = 0;
  let bossFocusStarted = 0;
  let healsCast = 0;
  let cdActivations = 0;
  let focusTargetId: string | null = null;

  while (elapsed < MAX_MS) {
    const state = engine.state;
    if (state.status !== 'running') break;

    const healer = state.party.find((u) => u.role === 'healer');
    const free = state.playerCast === null && state.gcdRemainingMs === 0;

    if (style === 'naive' && healer && free && solemnMend) {
      const tank = state.party.find((u) => u.role === 'tank');
      const anyAlly = state.party.find((u) => u.alive);
      const target = tank?.alive ? tank : anyAlly;
      if (target && healer.mana >= solemnMend.mana) {
        engine.setTarget(target.id);
        engine.castSpell(solemnMend.id);
        healsCast += 1;
      }
    }

    if (style === 'disciplined' && healer) {
      const injured = state.party
        .filter((u) => u.alive && u.maxHp - u.hp > 0)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
      const tank = state.party.find((u) => u.role === 'tank');
      const tankCriticalUnit = tank && tank.alive && tank.hp <= 6 ? tank : undefined;
      const focusUnit =
        focusTargetId != null
          ? state.party.find((u) => u.id === focusTargetId && u.alive && u.hp * 2 <= u.maxHp)
          : undefined;
      const target: Unit | undefined = tankCriticalUnit ?? focusUnit ?? injured[0];

      if (target) {
        const missing = target.maxHp - target.hp;
        const emergency = target === tankCriticalUnit || target === focusUnit;

        let intended: SpellDef | undefined;
        if (emergency) {
          if (zealousFlare) intended = zealousFlare;
          else if (zealousMending) intended = zealousMending;
          else if (solemnMend) intended = solemnMend;
        } else if (solemnVigil && missing >= solemnVigil.heal) {
          intended = solemnVigil;
        } else if (solemnMend && missing >= solemnMend.heal) {
          intended = solemnMend;
        } else if (zealousMending && missing >= zealousMending.heal) {
          intended = zealousMending;
        }

        // Cooldown policy — see function doc comment.
        for (const def of cooldownDefs) {
          const cdState = state.cooldowns.find((c) => c.id === def.id);
          if (!cdState || cdState.remainingCooldownMs > 0) continue;
          if (def.effect.kind === 'manaCostReduction') {
            engine.activateCooldown(def.id);
            cdActivations += 1;
          } else if (def.effect.kind === 'freeNextHeal' && intended && healer.mana < intended.mana) {
            engine.activateCooldown(def.id);
            cdActivations += 1;
          }
        }

        // Re-read fresh — activateCooldown mutates the engine immediately (event follows on
        // the next advance()), so a charge armed above is visible to this same tick's cast.
        const armedFreeHeal = engine.state.cooldowns.some(
          (c) => c.activeRemainingMs > 0 && cooldownDefs.find((d) => d.id === c.id)?.effect.kind === 'freeNextHeal',
        );

        if (free) {
          let spell: SpellDef | undefined;
          if (emergency) {
            if (zealousFlare && (healer.mana >= zealousFlare.mana || armedFreeHeal)) spell = zealousFlare;
            else if (zealousMending && (healer.mana >= zealousMending.mana || armedFreeHeal)) spell = zealousMending;
            else if (solemnMend && (healer.mana >= solemnMend.mana || armedFreeHeal)) spell = solemnMend;
          } else if (
            solemnVigil &&
            missing >= solemnVigil.heal &&
            (healer.mana >= solemnVigil.mana || armedFreeHeal)
          ) {
            spell = solemnVigil;
          } else if (
            solemnMend &&
            missing >= solemnMend.heal &&
            (healer.mana >= solemnMend.mana || armedFreeHeal)
          ) {
            spell = solemnMend;
          } else if (
            zealousMending &&
            missing >= zealousMending.heal &&
            (healer.mana >= zealousMending.mana || armedFreeHeal)
          ) {
            spell = zealousMending;
          }

          if (spell) {
            engine.setTarget(target.id);
            engine.castSpell(spell.id);
            healsCast += 1;
          }
        }
      }
    }

    for (const event of engine.advance(STEP_MS)) {
      if (event.type === 'bossCastFinished') bonehowlLandings += 1;
      if (event.type === 'bossFocusStarted') {
        bossFocusStarted += 1;
        focusTargetId = event.targetId;
      }
      if (event.type === 'bossFocusEnded') focusTargetId = null;
    }
    elapsed += STEP_MS;
  }

  const status = engine.state.status;
  if (status === 'running') throw new Error('balance bot hit the 10-minute cap');
  const healer = engine.state.party.find((u) => u.role === 'healer');
  return {
    status,
    elapsedMs: elapsed,
    bonehowlLandings,
    bossFocusStarted,
    healsCast,
    survivors: engine.state.party.filter((u) => u.alive).length,
    healerManaLeft: healer?.mana ?? 0,
    cdActivations,
  };
}

function runBuildBot(
  encounter: EncounterDef,
  loadout: CombatMods,
  style: BotStyle,
  relic?: RelicDef,
): BotRun {
  return runBot(
    encounter,
    loadout.spells,
    {
      bonusMaxMana: loadout.bonusMaxMana,
      synergies: loadout.synergies,
      missingHealthBonuses: loadout.missingHealthBonuses,
      missingHealthPctBonuses: loadout.missingHealthPctBonuses,
      fullHealthBonuses: loadout.fullHealthBonuses,
      cooldowns: loadout.cooldowns,
      relic,
    },
    style,
  );
}

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

    const zealotRun = runBuildBot(ASH_GATE, ZEALOT_LOADOUT, 'disciplined');
    expect(zealotRun.status).toBe('victory');
    expect(zealotRun.healsCast).toBeGreaterThan(0);
    expect(zealotRun.survivors).toBeGreaterThanOrEqual(3);
  });

  it('the Bonehowl telegraph lands at least once in a winning run (either subclass build)', () => {
    const vigilRun = runBuildBot(ASH_GATE, VIGIL_LOADOUT, 'disciplined');
    const zealotRun = runBuildBot(ASH_GATE, ZEALOT_LOADOUT, 'disciplined');
    expect(vigilRun.bonehowlLandings >= 1 || zealotRun.bonehowlLandings >= 1).toBe(true);
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

  it('a maxed Zealot build clears Iron Pass with disciplined play', () => {
    const run = runBuildBot(IRON_PASS, ZEALOT_LOADOUT, 'disciplined');
    expect(run.status).toBe('victory');
    expect(run.survivors).toBeGreaterThanOrEqual(3);
    expect(run.cdActivations).toBeGreaterThanOrEqual(1);
  });
});

describe('The Maw is an unwinnable sandbox (poc-spec §7, alpha-0.1-handoff §D7 chunk 9a)', () => {
  it('wipes even with either maxed subclass build and disciplined healing (no relic)', () => {
    expect(runBuildBot(THE_MAW, VIGIL_LOADOUT, 'disciplined').status).toBe('wipe');
    expect(runBuildBot(THE_MAW, ZEALOT_LOADOUT, 'disciplined').status).toBe('wipe');
  });

  it.each(RELICS)('wipes with either maxed build even holding the $name relic', (relic) => {
    expect(runBuildBot(THE_MAW, VIGIL_LOADOUT, 'disciplined', relic).status).toBe('wipe');
    expect(runBuildBot(THE_MAW, ZEALOT_LOADOUT, 'disciplined', relic).status).toBe('wipe');
  });
});
