/**
 * Glance aggregate metrics from a playtest telemetry JSON export.
 *
 * Usage:
 *   npm run telemetry -- path/to/telemetry.json
 *   npm run telemetry -- -   # read stdin
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseTelemetryJson } from '../src/telemetry/store';
import { formatTelemetryGlance } from '../src/telemetry/summary';

const usage = `Usage:
  npm run telemetry -- <path-to-telemetry.json>
  npm run telemetry -- -`;

const arg = process.argv[2];
if (!arg) {
  console.error(usage);
  process.exit(1);
}

const raw =
  arg === '-'
    ? readFileSync(0, 'utf8')
    : readFileSync(resolve(arg), 'utf8');

const log = parseTelemetryJson(raw);
if (!log) {
  console.error('Invalid telemetry JSON (expected healgame-telemetry-v1 shape).');
  process.exit(1);
}

console.log(formatTelemetryGlance(log));
