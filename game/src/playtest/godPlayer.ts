/**
 * God-gamer playtest bot — never wastes a GCD (queues the next cast), fills
 * with Bonk when the party is topped, never overheals, picks efficient heals
 * unless the target is below the emergency HP threshold (then max HPS).
 *
 * `bias` (set by the curve harness after a wipe) tilts spell choice toward
 * throughput or mana efficiency on the retry.
 */

import type { CombatEngine } from '../combat/engine';
import type { CooldownDef, SpellDef, Unit } from '../combat/types';
import {
  canAfford,
  healPerManaMillis,
  healPerSecondMillis,
  isDamageFiller,
  isEmergency,
  isHealSpell,
  missingHp,
  pickHealTarget,
  spellOffCd,
} from './heals';
import type { PlaytestContext, PlaytestPlayer, SpellBias } from './types';

export function createGodPlayer(
  spells: readonly SpellDef[],
  cooldowns: readonly CooldownDef[] = [],
): PlaytestPlayer {
  const heals = spells.filter(isHealSpell);
  const fillers = spells.filter(isDamageFiller);
  // Prefer bonk id when present; otherwise any free damage filler.
  const bonk =
    fillers.find((s) => s.id === 'bonk') ??
    fillers.find((s) => s.mana === 0) ??
    fillers[0];

  return {
    act(engine: CombatEngine, ctx: PlaytestContext): void {
      const state = engine.state;
      if (state.status !== 'running') return;

      const healer = state.party.find((u) => u.role === 'healer');
      if (!healer) return;

      const target = pickHealTarget(state.party);
      const free = state.playerCast === null && state.gcdRemainingMs === 0;
      const canQueue = state.playerCast !== null || state.gcdRemainingMs > 0;
      // Queue only when nothing is already queued — never waste the GCD.
      const wantsCommand = free || (canQueue && state.queuedSpellId === null);
      if (!wantsCommand) return;

      const armedFreeHeal = state.cooldowns.some((c) => {
        if (c.activeRemainingMs <= 0) return false;
        const def = cooldowns.find((d) => d.id === c.id);
        return def?.effect.kind === 'freeNextHeal';
      });

      maybeActivateCooldowns(engine, healer, target, heals, cooldowns, armedFreeHeal);

      if (target) {
        const spell = pickHeal(heals, healer, target, state.spellCooldowns, armedFreeHeal, ctx.bias);
        if (spell) {
          engine.setTarget(target.id);
          engine.castSpell(spell.id);
          return;
        }
      }

      // No heal needed (or none affordable without overheal) — Bonk filler.
      if (bonk && spellOffCd(bonk.id, state.spellCooldowns) && canAfford(healer, bonk)) {
        const enemiesAlive = state.enemies.some((e) => e.alive);
        if (enemiesAlive) engine.castSpell(bonk.id);
      }
    },
  };
}

function pickHeal(
  heals: readonly SpellDef[],
  healer: Unit,
  target: Unit,
  spellCooldowns: readonly { spellId: string; remainingMs: number }[],
  freeHeal: boolean,
  bias: SpellBias,
): SpellDef | undefined {
  const missing = missingHp(target);
  if (missing <= 0 && !target.dying) return undefined;

  const affordable = heals.filter(
    (s) => canAfford(healer, s, freeHeal) && spellOffCd(s.id, spellCooldowns),
  );
  if (affordable.length === 0) return undefined;

  // Never overheal: only spells whose printed heal fits in the missing HP.
  // Exception: dying targets — any heal that can land is a save.
  const noOverheal = target.dying
    ? affordable
    : affordable.filter((s) => s.heal <= missing);
  const pool = noOverheal.length > 0 ? noOverheal : target.dying ? affordable : [];
  if (pool.length === 0) return undefined;

  const emergency = isEmergency(target);
  if (emergency || bias === 'throughput') {
    return maxBy(pool, (s) => healPerSecondMillis(s), (s) => s.heal);
  }
  if (bias === 'efficiency') {
    return maxBy(pool, (s) => healPerManaMillis(s), (s) => -s.mana);
  }
  // Default: most efficient heal (heal per mana), tie-break lower mana.
  return maxBy(pool, (s) => healPerManaMillis(s), (s) => -busyTie(s));
}

function busyTie(spell: SpellDef): number {
  // Prefer slightly faster casts when efficiency ties.
  return spell.castMs;
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
  cooldownDefs: readonly CooldownDef[],
  armedFreeHeal: boolean,
): void {
  if (cooldownDefs.length === 0) return;
  const state = engine.state;
  const intended =
    target !== undefined
      ? pickHeal(heals, healer, target, state.spellCooldowns, armedFreeHeal, null)
      : undefined;
  const manaTight = healer.maxMana > 0 && healer.mana * 5 <= healer.maxMana * 2;
  const emergency = target !== undefined && isEmergency(target);

  for (const def of cooldownDefs) {
    const cdState = state.cooldowns.find((c) => c.id === def.id);
    if (!cdState || cdState.remainingCooldownMs > 0) continue;

    if (def.effect.kind === 'freeNextHeal') {
      if (intended !== undefined && healer.mana < intended.mana) {
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
