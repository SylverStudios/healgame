/**
 * Cards-mode Ash Gate balance smoke — lightweight bot that knows heal/mend/
 * bonk/vowstrike ids (lattice balanceBot is Solemn Mend–centric).
 *
 * Gates (PoC bar, not replacing lattice crown gates):
 *   - starter Heal+Bonk disciplined → not a comfortable clear
 *   - level-8 kit with teaching chips (Arming Mend + Mend Link + Battle Link)
 *     + CDs → can clear Ash Gate
 */

import { describe, expect, it } from 'vitest';
import { CombatEngine } from '../../combat/engine';
import { BALANCE_MAX_MS, BALANCE_STEP_MS } from '../../combat/balanceBot';
import { ASH_GATE } from '../encounters';
import { xpForLevel } from '../constants';
import { newSaveData } from '../../save/save';
import { applyCardsLevelUps, loadoutFromCardSave } from './resolve';
import type { CombatMods } from '../talentTree';
import type { SpellDef } from '../../combat/types';

function cardsSaveAtLevel(level: number, chips: Record<string, string[]> = {}) {
  const save = newSaveData('cards');
  save.xp = xpForLevel(level);
  applyCardsLevelUps(save, 1, level);
  save.spellChips = chips;
  // Level-ups already banked points; smoke doesn't spend them via purchase.
  return save;
}

function pickHeal(spells: SpellDef[], preferQuick: boolean): SpellDef | undefined {
  const heal = spells.find((s) => s.id === 'heal');
  const mend = spells.find((s) => s.id === 'mend');
  if (preferQuick) return mend ?? heal;
  return heal ?? mend;
}

function runCardsAshGate(loadout: CombatMods): {
  status: string;
  survivors: number;
  healsCast: number;
  healerManaLeft: number;
} {
  const engine = new CombatEngine(ASH_GATE, loadout.spells, {
    bonusMaxMana: loadout.bonusMaxMana,
    synergies: loadout.synergies,
    ...(loadout.manaSynergies !== undefined ? { manaSynergies: loadout.manaSynergies } : {}),
    missingHealthBonuses: loadout.missingHealthBonuses,
    missingHealthPctBonuses: loadout.missingHealthPctBonuses,
    fullHealthBonuses: loadout.fullHealthBonuses,
    cooldowns: loadout.cooldowns,
    ...(loadout.manaRegen !== undefined ? { manaRegen: loadout.manaRegen } : {}),
  });

  let elapsed = 0;
  let healsCast = 0;
  const bonk = loadout.spells.find((s) => s.id === 'bonk');
  const vow = loadout.spells.find((s) => s.id === 'vowstrike');

  while (elapsed < BALANCE_MAX_MS) {
    const state = engine.state;
    if (state.status !== 'running') break;

    const healer = state.party.find((u) => u.role === 'healer');
    const free = state.playerCast === null && state.gcdRemainingMs === 0;

    if (healer && free) {
      const injured = state.party
        .filter((u) => u.alive && u.hp < u.maxHp)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
      const target = injured[0];

      // Simple CD policy: Still Waters on OOM-ish, Wrath when tank low, Liturgy when mana tight.
      for (const def of loadout.cooldowns) {
        const cdState = state.cooldowns.find((c) => c.id === def.id);
        if (!cdState || cdState.remainingCooldownMs > 0) continue;
        if (def.effect.kind === 'freeNextHeal' && healer.mana <= 2) {
          engine.activateCooldown(def.id);
        } else if (def.effect.kind === 'healBonus') {
          const tank = state.party.find((u) => u.role === 'tank');
          if (tank && tank.alive && tank.hp * 2 <= tank.maxHp) engine.activateCooldown(def.id);
        } else if (def.effect.kind === 'manaCostReduction' && healer.mana * 5 <= healer.maxMana * 2) {
          engine.activateCooldown(def.id);
        }
      }

      const armedFree = state.cooldowns.some(
        (c) =>
          c.activeRemainingMs > 0 &&
          loadout.cooldowns.find((d) => d.id === c.id)?.effect.kind === 'freeNextHeal',
      );

      if (target) {
        const missing = target.maxHp - target.hp;
        const emergency =
          target.hp * 2 <= target.maxHp || (target.role === 'tank' && target.hp <= 6);
        const spell = pickHeal(loadout.spells, emergency || missing <= 2);
        if (spell && (healer.mana >= spell.mana || armedFree)) {
          engine.setTarget(target.id);
          engine.castSpell(spell.id);
          healsCast += 1;
        }
      } else {
        const strike =
          (vow && healer.mana >= vow.mana ? vow : undefined) ??
          (bonk && healer.mana >= bonk.mana ? bonk : undefined);
        if (strike) {
          const enemy = state.enemies.find((e) => e.alive);
          if (enemy) {
            engine.setTarget(enemy.id);
            engine.castSpell(strike.id);
          }
        }
      }
    }

    engine.advance(BALANCE_STEP_MS);
    elapsed += BALANCE_STEP_MS;
  }

  const healer = engine.state.party.find((u) => u.role === 'healer');
  return {
    status: engine.state.status === 'running' ? 'wipe' : engine.state.status,
    survivors: engine.state.party.filter((u) => u.alive).length,
    healsCast,
    healerManaLeft: healer?.mana ?? 0,
  };
}

describe('cards Ash Gate balance smoke', () => {
  it('starter Heal+Bonk does not comfortably clear Ash Gate', () => {
    const save = cardsSaveAtLevel(1);
    const mods = loadoutFromCardSave(save);
    const run = runCardsAshGate(mods);
    // Wipe or pyrrhic scrape — not a cruise with ≥3 alive and mana left.
    if (run.status === 'victory') {
      expect(run.survivors).toBeLessThanOrEqual(2);
    } else {
      expect(run.status).toBe('wipe');
    }
    expect(run.healsCast).toBeGreaterThan(0);
  });

  it('level-8 teaching chips + CDs can clear Ash Gate', () => {
    const save = cardsSaveAtLevel(8, {
      heal: ['heal-mend-link'],
      mend: ['mend-arming'],
      bonk: ['bonk-battle'],
    });
    const mods = loadoutFromCardSave(save);
    expect(mods.spells.some((s) => s.id === 'mend')).toBe(true);
    expect(mods.spells.some((s) => s.id === 'vowstrike')).toBe(true);
    expect(mods.cooldowns.map((c) => c.id).sort()).toEqual([
      'frenzied-liturgy',
      'still-waters',
      'wrath-ascendant',
    ]);
    expect(mods.synergies.length).toBeGreaterThan(0);

    const run = runCardsAshGate(mods);
    expect(run.status).toBe('victory');
    expect(run.survivors).toBeGreaterThanOrEqual(2);
    expect(run.healsCast).toBeGreaterThan(0);
  });
});
