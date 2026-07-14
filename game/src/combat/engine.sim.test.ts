import { describe, expect, it } from 'vitest';
import { CombatEngine } from './engine';
import { ASH_GATE } from '../data/encounters';
import { ALL_SPELLS } from '../data/spells';
import { SPELLS } from '../data/constants';
import type { CombatEvent } from './types';

/**
 * A scripted healer bot: always keeps the tank targeted and mends it with
 * Solemn Mend whenever it's free to cast. This is a smoke test for the whole
 * engine loop against the real Ash Gate data, not a balance test — Ash Gate
 * is expected to wipe (poc-spec §1), so we only assert the sim behaves
 * (terminates cleanly, one end event, rewards track kills).
 */
function runHealerBotSim(): { events: CombatEvent[]; engine: CombatEngine } {
  const engine = new CombatEngine(ASH_GATE, ALL_SPELLS);
  engine.setTarget('tank');
  const events: CombatEvent[] = [];
  const STEP_MS = 250;
  const MAX_MS = 10 * 60 * 1000; // 10 sim-minutes hard cap so a bug can't hang the test
  let elapsed = 0;

  while (elapsed < MAX_MS) {
    // Keep re-issuing the heal every tick; castSpell is a no-op while busy/OOM/queued.
    engine.castSpell(SPELLS.solemnMend.id);
    const stepEvents = engine.advance(STEP_MS);
    events.push(...stepEvents);
    elapsed += STEP_MS;
    if (engine.state.status !== 'running') break;
  }
  return { events, engine };
}

describe('end-to-end: scripted healer bot', () => {
  it('runs Ash Gate to a definite end without throwing, with a single combatEnded event', () => {
    const { events, engine } = runHealerBotSim();
    expect(['victory', 'wipe']).toContain(engine.state.status);

    const ended = events.filter((e) => e.type === 'combatEnded');
    expect(ended).toHaveLength(1);
  });

  it('XP tracks every kill while gold follows the two-kill bundle cadence', () => {
    const { events, engine } = runHealerBotSim();
    const kills = events.filter((e) => e.type === 'unitDied' && !['tank', 'dps1', 'dps2', 'healer'].includes(e.unitId));
    expect(engine.rewards.gold).toBe(Math.floor(kills.length / 2));
    expect(engine.rewards.xp).toBe(kills.length);
    expect(kills.length).toBeGreaterThan(0); // the bot should land at least one kill before any outcome
  });

  it('is deterministic: two identical runs produce identical event logs', () => {
    const runA = runHealerBotSim();
    const runB = runHealerBotSim();
    expect(runA.events).toEqual(runB.events);
    expect(runA.engine.state).toEqual(runB.engine.state);
    expect(runA.engine.rewards).toEqual(runB.engine.rewards);
  });
});
