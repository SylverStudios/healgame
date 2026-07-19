/**
 * Party banter — line tables + pure trigger helpers (v0.3 chunk G; locked
 * design in docs/v0.3-handoff.md "Banter" / "Close call (banter trigger)").
 * Pure, deterministic, Phaser-free (hard rule: nothing under src/data/ may
 * import Phaser or read time/randomness) — CombatScene renders the picked
 * line in a speech bubble (ui/speechBubble.ts) and owns all trigger timing
 * (once-per-fight latches, when to fire relative to the result transition).
 *
 * Locked triggers/speakers (the only combos the scene actually fires):
 *   close-call → healer, wipe → tank, victory → healer.
 * The other (trigger, speaker) combos are filled in below too so
 * pickBanterLine is total over its pinned signature and never throws — they
 * are not wired up by the scene.
 */

export type BanterTrigger = 'close-call' | 'wipe' | 'victory';
export type BanterSpeaker = 'healer' | 'tank';

type HealerVoice = 'vigil' | 'zealot' | 'neutral';

/**
 * Dark-fantasy, oath-flavored, no meme comedy (handoff "Banter"). Lines stay
 * under ~40 chars so the speech bubble stays small. Vigil reads solemn/grave,
 * Zealot reads fervent/zealous, neutral (no subclass sworn yet) reads devout.
 */
const HEALER_LINES: Record<BanterTrigger, Record<HealerVoice, readonly string[]>> = {
  'close-call': {
    vigil: [
      'Hold. The vow does not break here.',
      'Breathe. I have not failed you yet.',
      'Steady — the Vigil does not falter.',
      'Not today. I forbid it.',
    ],
    zealot: [
      'Rise! The flame will not let you fall!',
      'No ground given — not one inch!',
      'Burn brighter! Do not go dark on me!',
      'I will not let the altar take you!',
    ],
    neutral: [
      'Hold fast. Mercy is coming.',
      'Not yet. Not like this.',
      'Stay with me — I am not done.',
      'The light has not left you.',
    ],
  },
  wipe: {
    // Off-design combo — wipe's spoken line belongs to the tank. Kept short.
    vigil: ['The vow could not hold. Forgive me.', 'I was not enough. Not tonight.'],
    zealot: ['The flame guttered. Not again.', 'Ash where there should be glory.'],
    neutral: ['Mercy came too late.', 'We fall. Not for lack of trying.'],
  },
  victory: {
    vigil: [
      'The vow holds. Rest now.',
      'Quiet ground. We endure.',
      'No more blood tonight.',
      'The Vigil kept its word.',
    ],
    zealot: [
      'The flame outlasts them all!',
      'Burned to ash — as it should be!',
      'Glory to the faithful!',
      'Let them fear the next dawn!',
    ],
    neutral: [
      'It is done. We stand.',
      'Mercy answered. We live.',
      'The light held true.',
      'We walk on, together.',
    ],
  },
};

/** Tank has no subclass — gruff/stoic, same voice regardless of trigger. */
const TANK_LINES: Record<BanterTrigger, readonly string[]> = {
  // Off-design combo — close call's spoken line belongs to the healer.
  'close-call': ['Still standing. Barely.', "Don't count me yet.", "Line's bent, not broken."],
  wipe: [
    "...couldn't hold the line.",
    'Down. All of us.',
    'The wall breaks sometime.',
    'Remember this ground.',
    'Next time. Not this.',
  ],
  // Off-design combo — victory's spoken line belongs to the healer.
  victory: ['Line held.', 'Ground kept.', 'They broke first.'],
};

/** Clamps a raw [0,1) rng draw to a valid array index — safe even at the r=1 edge. */
function pickIndex(rng: () => number, length: number): number {
  const index = Math.floor(rng() * length);
  return Math.min(length - 1, Math.max(0, index));
}

/**
 * Picks one banter line for (trigger, speaker, subclass). `rng` is optional and, per the
 * pinned contract, defaults to a deterministic first-line pick (`() => 0`) so data/ stays
 * time/randomness-free on its own — the scene passes `Math.random` for real in-game variety.
 */
export function pickBanterLine(args: {
  trigger: BanterTrigger;
  speaker: BanterSpeaker;
  subclass: 'vigil' | 'zealot' | null;
  /** Inject for tests; default deterministic pick by index (first line). */
  rng?: () => number;
}): string {
  const { trigger, speaker, subclass, rng = () => 0 } = args;
  const lines =
    speaker === 'healer' ? HEALER_LINES[trigger][subclass ?? 'neutral'] : TANK_LINES[trigger];
  return lines[pickIndex(rng, lines.length)]!;
}

// ---- close-call detection --------------------------------------------------

/** Minimal HP snapshot shape the detector needs — structurally compatible with combat/types Unit. */
export interface CloseCallUnit {
  alive: boolean;
  hp: number;
  maxHp: number;
}

/** Integer-safe ≤25% check (handoff "Close call"): `hp * 100 <= maxHp * 25`, no floats/rounding. */
function isAtOrBelowCloseCallThreshold(unit: CloseCallUnit): boolean {
  return unit.hp * 100 <= unit.maxHp * 25;
}

/**
 * True iff any LIVING ally (alive, including the coyote `dying` state — hp is 0 there, which
 * always satisfies the ≤25% check) sits at or below 25% HP in this snapshot AND the close-call
 * line hasn't already fired this combat. Pure + stateless: the caller (CombatScene) owns the
 * "already fired" latch across frames and sets it once this returns true, so a fight never
 * fires the close-call line more than once even if HP dips again later (handoff: "once per
 * combat... never again that combat even if others dip").
 */
export function detectCloseCall(units: readonly CloseCallUnit[], alreadyFired: boolean): boolean {
  if (alreadyFired) return false;
  return units.some((unit) => unit.alive && isAtOrBelowCloseCallThreshold(unit));
}
