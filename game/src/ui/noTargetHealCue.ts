/**
 * No-target heal WHO cue (Playtest Wave 4b / J15). Pure trigger + rate-limit
 * helpers live here; `presentNoTargetHealCue` is the thin Phaser show path so
 * CombatScene stays under max-lines. Engine heal math is untouched.
 */

import type Phaser from 'phaser';
import { NO_TARGET_HEAL_LINE } from '../data/banter';
import { portraitTextureKey } from './portraitSprites';
import {
  segmentsForMarkedWord,
  showSpeechBubble,
  type SpeechBubbleSegment,
} from './speechBubble';

/** Min sim-ms between WHO bubbles so spam-clicking does not stack them. */
export const NO_TARGET_HEAL_COOLDOWN_MS = 3000;

/** Word marked for bold + shake inside {@link NO_TARGET_HEAL_LINE}. */
export const NO_TARGET_HEAL_EMPHASIS = 'WHO';

/** Damage spells auto-pick enemies; everything else is an ally-target heal cast. */
export function isAllyTargetHealSpell(spell: { damage?: number }): boolean {
  return (spell.damage ?? 0) <= 0;
}

/**
 * True when a heal cast attempt should show the WHO bubble: ally-target heal,
 * no selected ally target, and rate-limit window has elapsed.
 */
export function shouldFireNoTargetHealCue(args: {
  spell: { damage?: number } | undefined;
  allyTargetId: string | null;
  nowMs: number;
  lastFiredAtMs: number | null;
  cooldownMs?: number;
}): boolean {
  const { spell, allyTargetId, nowMs, lastFiredAtMs } = args;
  if (!spell || !isAllyTargetHealSpell(spell)) return false;
  if (allyTargetId !== null) return false;
  const cooldownMs = args.cooldownMs ?? NO_TARGET_HEAL_COOLDOWN_MS;
  if (lastFiredAtMs !== null && nowMs - lastFiredAtMs < cooldownMs) return false;
  return true;
}

/** Segment layout for the locked WHO line (WHO emphasized). */
export function noTargetHealSegments(): SpeechBubbleSegment[] {
  return segmentsForMarkedWord(NO_TARGET_HEAL_LINE, NO_TARGET_HEAL_EMPHASIS);
}

/**
 * Scene entry: if the cue should fire, show the healer WHO bubble and return
 * `nowMs` as the new latch; otherwise return the previous latch unchanged.
 */
export function presentNoTargetHealCue(args: {
  scene: Phaser.Scene;
  spell: { damage?: number } | undefined;
  allyTargetId: string | null;
  nowMs: number;
  lastFiredAtMs: number | null;
  healerHome: { x: number; y: number } | null;
  yOffset: number;
  viewWidth: number;
  viewHeight: number;
}): number | null {
  if (
    !shouldFireNoTargetHealCue({
      spell: args.spell,
      allyTargetId: args.allyTargetId,
      nowMs: args.nowMs,
      lastFiredAtMs: args.lastFiredAtMs,
    })
  ) {
    return args.lastFiredAtMs;
  }
  if (args.healerHome) {
    showSpeechBubble(args.scene, {
      x: args.healerHome.x,
      y: args.healerHome.y - args.yOffset,
      text: NO_TARGET_HEAL_LINE,
      segments: noTargetHealSegments(),
      viewWidth: args.viewWidth,
      viewHeight: args.viewHeight,
      portraitTextureKey: portraitTextureKey('healer'),
    });
  }
  return args.nowMs;
}
