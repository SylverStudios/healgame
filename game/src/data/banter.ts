/**
 * Party banter — line tables + pure trigger helpers (v0.3 chunk G; Wave 1
 * coaching triggers). Pure, deterministic, Phaser-free (hard rule: nothing
 * under src/data/ may import Phaser or read time/randomness) — CombatScene
 * renders the picked line in a speech bubble (ui/speechBubble.ts) and owns
 * all trigger timing (once-per-fight latches, when to fire).
 *
 * Locked triggers/speakers the scene is expected to fire:
 *   close-call → healer, wipe → tank, victory → healer,
 *   idle-coach → healer, tank-coach → tank,
 *   low-mana → healer, oom → healer (hasBonkOnBar branches the line list).
 * The other (trigger, speaker) combos are filled in below too so
 * pickBanterLine is total over its pinned signature and never throws — they
 * are not necessarily wired up by the scene.
 */

export type BanterTrigger =
  | 'close-call'
  | 'wipe'
  | 'victory'
  | 'idle-coach'
  | 'tank-coach'
  | 'low-mana'
  | 'oom';
export type BanterSpeaker = 'healer' | 'tank';

type HealerVoice = 'vigil' | 'zealot' | 'neutral';

/**
 * Dark-fantasy, oath-flavored, no meme comedy. Lines stay under ~40 chars so
 * the speech bubble stays small. Vigil reads solemn/grave, Zealot reads
 * fervent/zealous, neutral (no subclass sworn yet) reads devout.
 *
 * For `'oom'`, these tables are the no-Bonk / dry-wait lines. Bonk-on-bar
 * variants live in HEALER_OOM_BONK_LINES and are selected when
 * `hasBonkOnBar === true`.
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
  'idle-coach': {
    vigil: [
      'The vow waits on your hand.',
      'Cast. Mercy does not idle.',
      'Speak the light — begin.',
      'Your spells sleep. Wake them.',
    ],
    zealot: [
      'Burn! Do not stand idle!',
      'The flame begs a spell!',
      'Strike with light — NOW!',
      'Idle hands shame the altar!',
    ],
    neutral: [
      'Use a spell. Begin.',
      'Mercy waits on your cast.',
      'The light needs your hand.',
      'Do not idle — heal them.',
    ],
  },
  'tank-coach': {
    // Off-design combo — tank-coach's spoken line belongs to the tank.
    vigil: ['The wall needs my hand.', 'I should mark the tank.'],
    zealot: ['The wall burns — heal it!', 'Flame the tank — now!'],
    neutral: ['The tank needs healing.', 'Help the wall. Heal them.'],
  },
  'low-mana': {
    vigil: [
      'Mana thins. Pace the vow.',
      'Watch the blue. Spend wisely.',
      'The well runs low. Careful.',
      'Conserve. Mercy must last.',
    ],
    zealot: [
      'Flame fades — spend with fire!',
      'Blue drains! Make each burn!',
      'Mana wanes — no waste!',
      'The well shrinks. Burn wisely!',
    ],
    neutral: [
      'Mana runs low. Pace it.',
      'Watch the blue bar.',
      'Spend carefully — mana dips.',
      'The well thins. Slow down.',
    ],
  },
  oom: {
    // No Bonk on bar (or hasBonkOnBar omitted) — dry / wait for mana.
    vigil: [
      'Dry. Wait for the well.',
      'Empty. Hold for mana.',
      'No mana left. Endure.',
      'The well is dry. Wait.',
    ],
    zealot: [
      'Empty! The flame starves!',
      'Dry as ash — wait!',
      'No fuel. Hold the line!',
      'The well is spent. Wait!',
    ],
    neutral: [
      'Out of mana. Wait.',
      'Dry. Mana must return.',
      'Empty. Hold for now.',
      'No mana. Endure.',
    ],
  },
};

/** Healer `'oom'` lines when Bonk is on the action bar — point at the free stick hit. */
const HEALER_OOM_BONK_LINES: Record<HealerVoice, readonly string[]> = {
  vigil: [
    'Bonk them. Mana will return.',
    'Swing Bonk while I refill.',
    'Use Bonk — free stick hit.',
    'Bonk. Wait for the well.',
  ],
  zealot: [
    'Bonk! Strike while I burn!',
    'Bonk them — free wrath!',
    'Swing Bonk! Mana returns!',
    'Bonk now — the well refills!',
  ],
  neutral: [
    'Use Bonk while mana returns.',
    'Bonk them — it costs nothing.',
    'Swing Bonk. Wait for mana.',
    'Bonk. Free hit. Then heal.',
  ],
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
  // Off-design combo — idle-coach belongs to the healer.
  'idle-coach': ['Waiting on you, healer.', 'Spells idle. Move.', 'Wall holds. Cast already.'],
  'tank-coach': [
    'Click me. I need healing.',
    "Select me — I'm fading.",
    'Heal me. Click the tank.',
    'Tab to me. Patch this up.',
    'Point at me. Heal. Now.',
  ],
  // Off-design — low-mana / oom belong to the healer.
  'low-mana': ['Blue runs thin. Pace it.', 'Mana dips. Be careful.', 'Watch your well, healer.'],
  oom: ['Dry well. Hold the line.', 'No mana. Endure.', 'Empty. We wait.'],
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
 *
 * `hasBonkOnBar` only affects `'oom'` + healer: `true` selects Bonk-tip lines; omitted/false
 * selects dry-wait lines. Ignored for every other trigger/speaker combo.
 */
export function pickBanterLine(args: {
  trigger: BanterTrigger;
  speaker: BanterSpeaker;
  subclass: 'vigil' | 'zealot' | null;
  /** Meaningful only for `'oom'` + healer — Bonk tip vs dry-wait line lists. */
  hasBonkOnBar?: boolean;
  /** Inject for tests; default deterministic pick by index (first line). */
  rng?: () => number;
}): string {
  const { trigger, speaker, subclass, hasBonkOnBar, rng = () => 0 } = args;
  const voice: HealerVoice = subclass ?? 'neutral';
  const lines =
    speaker === 'healer'
      ? trigger === 'oom' && hasBonkOnBar === true
        ? HEALER_OOM_BONK_LINES[voice]
        : HEALER_LINES[trigger][voice]
      : TANK_LINES[trigger];
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

// ---- first-fight coaching detectors ----------------------------------------

/** ~20s of combat/sim time, healer issued no spell/CD yet. */
export const IDLE_COACH_MS = 20_000;

/**
 * True when combat has run at least {@link IDLE_COACH_MS} without the healer issuing any
 * spell or CD command, and the idle-coach line has not already fired this fight.
 * Caller owns the latch + `healerHasActed` / elapsed tracking.
 */
export function detectIdleCoach(args: {
  elapsedCombatMs: number;
  healerHasActed: boolean; // any spell or CD command issued
  alreadyFired: boolean;
}): boolean {
  if (args.alreadyFired || args.healerHasActed) return false;
  return args.elapsedCombatMs >= IDLE_COACH_MS;
}

/**
 * Tank low HP + healer has never landed a heal this fight.
 * Threshold: integer-safe ≤35% HP (`hp * 100 <= maxHp * 35`). Dead tank never qualifies.
 */
export function detectTankCoach(args: {
  tank: { alive: boolean; hp: number; maxHp: number };
  healerHasHealed: boolean;
  alreadyFired: boolean;
}): boolean {
  if (args.alreadyFired || args.healerHasHealed || !args.tank.alive) return false;
  return args.tank.hp * 100 <= args.tank.maxHp * 35;
}

/**
 * Low mana (not empty). Threshold: mana > 0 AND integer-safe ≤25%
 * (`mana * 100 <= maxMana * 25`).
 */
export function detectLowMana(args: {
  mana: number;
  maxMana: number;
  alreadyFired: boolean;
}): boolean {
  if (args.alreadyFired || args.mana <= 0) return false;
  return args.mana * 100 <= args.maxMana * 25;
}

/** OOM. True when mana <= 0 and the oom line has not already fired this fight. */
export function detectOom(args: {
  mana: number;
  alreadyFired: boolean;
}): boolean {
  if (args.alreadyFired) return false;
  return args.mana <= 0;
}
