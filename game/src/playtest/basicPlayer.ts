/**
 * Basic playtest bot — casts one heal after another with a short idle gap,
 * randomly picks which heal, targets injured allies, and freely overheals.
 * Weaves Vowstrike damage spells when the party is relatively stable (no ally
 * under 40% HP) or no heal is needed, teaching the Iron Pass DPS lesson.
 */

import type { CombatEngine } from '../combat/engine';
import type { SpellDef } from '../combat/types';
import { canAfford, isDamageFiller, isHealSpell, pickHealTarget, spellOffCd } from './heals';
import { pickRandom } from './rng';
import type { PlaytestContext, PlaytestPlayer } from './types';

/** Sim-ms to sit idle after each cast before starting the next (no queueing). */
export const BASIC_IDLE_GAP_MS = 400;

/** HP fraction below which the basic bot treats an ally as unstable and skips filler. */
const STABLE_HP_PCT = 40;

export function createBasicPlayer(spells: readonly SpellDef[]): PlaytestPlayer {
  let idleUntilMs = 0;

  const vowstrikes = spells.filter((s) => isDamageFiller(s) && s.id.includes('vowstrike'));

  return {
    act(engine: CombatEngine, ctx: PlaytestContext): void {
      const state = engine.state;
      if (state.status !== 'running') return;

      const healer = state.party.find((u) => u.role === 'healer');
      if (!healer) return;

      const free = state.playerCast === null && state.gcdRemainingMs === 0;
      if (!free || ctx.elapsedMs < idleUntilMs) return;

      const target = pickHealTarget(state.party);
      const partyStable = state.party.every(
        (u) => !u.alive || !u.dying && u.hp * 100 >= u.maxHp * STABLE_HP_PCT,
      );
      const enemiesAlive = state.enemies.some((e) => e.alive);

      // Weave a Vowstrike damage spell when party is stable (or no heal target)
      // and enemies are up — this trains the same lesson the crown bot demonstrates.
      if (enemiesAlive && partyStable) {
        const vs = vowstrikes.find(
          (s) => spellOffCd(s.id, state.spellCooldowns) && canAfford(healer, s),
        );
        if (vs) {
          engine.castSpell(vs.id);
          idleUntilMs = ctx.elapsedMs + Math.max(vs.castMs, 1000) + BASIC_IDLE_GAP_MS;
          return;
        }
      }

      const heals = spells.filter(
        (s) =>
          isHealSpell(s) &&
          canAfford(healer, s) &&
          spellOffCd(s.id, state.spellCooldowns),
      );
      if (heals.length === 0) return;

      if (!target) return;

      const spell = pickRandom(heals, ctx.random);
      if (!spell) return;

      engine.setTarget(target.id);
      engine.castSpell(spell.id);
      // Brief pause after this cast's busy window ends.
      idleUntilMs = ctx.elapsedMs + Math.max(spell.castMs, 1000) + BASIC_IDLE_GAP_MS;
    },
  };
}
