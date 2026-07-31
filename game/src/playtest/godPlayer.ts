/**
 * God-gamer playtest bot — never wastes a GCD (queues the next cast), fills
 * with Bonk when the party is topped, never overheals, picks efficient heals
 * unless the target is below the emergency HP threshold (then max HPS).
 *
 * Combo-aware: scores heals with armed / soon-to-arm synergy bonuses, mana
 * discounts, potency stacks, and missing-HP rules. Prefers Mend to arm a
 * mend→heal link before spending the buffed Heal when the setup is worth it.
 */

import type { CombatEngine } from '../combat/engine';
import type { CombatState, SpellDef, Unit } from '../combat/types';
import type { CombatMods } from '../data/talentTree';
import {
  canArmBuff,
  effectiveHealAmount,
  effectiveHealPerMana,
  effectiveHealPerSecond,
  effectiveManaCost,
  willBuffSpell,
} from './effective';
import {
  canAfford,
  isDamageFiller,
  isEmergency,
  isHealSpell,
  missingHp,
  pickHealTarget,
  spellOffCd,
} from './heals';
import type { PlaytestContext, PlaytestPlayer, SpellBias } from './types';

export function createGodPlayer(loadout: CombatMods): PlaytestPlayer {
  const spells = loadout.spells;
  const heals = spells.filter(isHealSpell);
  const mend = spells.find((s) => s.id === 'mend');
  const fillers = spells.filter(isDamageFiller);
  const bonk =
    fillers.find((s) => s.id === 'bonk') ??
    fillers.find((s) => s.mana === 0) ??
    fillers[0];
  const vowstrike = fillers.find((s) => s.id === 'vowstrike');

  return {
    act(engine: CombatEngine, ctx: PlaytestContext): void {
      const state = engine.state;
      if (state.status !== 'running') return;

      const healer = state.party.find((u) => u.role === 'healer');
      if (!healer) return;

      const target = pickHealTarget(state.party);
      const free = state.playerCast === null && state.gcdRemainingMs === 0;
      const canQueue = state.playerCast !== null || state.gcdRemainingMs > 0;
      const wantsCommand = free || (canQueue && state.queuedSpellId === null);
      if (!wantsCommand) return;

      const armedFreeHeal = state.cooldowns.some((c) => {
        if (c.activeRemainingMs <= 0) return false;
        const def = loadout.cooldowns.find((d) => d.id === c.id);
        return def?.effect.kind === 'freeNextHeal';
      });

      maybeActivateCooldowns(engine, healer, target, heals, loadout, state, armedFreeHeal, ctx.bias);

      if (target) {
        // Setup: cast Mend first to arm mend→heal when the buffed Heal is worth it.
        if (
          shouldArmWithMend(mend, heals, healer, target, state, loadout, armedFreeHeal, ctx.bias)
        ) {
          engine.setTarget(target.id);
          engine.castSpell(mend!.id);
          return;
        }

        const spell = pickHeal(heals, healer, target, state, loadout, armedFreeHeal, ctx.bias);
        if (spell) {
          engine.setTarget(target.id);
          engine.castSpell(spell.id);
          return;
        }
      }

      // Amp setup while stable: Vowstrike potency before a needed heal, else Bonk.
      const enemiesAlive = state.enemies.some((e) => e.alive);
      if (
        enemiesAlive &&
        vowstrike &&
        spellOffCd(vowstrike.id, state.spellCooldowns) &&
        canAfford(healer, vowstrike) &&
        target &&
        isEmergency(target) &&
        state.nextHealPotencyPct === 0
      ) {
        engine.castSpell(vowstrike.id);
        return;
      }

      if (bonk && spellOffCd(bonk.id, state.spellCooldowns) && canAfford(healer, bonk)) {
        if (enemiesAlive) engine.castSpell(bonk.id);
      }
    },
  };
}

/**
 * Arm mend→heal when: synergy exists, Heal isn't already (soon) buffed, Mend
 * is castable, and we're not in a pure HPS panic that needs an instant Heal.
 */
function shouldArmWithMend(
  mend: SpellDef | undefined,
  heals: readonly SpellDef[],
  healer: Unit,
  target: Unit,
  state: CombatState,
  loadout: CombatMods,
  freeHeal: boolean,
  bias: SpellBias,
): boolean {
  if (!mend) return false;
  if (!canArmBuff('mend', 'heal', loadout)) return false;
  if (willBuffSpell('heal', state, loadout)) return false;
  if (!spellOffCd(mend.id, state.spellCooldowns)) return false;
  const mendCost = effectiveManaCost(mend, state, loadout);
  if (!freeHeal && healer.mana < mendCost) return false;
  // Panic: don't spend a GCD arming — cast the fastest heal now.
  if (isEmergency(target) || bias === 'throughput') return false;

  const healSpell = heals.find((s) => s.id === 'heal');
  if (!healSpell) return false;
  const missing = missingHp(target);
  const baseHeal = healSpell.heal;
  const armedBonus = loadout.synergies
    .filter((s) => s.buffedSpellId === 'heal')
    .reduce((n, s) => n + s.bonusHeal, 0);
  const armedHeal = baseHeal + armedBonus;

  // Only arm when the hole clearly wants the buffed Heal (not a tiny top-off).
  if (missing <= baseHeal) return false;
  if (missing >= armedHeal) return true;
  // Free Mend that chips damage while arming a useful follow-up.
  if (mendCost === 0 && missing > baseHeal) return true;
  return false;
}

function pickHeal(
  heals: readonly SpellDef[],
  healer: Unit,
  target: Unit,
  state: CombatState,
  loadout: CombatMods,
  freeHeal: boolean,
  bias: SpellBias,
): SpellDef | undefined {
  const missing = missingHp(target);
  if (missing <= 0 && !target.dying) return undefined;

  const affordable = heals.filter((s) => {
    if (!spellOffCd(s.id, state.spellCooldowns)) return false;
    const cost = effectiveManaCost(s, state, loadout);
    return freeHeal || healer.mana >= cost;
  });
  if (affordable.length === 0) return undefined;

  // Prefer zero overheal against *effective* heal (armed combo counts). If
  // nothing fits, take the least-overheal option so we still stabilize.
  const scored = affordable.map((s) => {
    const eff = effectiveHealAmount(s, target, state, loadout);
    return { spell: s, eff, overheal: Math.max(0, eff - missing) };
  });
  const perfect = scored.filter((s) => s.overheal === 0 || target.dying);
  const pool = (perfect.length > 0 ? perfect : scored).sort(
    (a, b) => a.overheal - b.overheal,
  );
  if (pool.length === 0) return undefined;
  // Among least-overheal candidates, apply efficiency / HPS policy.
  const minOh = pool[0]!.overheal;
  const candidates = pool.filter((s) => s.overheal === minOh).map((s) => s.spell);

  const emergency = isEmergency(target);
  if (emergency || bias === 'throughput') {
    return maxBy(candidates, (s) => effectiveHealPerSecond(s, target, state, loadout), (s) =>
      effectiveHealAmount(s, target, state, loadout),
    );
  }
  if (bias === 'efficiency') {
    return maxBy(
      candidates,
      (s) => effectiveHealPerMana(s, target, state, loadout),
      (s) => -effectiveManaCost(s, state, loadout),
    );
  }
  return maxBy(
    candidates,
    (s) => effectiveHealPerMana(s, target, state, loadout),
    (s) => -s.castMs,
  );
}

function maxBy<T>(
  items: readonly T[],
  primary: (item: T) => number,
  secondary: (item: T) => number,
): T | undefined {
  let best: T | undefined;
  let bestP = -Infinity;
  let bestS = -Infinity;
  for (const item of items) {
    const p = primary(item);
    const s = secondary(item);
    if (p > bestP || (p === bestP && s > bestS)) {
      best = item;
      bestP = p;
      bestS = s;
    }
  }
  return best;
}

function maybeActivateCooldowns(
  engine: CombatEngine,
  healer: Unit,
  target: Unit | undefined,
  heals: readonly SpellDef[],
  loadout: CombatMods,
  state: CombatState,
  armedFreeHeal: boolean,
  bias: SpellBias,
): void {
  if (loadout.cooldowns.length === 0) return;
  const intended =
    target !== undefined
      ? pickHeal(heals, healer, target, state, loadout, armedFreeHeal, bias)
      : undefined;
  const manaTight = healer.maxMana > 0 && healer.mana * 5 <= healer.maxMana * 2;
  const emergency = target !== undefined && isEmergency(target);

  for (const def of loadout.cooldowns) {
    const cdState = state.cooldowns.find((c) => c.id === def.id);
    if (!cdState || cdState.remainingCooldownMs > 0) continue;

    if (def.effect.kind === 'freeNextHeal') {
      if (intended !== undefined && healer.mana < effectiveManaCost(intended, state, loadout)) {
        engine.activateCooldown(def.id);
      }
    } else if (def.effect.kind === 'manaCostReduction') {
      if (manaTight || emergency) engine.activateCooldown(def.id);
    } else if (def.effect.kind === 'healBonus') {
      if (emergency && intended !== undefined) engine.activateCooldown(def.id);
    }
  }
}

/** Classify a wipe: mana remaining ⇒ heal-output problem; else mana-efficiency. */
export function biasAfterWipe(healerManaLeft: number): Exclude<SpellBias, null> {
  return healerManaLeft > 0 ? 'throughput' : 'efficiency';
}
