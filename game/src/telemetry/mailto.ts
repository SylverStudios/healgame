/**
 * Build Gmail compose URLs for playtest export. Full JSON is copied to the
 * clipboard when available; the email body leaves room for feedback, then a
 * summary plus the JSON when it fits under typical URL length limits.
 */

import { PLAYTEST_EMAIL } from './config';
import { loadTelemetry } from './store';
import { formatTelemetryJson, formatTelemetrySummary } from './summary';
import type { TelemetryLog } from './types';

/** Stay under common browser URL limits after encodeURIComponent. */
const MAX_MAILTO_BODY_CHARS = 1200;

export interface MailtoResult {
  ok: boolean;
  reason?: string;
  /** True when the full JSON was written to the clipboard. */
  copied: boolean;
  href?: string;
}

function isEmailConfigured(): boolean {
  return PLAYTEST_EMAIL.includes('@') && !PLAYTEST_EMAIL.includes('PLAYTEST_EMAIL_HERE');
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  return false;
}

function buildBody(log: TelemetryLog, copied: boolean): string {
  const summary = formatTelemetrySummary(log);
  const json = formatTelemetryJson(log);
  const header = 'Hey Aaron —\n\n(type your feedback here)\n\n--- playtest telemetry ---\n';

  const clipboardNote = copied
    ? '\n\n(Full JSON was copied to the clipboard — paste it below if missing.)\n'
    : '\n\n(Could not copy to clipboard — JSON may be truncated.)\n';

  let body = `${header}${summary}${clipboardNote}`;
  const remaining = MAX_MAILTO_BODY_CHARS - body.length;
  if (remaining > 80) {
    const slice = json.length <= remaining ? json : `${json.slice(0, remaining - 20)}\n…[truncated]`;
    body += `\n${slice}`;
  }
  return body.slice(0, MAX_MAILTO_BODY_CHARS);
}

/** Gmail web compose URL (opens in-browser; avoids the OS mail client). */
export function mailtoHref(log: TelemetryLog, copied: boolean): string {
  const subject = 'healgame feedback';
  const body = buildBody(log, copied);
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to: PLAYTEST_EMAIL,
    su: subject,
    body,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

/**
 * Copy full telemetry JSON and open Gmail compose in a new tab with a feedback
 * template (blank for writing + telemetry snapshot).
 */
export async function sendPlaytestMail(): Promise<MailtoResult> {
  if (!isEmailConfigured()) {
    return {
      ok: false,
      copied: false,
      reason: 'Playtest email is not configured yet.',
    };
  }

  const log = loadTelemetry();
  const json = formatTelemetryJson(log);

  // Open on the click gesture before awaiting clipboard — otherwise browsers
  // treat window.open as a blocked popup.
  const draft =
    typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;

  const copied = await copyText(json);
  const href = mailtoHref(log, copied);

  if (draft) {
    draft.location.replace(href);
  } else if (typeof window !== 'undefined') {
    window.location.href = href;
  }

  return { ok: true, copied, href };
}
