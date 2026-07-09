import { describe, expect, it } from 'vitest';
import { CombatEngine } from './engine';
import { ASH_GATE, THE_MAW } from '../data/encounters';
import { ALL_SPELLS } from '../data/spells';
import { SPELLS } from '../data/constants';
import type { EncounterDef, SpellDef, Unit } from './types';

/**
 * Balance gates for poc-spec §4.1 ("threat is mana, not raw HPS") and §7
 * ("Dungeon 2 cannot be cleared"). These pin the difficulty *shape* so tuning
 * regressions fail deterministically:
 *
 *   1. Ash Gate with no healing at all → wipe (a healer must matter).
 *   2. Ash Gate, NAIVE healing (spam Solemn on the tank, overheal freely) on
 *      the starting kit → wipe. This is the spec's "expected first run":
 *      wasted mana loses the run, not raw HPS.
 *   3. Ash Gate, disciplined zero-overheal healing on the starting kit → no
 *      comfortable clear: either a wipe, or a pyrrhic win (healer fully OOM,
 *      at most 2 party members standing). Perfect play may scrape through;
 *      it must never cruise.
 *   4. Ash Gate, disciplined healing, full PoC kit (both spells + Deep
 *      Reserves' +5 mana) → victory with at least 3 party members alive
 *      (the journey's step 6 must be reachable and progression must be felt).
 *   5. Bonehowl actually lands at least once in the winning run (the 10s
 *      telegraph is part of the PoC experience).
 *   6. The Maw with the full kit and disciplined healing → wipe (sandbox).
 */

const STEP_MS = 250;
const MAX_MS = 10 * 60 * 1000;

const BASE_KIT: SpellDef[] = [SPELLS.solemnMend];
const FULL_KIT: SpellDef[] = ALL_SPELLS;
const DEEP_RESERVES_BONUS = 5;

interface BotRun {
  status: 'victory' | 'wipe';
  elapsedMs: number;
  bonehowlLandings: number;
  healsCast: number;
  survivors: number;
  healerManaLeft: number;
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
 *   overheal). Prefers efficient Solemn; uses Zealous Mending only when the
 *   tank is about to die and the faster cast can beat the next swing.
 */
function runBot(
  encounter: EncounterDef,
  spells: SpellDef[],
  bonusMaxMana: number,
  style: BotStyle,
): BotRun {
  const engine = new CombatEngine(encounter, spells, { bonusMaxMana });
  const hasSolemn = spells.some((s) => s.id === SPELLS.solemnMend.id);
  const hasZealous = spells.some((s) => s.id === SPELLS.zealousMending.id);
  let elapsed = 0;
  let bonehowlLandings = 0;
  let healsCast = 0;

  while (elapsed < MAX_MS) {
    const state = engine.state;
    if (state.status !== 'running') break;

    const healer = state.party.find((u) => u.role === 'healer');
    const free = state.playerCast === null && state.gcdRemainingMs === 0;

    if (style === 'naive' && healer && free && hasSolemn) {
      const tank = state.party.find((u) => u.role === 'tank');
      const anyAlly = state.party.find((u) => u.alive);
      const target = tank?.alive ? tank : anyAlly;
      if (target && healer.mana >= SPELLS.solemnMend.mana) {
        engine.setTarget(target.id);
        engine.castSpell(SPELLS.solemnMend.id);
        healsCast += 1;
      }
    }

    if (style === 'disciplined' && healer && free) {
      const injured = state.party
        .filter((u) => u.alive && u.maxHp - u.hp > 0)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
      const target: Unit | undefined = injured[0];
      if (target) {
        const missing = target.maxHp - target.hp;
        const tankCritical = target.role === 'tank' && target.hp <= 6;
        const useZealous =
          hasZealous && tankCritical && healer.mana >= SPELLS.zealousMending.mana;
        const spell = useZealous
          ? SPELLS.zealousMending
          : hasSolemn
            ? SPELLS.solemnMend
            : undefined;
        const fullValue = spell !== undefined && missing >= spell.heal;
        if (spell && (fullValue || tankCritical) && healer.mana >= spell.mana) {
          engine.setTarget(target.id);
          engine.castSpell(spell.id);
          healsCast += 1;
        }
      }
    }

    for (const event of engine.advance(STEP_MS)) {
      if (event.type === 'bossCastFinished') bonehowlLandings += 1;
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
    healsCast,
    survivors: engine.state.party.filter((u) => u.alive).length,
    healerManaLeft: healer?.mana ?? 0,
  };
}

describe('Ash Gate difficulty shape (poc-spec §4.1)', () => {
  it('wipes with no healing at all — the healer must matter', () => {
    const run = runBot(ASH_GATE, BASE_KIT, 0, 'none');
    expect(run.status).toBe('wipe');
  });

  it('wipes with naive spam-healing on the starting kit — the expected first run; overheal loses', () => {
    const run = runBot(ASH_GATE, BASE_KIT, 0, 'naive');
    expect(run.status).toBe('wipe');
  });

  it('never cruises with perfect discipline on the starting kit — wipe or pyrrhic OOM scrape at best', () => {
    const run = runBot(ASH_GATE, BASE_KIT, 0, 'disciplined');
    if (run.status === 'victory') {
      expect(run.healerManaLeft).toBeLessThan(SPELLS.solemnMend.mana);
      expect(run.survivors).toBeLessThanOrEqual(2);
    }
  });

  it('is cleared with disciplined healing on the full PoC kit, most of the party standing', () => {
    const run = runBot(ASH_GATE, FULL_KIT, DEEP_RESERVES_BONUS, 'disciplined');
    expect(run.status).toBe('victory');
    expect(run.healsCast).toBeGreaterThan(0);
    expect(run.survivors).toBeGreaterThanOrEqual(3);
  });

  it('the Bonehowl telegraph lands at least once in the winning run', () => {
    const run = runBot(ASH_GATE, FULL_KIT, DEEP_RESERVES_BONUS, 'disciplined');
    expect(run.bonehowlLandings).toBeGreaterThanOrEqual(1);
  });
});

describe('The Maw is an unwinnable sandbox (poc-spec §7)', () => {
  it('wipes even with the full kit and disciplined healing', () => {
    const run = runBot(THE_MAW, FULL_KIT, DEEP_RESERVES_BONUS, 'disciplined');
    expect(run.status).toBe('wipe');
  });
});
