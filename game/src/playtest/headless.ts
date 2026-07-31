/**
 * Headless CombatEngine driver — no Phaser, no wall clock. Ticks as fast as
 * the CPU allows; players decide each step via pure engine commands.
 */

import { CombatEngine } from '../combat/engine';
import type { CombatEngineOptions, EncounterDef } from '../combat/types';
import type { CombatMods } from '../data/talentTree';
import { createSeededRng } from './rng';
import type { PlaytestPlayer, PlaytestRunOptions, PlaytestRunResult } from './types';

export const PLAYTEST_STEP_MS = 100;
export const PLAYTEST_MAX_MS = 10 * 60 * 1000;
/** Default LCG seed for reproducible sweeps (`HEAL` in ASCII hex). */
export const PLAYTEST_DEFAULT_SEED = 0x4845414c;

/** Mirror of scenes/combatOptions — kept here so playtest never imports scenes/. */
function engineOptionsFromLoadout(lo: CombatMods): CombatEngineOptions {
  return {
    bonusMaxMana: lo.bonusMaxMana,
    ...(lo.bonusMaxHp !== undefined ? { bonusMaxHp: lo.bonusMaxHp } : {}),
    ...(lo.manaRegen !== undefined ? { manaRegen: lo.manaRegen } : {}),
    synergies: lo.synergies,
    ...(lo.manaSynergies !== undefined ? { manaSynergies: lo.manaSynergies } : {}),
    missingHealthBonuses: lo.missingHealthBonuses,
    missingHealthPctBonuses: lo.missingHealthPctBonuses,
    fullHealthBonuses: lo.fullHealthBonuses,
    cooldowns: lo.cooldowns,
    relics: [],
    ...(lo.hastePermille != null ? { hastePermille: lo.hastePermille } : {}),
    ...(lo.critThresholdN != null
      ? { critThresholdN: lo.critThresholdN, critBonusPermille: lo.critBonusPermille }
      : {}),
    ...(lo.blockThresholdN != null ? { blockThresholdN: lo.blockThresholdN } : {}),
  };
}

/** Run one encounter with a rule-based player until victory, wipe, or timeout. */
export function runHeadless(
  encounter: EncounterDef,
  player: PlaytestPlayer,
  options: PlaytestRunOptions,
): PlaytestRunResult {
  const stepMs = options.stepMs ?? PLAYTEST_STEP_MS;
  const maxMs = options.maxMs ?? PLAYTEST_MAX_MS;
  const random = options.random ?? createSeededRng(0x4e41504c); // 'NAPL'
  const bias = options.bias ?? null;
  const engine = new CombatEngine(
    encounter,
    options.loadout.spells,
    engineOptionsFromLoadout(options.loadout),
  );

  let elapsed = 0;
  let healsCast = 0;
  let overhealTotal = 0;

  while (elapsed < maxMs) {
    if (engine.state.status !== 'running') break;

    player.act(engine, { elapsedMs: elapsed, bias, random });

    for (const event of engine.advance(stepMs)) {
      if (event.type === 'heal') {
        healsCast += 1;
        overhealTotal += event.overheal;
      }
    }
    elapsed += stepMs;
  }

  const healer = engine.state.party.find((u) => u.role === 'healer');
  const status = engine.state.status;
  return {
    status: status === 'running' ? 'timeout' : status,
    elapsedMs: elapsed,
    healerManaLeft: healer?.mana ?? 0,
    survivors: engine.state.party.filter((u) => u.alive).length,
    healsCast,
    overhealTotal,
  };
}
