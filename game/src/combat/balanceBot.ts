/**
 * Shared healer-bot harness for balance gates and `npm run content -- balance`.
 * Deterministic, pure CombatEngine — no Phaser / wall clock / Math.random.
 */
import { CombatEngine } from './engine';
import { SPELLS } from '../data/constants';
import { loadoutFromSave, type CombatMods } from '../data/talentTree';
import type { SaveData } from '../save/save';
import type { CombatEngineOptions, EncounterDef, RelicDef, SpellDef, Unit } from './types';

export const BALANCE_STEP_MS = 250;
export const BALANCE_MAX_MS = 10 * 60 * 1000;

export type BotStyle = 'none' | 'naive' | 'disciplined';

export interface BotRun {
  status: 'victory' | 'wipe';
  elapsedMs: number;
  /** partyAoE landings (Bonehowl / Extinction / etc.). */
  bossCastFinished: number;
  bossFocusStarted: number;
  partyDoTStarted: number;
  manaBurns: number;
  healsCast: number;
  survivors: number;
  healerManaLeft: number;
  cdActivations: number;
}

/** Minimal synthetic SaveData for loadoutFromSave. Omits `actionBar` so
 *  loadout keeps every unlocked/tree spell (full kit for balance bots). */
export function makeBalanceSave(overrides: Partial<SaveData>): SaveData {
  return {
    version: 7,
    tutorialDone: true,
    xp: 0,
    unlockedSpells: [],
    actionBar: ['', '', '', ''],
    treeRanks: {},
    subclass: null,
    clearedDungeons: [],
    combatPaceTenths: 10,
    relicIds: [],
    pendingRelicOffers: [],
    ...overrides,
  };
}

export const BASE_KIT: SpellDef[] = [SPELLS.solemnMend];

function spellOffCd(
  spellId: string,
  spellCooldowns: readonly { spellId: string; remainingMs: number }[],
): boolean {
  const cd = spellCooldowns.find((c) => c.spellId === spellId);
  return (cd?.remainingMs ?? 0) <= 0;
}

/** Arm a Vowstrike buff before a non-emergency heal when the trade is worthwhile.
 *  Reckoning is never substituted for a heal — that costs a GCD of throughput. */
function pickVowstrikeBuff(
  virtue: SpellDef | undefined,
  _vengeance: SpellDef | undefined,
  enemiesAlive: boolean,
  healer: Unit,
  spellCooldowns: readonly { spellId: string; remainingMs: number }[],
  healIntent: SpellDef,
  _missing: number,
  emergency: boolean,
): SpellDef | undefined {
  if (emergency || !enemiesAlive) return undefined;
  const canCast = (spell?: SpellDef) =>
    spell !== undefined && spellOffCd(spell.id, spellCooldowns) && healer.mana >= spell.mana;

  // Absolution: spend a GCD to discount the next expensive heal when mana is tight.
  if (canCast(virtue) && healIntent.mana >= 4 && healer.mana < healIntent.mana + 3) return virtue;
  return undefined;
}

/** Spend a free GCD on Vowstrike damage when the party does not need a heal. */
function pickVowstrikeFiller(
  virtue: SpellDef | undefined,
  vengeance: SpellDef | undefined,
  enemiesAlive: boolean,
  healer: Unit,
  spellCooldowns: readonly { spellId: string; remainingMs: number }[],
): SpellDef | undefined {
  if (!enemiesAlive) return undefined;
  const canCast = (spell?: SpellDef) =>
    spell !== undefined && spellOffCd(spell.id, spellCooldowns) && healer.mana >= spell.mana;
  // Prefer Reckoning filler — arms +25% on the next heal while dealing damage.
  if (canCast(vengeance)) return vengeance;
  if (canCast(virtue)) return virtue;
  return undefined;
}

// ---------------------------------------------------------------------------
// Alpha 0.2 crown kits — xp: 910 = xpForLevel(14), so level mana applies.
// Each kit owns one oath × one Vowstrike aspect × shared crown.
// Budget: 15 talent nodes (combat resolve doesn't enforce point budget).
// ---------------------------------------------------------------------------

/** Vigil × Virtue (Patient path + crown). */
export const VIGIL_SAVE: SaveData = makeBalanceSave({
  xp: 910, // xpForLevel(14)
  unlockedSpells: ['solemn-mend', 'zealous-mending'],
  treeRanks: {
    'deep-reserves': 3,
    'vigil-oath': 1,
    'vigil-patient-vow': 3,
    'vigil-graven-scale': 1,
    'vigil-thrift': 1,
    'vigil-still-waters': 1,
    'shared-mend-potency': 1,
    'shared-zealous-potency': 1,
    'vowstrike-virtue': 1,
    'wrath-ascendant': 1,
    'vowbound-crown': 1,
  },
  subclass: 'vigil',
});

/** Vigil × Vengeance (Patient path + crown). */
export const VIGIL_VENGEANCE_SAVE: SaveData = makeBalanceSave({
  xp: 910, // xpForLevel(14)
  unlockedSpells: ['solemn-mend', 'zealous-mending'],
  treeRanks: {
    'deep-reserves': 3,
    'vigil-oath': 1,
    'vigil-patient-vow': 3,
    'vigil-graven-scale': 1,
    'vigil-thrift': 1,
    'vigil-still-waters': 1,
    'shared-mend-potency': 1,
    'shared-zealous-potency': 1,
    'vowstrike-vengeance': 1,
    'wrath-ascendant': 1,
    'vowbound-crown': 1,
  },
  subclass: 'vigil',
});

/**
 * Vigil efficiency mid-clear kit (Measured Devotion path + crown).
 * Skips Patient Vow / Graven Scale; still clears all pre-Maw content.
 */
export const VIGIL_EFFICIENCY_SAVE: SaveData = makeBalanceSave({
  xp: 910, // xpForLevel(14)
  unlockedSpells: ['solemn-mend', 'zealous-mending'],
  treeRanks: {
    'deep-reserves': 3,
    'vigil-oath': 1,
    'vigil-measured-devotion': 1,
    'vigil-thrift': 1,
    'vigil-still-waters': 1,
    'shared-mend-potency': 1,
    'shared-zealous-potency': 1,
    'vowstrike-virtue': 1,
    'wrath-ascendant': 1,
    'vowbound-crown': 1,
  },
  subclass: 'vigil',
});

/** Zealot × Virtue (Fervent Chain path + crown). */
export const ZEALOT_SAVE: SaveData = makeBalanceSave({
  xp: 910, // xpForLevel(14)
  unlockedSpells: ['solemn-mend', 'zealous-mending'],
  treeRanks: {
    'deep-reserves': 3,
    'zealot-oath': 1,
    'zealot-fervent-chain': 3,
    'zealot-steady-hands': 1,
    'zealot-quick-breath': 1,
    'zealot-frenzied-liturgy': 1,
    'shared-mend-potency': 1,
    'shared-zealous-potency': 1,
    'vowstrike-virtue': 1,
    'wrath-ascendant': 1,
    'vowbound-crown': 1,
  },
  subclass: 'zealot',
});

/** Zealot × Vengeance (Fervent Chain path + crown). */
export const ZEALOT_VENGEANCE_SAVE: SaveData = makeBalanceSave({
  xp: 910, // xpForLevel(14)
  unlockedSpells: ['solemn-mend', 'zealous-mending'],
  treeRanks: {
    'deep-reserves': 3,
    'zealot-oath': 1,
    'zealot-fervent-chain': 3,
    'zealot-steady-hands': 1,
    'zealot-quick-breath': 1,
    'zealot-frenzied-liturgy': 1,
    'shared-mend-potency': 1,
    'shared-zealous-potency': 1,
    'vowstrike-vengeance': 1,
    'wrath-ascendant': 1,
    'vowbound-crown': 1,
  },
  subclass: 'zealot',
});

export const VIGIL_LOADOUT: CombatMods = loadoutFromSave(VIGIL_SAVE);
export const VIGIL_VENGEANCE_LOADOUT: CombatMods = loadoutFromSave(VIGIL_VENGEANCE_SAVE);
export const VIGIL_EFFICIENCY_LOADOUT: CombatMods = loadoutFromSave(VIGIL_EFFICIENCY_SAVE);
export const ZEALOT_LOADOUT: CombatMods = loadoutFromSave(ZEALOT_SAVE);
export const ZEALOT_VENGEANCE_LOADOUT: CombatMods = loadoutFromSave(ZEALOT_VENGEANCE_SAVE);

/**
 * All maxed builds for `npm run content -- balance`.
 * Includes all four oath × vowstrike-aspect crown kits plus the efficiency variant.
 */
export const MAXED_BUILD_LOADOUTS = [
  { id: 'vigil-virtue', name: 'Vigil × Virtue (Patient Crown)', loadout: VIGIL_LOADOUT },
  { id: 'vigil-vengeance', name: 'Vigil × Vengeance (Patient Crown)', loadout: VIGIL_VENGEANCE_LOADOUT },
  { id: 'vigil-efficiency', name: 'Vigil (Measured Crown)', loadout: VIGIL_EFFICIENCY_LOADOUT },
  { id: 'zealot-virtue', name: 'Zealot × Virtue (Crown)', loadout: ZEALOT_LOADOUT },
  { id: 'zealot-vengeance', name: 'Zealot × Vengeance (Crown)', loadout: ZEALOT_VENGEANCE_LOADOUT },
] as const;

/**
 * Options controlling bot run behaviour beyond the simulation inputs.
 * `capAsWipe`: if the fight exceeds `BALANCE_MAX_MS` without resolving,
 *   return a synthetic wipe instead of throwing. Use for The Maw where the
 *   boss is intentionally unkillable — the cap signals "never won" not a bug.
 */
export interface BotRunOptions {
  capAsWipe?: boolean;
}

/**
 * Healer bots:
 * - 'none': never casts.
 * - 'naive': tank-spam Solemn Mend, overheal freely.
 * - 'disciplined': full-value heals, triage emergencies, cooldown policy.
 */
export function runBot(
  encounter: EncounterDef,
  spells: SpellDef[],
  options: CombatEngineOptions,
  style: BotStyle,
  { capAsWipe = false }: BotRunOptions = {},
): BotRun {
  const engine = new CombatEngine(encounter, spells, options);
  const solemnMend = spells.find((s) => s.id === SPELLS.solemnMend.id);
  const zealousMending = spells.find((s) => s.id === SPELLS.zealousMending.id);
  const solemnVigil = spells.find((s) => s.id === SPELLS.solemnVigil.id);
  const zealousFlare = spells.find((s) => s.id === SPELLS.zealousFlare.id);
  const vowstrikeVirtue = spells.find((s) => s.id === SPELLS.vowstrikeVirtue.id);
  const vowstrikeVengeance = spells.find((s) => s.id === SPELLS.vowstrikeVengeance.id);
  const cooldownDefs = options.cooldowns ?? [];
  let elapsed = 0;
  let bossCastFinished = 0;
  let bossFocusStarted = 0;
  let partyDoTStarted = 0;
  let manaBurns = 0;
  let healsCast = 0;
  let cdActivations = 0;
  let focusTargetId: string | null = null;

  while (elapsed < BALANCE_MAX_MS) {
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
      const enemiesAlive = state.enemies.some((e) => e.alive);

      if (target) {
        const missing = target.maxHp - target.hp;
        const emergency = target === tankCriticalUnit || target === focusUnit;

        // Determine the intended next heal (used for CD activation decisions).
        // Must mirror the heal priority in the `if (free)` block below.
        let intendedHeal: SpellDef | undefined;
        if (emergency) {
          if (zealousFlare) intendedHeal = zealousFlare;
          else if (zealousMending) intendedHeal = zealousMending;
          else if (solemnMend) intendedHeal = solemnMend;
        } else if (solemnVigil && missing >= solemnVigil.heal) {
          intendedHeal = solemnVigil;
        } else if (solemnMend && missing >= solemnMend.heal) {
          intendedHeal = solemnMend;
        } else if (zealousMending && missing >= zealousMending.heal) {
          intendedHeal = zealousMending;
        } else if (zealousFlare && missing >= zealousFlare.heal) {
          intendedHeal = zealousFlare;
        }

        // Spike pressure signal for healBonus (Wrath Ascendant) activation.
        const underPressure =
          tankCriticalUnit !== undefined ||
          focusUnit !== undefined ||
          (tank && tank.alive && tank.hp * 5 <= tank.maxHp * 4) || // tank ≤80% HP
          bossCastFinished > 0 ||
          partyDoTStarted > 0 ||
          manaBurns > 0;

        for (const def of cooldownDefs) {
          const cdState = state.cooldowns.find((c) => c.id === def.id);
          if (!cdState || cdState.remainingCooldownMs > 0) continue;
          if (def.effect.kind === 'manaCostReduction') {
            engine.activateCooldown(def.id);
            cdActivations += 1;
          } else if (def.effect.kind === 'freeNextHeal' && intendedHeal) {
            engine.activateCooldown(def.id);
            cdActivations += 1;
          } else if (def.effect.kind === 'healBonus' && underPressure) {
            // Wrath Ascendant: activate during spike pressure windows.
            engine.activateCooldown(def.id);
            cdActivations += 1;
          }
        }

        const armedFreeHeal = engine.state.cooldowns.some(
          (c) =>
            c.activeRemainingMs > 0 &&
            cooldownDefs.find((d) => d.id === c.id)?.effect.kind === 'freeNextHeal',
        );

        if (free) {
          let healIntent: SpellDef | undefined;
          if (emergency) {
            if (zealousFlare && (healer.mana >= zealousFlare.mana || armedFreeHeal)) healIntent = zealousFlare;
            else if (zealousMending && (healer.mana >= zealousMending.mana || armedFreeHeal))
              healIntent = zealousMending;
            else if (solemnMend && (healer.mana >= solemnMend.mana || armedFreeHeal)) healIntent = solemnMend;
          } else if (solemnVigil && missing >= solemnVigil.heal && (healer.mana >= solemnVigil.mana || armedFreeHeal)) {
            healIntent = solemnVigil;
          } else if (solemnMend && missing >= solemnMend.heal && (healer.mana >= solemnMend.mana || armedFreeHeal)) {
            healIntent = solemnMend;
          } else if (
            zealousMending &&
            missing >= zealousMending.heal &&
            (healer.mana >= zealousMending.mana || armedFreeHeal)
          ) {
            healIntent = zealousMending;
          } else if (zealousFlare && missing >= zealousFlare.heal && (healer.mana >= zealousFlare.mana || armedFreeHeal)) {
            healIntent = zealousFlare;
          }

          let spell: SpellDef | undefined;
          if (healIntent) {
            spell =
              pickVowstrikeBuff(
                vowstrikeVirtue,
                vowstrikeVengeance,
                enemiesAlive,
                healer,
                state.spellCooldowns,
                healIntent,
                missing,
                emergency,
              ) ?? healIntent;
          } else {
            spell = pickVowstrikeFiller(
              vowstrikeVirtue,
              vowstrikeVengeance,
              enemiesAlive,
              healer,
              state.spellCooldowns,
            );
          }

          if (spell) {
            if ((spell.damage ?? 0) === 0) engine.setTarget(target.id);
            engine.castSpell(spell.id);
            if ((spell.damage ?? 0) === 0) healsCast += 1;
          }
        }
      } else if (free && enemiesAlive) {
        const vowstrike = pickVowstrikeFiller(
          vowstrikeVirtue,
          vowstrikeVengeance,
          enemiesAlive,
          healer,
          state.spellCooldowns,
        );
        if (vowstrike) engine.castSpell(vowstrike.id);
      }
    }

    for (const event of engine.advance(BALANCE_STEP_MS)) {
      if (event.type === 'bossCastFinished') bossCastFinished += 1;
      if (event.type === 'bossFocusStarted') {
        bossFocusStarted += 1;
        focusTargetId = event.targetId;
      }
      if (event.type === 'bossFocusEnded') focusTargetId = null;
      if (event.type === 'partyDoTStarted') partyDoTStarted += 1;
      if (event.type === 'manaBurned') manaBurns += 1;
    }
    elapsed += BALANCE_STEP_MS;
  }

  const status = engine.state.status;
  if (status === 'running') {
    if (capAsWipe) {
      // Boss unkillable by design (e.g. The Maw) — treat cap as a wipe.
      const healer = engine.state.party.find((u) => u.role === 'healer');
      return {
        status: 'wipe',
        elapsedMs: elapsed,
        bossCastFinished,
        bossFocusStarted,
        partyDoTStarted,
        manaBurns,
        healsCast,
        survivors: engine.state.party.filter((u) => u.alive).length,
        healerManaLeft: healer?.mana ?? 0,
        cdActivations,
      };
    }
    throw new Error('balance bot hit the 10-minute cap');
  }
  const healer = engine.state.party.find((u) => u.role === 'healer');
  return {
    status,
    elapsedMs: elapsed,
    bossCastFinished,
    bossFocusStarted,
    partyDoTStarted,
    manaBurns,
    healsCast,
    survivors: engine.state.party.filter((u) => u.alive).length,
    healerManaLeft: healer?.mana ?? 0,
    cdActivations,
  };
}

export function runBuildBot(
  encounter: EncounterDef,
  loadout: CombatMods,
  style: BotStyle,
  relics: RelicDef[] = [],
  botOptions: BotRunOptions = {},
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
      ...(loadout.manaRegen !== undefined ? { manaRegen: loadout.manaRegen } : {}),
      relics,
    },
    style,
    botOptions,
  );
}

export function formatBotRunLine(label: string, run: BotRun): string {
  return (
    `${label}: ${run.status}` +
    ` | survivors ${run.survivors}` +
    ` | mana ${run.healerManaLeft}` +
    ` | heals ${run.healsCast}` +
    ` | ${(run.elapsedMs / 1000).toFixed(1)}s` +
    ` | castDone ${run.bossCastFinished}` +
    ` | focus ${run.bossFocusStarted}` +
    ` | DoT ${run.partyDoTStarted}` +
    ` | manaBurn ${run.manaBurns}`
  );
}

/** Run every maxed build (disciplined) against one encounter; return printable lines. */
export function formatMaxedBalanceReport(encounter: EncounterDef): string {
  const lines = [`${encounter.name} [${encounter.id}] — maxed kits, disciplined bot`];
  for (const build of MAXED_BUILD_LOADOUTS) {
    const run = runBuildBot(encounter, build.loadout, 'disciplined', [], { capAsWipe: true });
    lines.push(`  ${formatBotRunLine(build.name, run)}`);
  }
  return lines.join('\n');
}
