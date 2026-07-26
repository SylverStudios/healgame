/**
 * Mid-combat banter pick (v0.3 close-call + Wave 1 coaching). Pure — kept out of
 * CombatScene.ts for the max-lines lint cap (same reason as ui/resultPanel.ts).
 *
 * Scene owns latches + healerHasActed/Healed + elapsedCombatMs (sim time from
 * paced advance deltas). This module only chooses which single bubble to fire.
 *
 * Priority (one bubble per frame): tank-coach > idle-coach > oom > low-mana > close-call.
 * Wipe/victory are end-of-fight and stay in showResultOverlay.
 */

import {
  detectCloseCall,
  detectIdleCoach,
  detectLowMana,
  detectOom,
  detectTankCoach,
  type BanterSpeaker,
  type BanterTrigger,
} from '../data/banter';

export interface MidCombatBanterLatches {
  closeCallFired: boolean;
  idleCoachFired: boolean;
  tankCoachFired: boolean;
  lowManaFired: boolean;
  oomFired: boolean;
}

export function freshMidCombatBanterLatches(): MidCombatBanterLatches {
  return {
    closeCallFired: false,
    idleCoachFired: false,
    tankCoachFired: false,
    lowManaFired: false,
    oomFired: false,
  };
}

export interface MidCombatBanterPartyUnit {
  id: string;
  role: string;
  alive: boolean;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
}

export interface MidCombatBanterPick {
  trigger: BanterTrigger;
  speaker: BanterSpeaker;
  latches: MidCombatBanterLatches;
}

/** Returns the one bubble to fire this frame, or null if nothing triggers. */
export function pickMidCombatBanter(args: {
  party: readonly MidCombatBanterPartyUnit[];
  latches: MidCombatBanterLatches;
  elapsedCombatMs: number;
  healerHasActed: boolean;
  healerHasHealed: boolean;
}): MidCombatBanterPick | null {
  const { party, latches, elapsedCombatMs, healerHasActed, healerHasHealed } = args;
  const healer = party.find((u) => u.role === 'healer');
  const tank = party.find((u) => u.role === 'tank');
  const next = { ...latches };

  if (
    tank !== undefined &&
    detectTankCoach({ tank, healerHasHealed, alreadyFired: next.tankCoachFired })
  ) {
    next.tankCoachFired = true;
    return { trigger: 'tank-coach', speaker: 'tank', latches: next };
  }
  if (detectIdleCoach({ elapsedCombatMs, healerHasActed, alreadyFired: next.idleCoachFired })) {
    next.idleCoachFired = true;
    return { trigger: 'idle-coach', speaker: 'healer', latches: next };
  }
  if (healer !== undefined && detectOom({ mana: healer.mana, alreadyFired: next.oomFired })) {
    next.oomFired = true;
    return { trigger: 'oom', speaker: 'healer', latches: next };
  }
  if (
    healer !== undefined &&
    detectLowMana({
      mana: healer.mana,
      maxMana: healer.maxMana,
      alreadyFired: next.lowManaFired,
    })
  ) {
    next.lowManaFired = true;
    return { trigger: 'low-mana', speaker: 'healer', latches: next };
  }
  if (detectCloseCall(party, next.closeCallFired)) {
    next.closeCallFired = true;
    return { trigger: 'close-call', speaker: 'healer', latches: next };
  }
  return null;
}
