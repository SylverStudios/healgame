/**
 * Accumulate focused-tab wall-clock time into the telemetry log.
 */

import { addPlayMs } from './store';

const FLUSH_EVERY_MS = 15_000;

let installed = false;
let lastTickMs = 0;
let flushTimer: ReturnType<typeof setInterval> | null = null;

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function isVisible(): boolean {
  if (typeof document === 'undefined') return true;
  return document.visibilityState !== 'hidden';
}

function flush(): void {
  if (lastTickMs <= 0) return;
  const t = nowMs();
  if (isVisible()) {
    addPlayMs(t - lastTickMs);
  }
  lastTickMs = t;
}

function onVisibility(): void {
  flush();
}

export function installPlaytimeTracker(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  lastTickMs = nowMs();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', flush);
  flushTimer = setInterval(flush, FLUSH_EVERY_MS);
}

/** Test helper — stop listeners so suites don't leak timers. */
export function uninstallPlaytimeTracker(): void {
  if (!installed || typeof document === 'undefined') return;
  flush();
  document.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('pagehide', flush);
  if (flushTimer !== null) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  installed = false;
  lastTickMs = 0;
}
