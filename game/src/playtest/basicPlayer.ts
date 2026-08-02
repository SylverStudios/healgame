/**
 * Basic playtest bot — casts one heal after another with a short idle gap,
 * randomly picks which heal, targets injured allies, and freely overheals.
 */

import type { CombatEngine } from '../combat/engine';
import type { SpellDef } from '../combat/types';
import { canAfford, isHealSpell, pickHealTarget, spellOffCd } from './heals';
import { pickRandom } from './rng';
import type { PlaytestContext, PlaytestPlayer } from './types';

/** Sim-ms to sit idle after each cast before starting the next (no queueing). */
export const BASIC_IDLE_GAP_MS = 400;

export function createBasicPlayer(spells: readonly SpellDef[]): PlaytestPlayer {
  let idleUntilMs = 0;

  return {
    act(engine: CombatEngine, ctx: PlaytestContext): void {
      const state = engine.state;
      if (state.status !== 'running') return;

      const healer = state.party.find((u) => u.role === 'healer');
      if (!healer) return;

      const free = state.playerCast === null && state.gcdRemainingMs === 0;
      if (!free || ctx.elapsedMs < idleUntilMs) return;

      const heals = spells.filter(
        (s) =>
          isHealSpell(s) &&
          canAfford(healer, s) &&
          spellOffCd(s.id, state.spellCooldowns),
      );
      if (heals.length === 0) return;

      const target = pickHealTarget(state.party);
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
