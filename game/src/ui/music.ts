/**
 * Background music: a scene-agnostic singleton wrapping one Phaser sound
 * instance. v0.3 chunk H ("Audio / settings" + "Music prefs" pinned contract
 * in docs/v0.3-handoff.md).
 *
 * Asset path/extension lives in exactly ONE constant (MUSIC_URL) so swapping
 * the stock ambient loop for another track (or an .ogg/.mp3) is a one-line
 * change — nothing else in this file or its callers references the extension.
 *
 * `initMusic` takes the Phaser.Game reference once (called from BootScene,
 * which already loads the asset in preload() and reads SaveData first).
 * `setMusicVolumePct` is then callable from any scene (Settings, Hub, …)
 * without needing a scene reference of its own.
 *
 * All sound-manager calls are defensive: headless Chromium (smoke/journey)
 * may run with audio locked or a NoAudioSoundManager, and this module must
 * never throw in that environment (handoff §7).
 */

// Type-only: a runtime Phaser import would crash vitest's node environment
// (phaser's device detection reads `navigator` at module load).
import type Phaser from 'phaser';

/** Literal value of Phaser.Sound.Events.UNLOCKED — kept inline so this module
 *  never imports Phaser at runtime (see import note above). */
const SOUND_UNLOCKED_EVENT = 'unlocked';

export const MUSIC_ASSET_KEY = 'bg-music';
/** Single source of truth for the audio file path — see file header. */
export const MUSIC_URL = 'assets/audio/stock-ambient-loop.wav';

let activeGame: Phaser.Game | null = null;
let activeSound: Phaser.Sound.BaseSound | null = null;
/** Last requested volume — replayed once the sound manager unlocks. */
let pendingPct = 0;
let unlockListenerAttached = false;

/** Clamp to the 0..100 integer range the save schema expects. */
export function clampMusicPct(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

/** pct (0..100) -> Phaser gain (0..1). Pure, tested in music.test.ts. */
export function musicPctToGain(pct: number): number {
  return clampMusicPct(pct) / 100;
}

function safeSoundManager(): Phaser.Sound.BaseSoundManager | null {
  try {
    return activeGame?.sound ?? null;
  } catch {
    return null;
  }
}

/**
 * Register the Phaser game instance and start music at `initialPct` — called
 * once from BootScene.create() after loadSave(). Autoplay per the locked
 * design: if the sound manager is still locked awaiting the first user
 * gesture, defer via the manager's own `UNLOCKED` event (no custom gesture
 * UI); if `initialPct` is 0, playback never starts at all.
 */
export function initMusic(game: Phaser.Game, initialPct: number): void {
  activeGame = game;
  const sm = safeSoundManager();
  if (!sm) return;
  if (sm.locked && !unlockListenerAttached) {
    unlockListenerAttached = true;
    sm.once(SOUND_UNLOCKED_EVENT, () => {
      setMusicVolumePct(pendingPct);
    });
  }
  setMusicVolumePct(initialPct);
}

/**
 * Pinned contract (docs/v0.3-handoff.md "Music prefs"): 0 stops+releases
 * playback (no muted-but-decoding stream); >0 while stopped (re)starts the
 * loop at pct/100; >0 while already playing live-updates volume. Clamped +
 * rounded to an integer 0..100. Never throws when sound is unavailable.
 */
export function setMusicVolumePct(pct: number): void {
  const clamped = clampMusicPct(pct);
  pendingPct = clamped;
  const sm = safeSoundManager();
  if (!sm) return;

  if (clamped === 0) {
    stopAndReleaseMusic();
    return;
  }

  try {
    if (sm.locked) {
      // Can't produce audio yet — the UNLOCKED listener installed by
      // initMusic() replays `pendingPct` once the gesture lands.
      return;
    }
    if (!activeSound || !activeSound.isPlaying) {
      activeSound?.destroy();
      activeSound = sm.add(MUSIC_ASSET_KEY, { loop: true, volume: clamped / 100 });
      activeSound.play();
    } else {
      // BaseSound's type omits setVolume, but every concrete manager's sound
      // (WebAudio / HTML5 / NoAudio) implements it — narrow defensively.
      const sound = activeSound as Phaser.Sound.BaseSound & { setVolume?: (v: number) => unknown };
      sound.setVolume?.(clamped / 100);
    }
  } catch {
    // Defensive: audio must never break a scene (headless CI, unsupported
    // browser sound backend, etc.) — see handoff §7.
  }
}

function stopAndReleaseMusic(): void {
  try {
    activeSound?.stop();
    activeSound?.destroy();
  } catch {
    // Defensive — see setMusicVolumePct.
  }
  activeSound = null;
}

/** Test-only: drop the module singleton between vitest cases. */
export function __resetMusicForTests(): void {
  activeGame = null;
  activeSound = null;
  pendingPct = 0;
  unlockListenerAttached = false;
}
