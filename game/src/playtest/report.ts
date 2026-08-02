import {
  formatPlaytestLevelRange,
  toPlaytestLevelRange,
} from './curve';
import type { DungeonPlaytestResult } from './types';

/** Human-readable multi-line report for `npm run content -- playtest`. */
export function formatPlaytestReport(results: readonly DungeonPlaytestResult[]): string {
  const lines = [
    'Headless playtest curve (cards kit + chips + secondaries + chosen CDs)',
    '  god   = GCD-perfect, combo-aware (mend→heal), bias retry then level up',
    '  basic = random heals + idle gaps, simple chips (overheals freely)',
    '',
  ];
  for (const row of results) {
    const range = toPlaytestLevelRange(row);
    const label = formatPlaytestLevelRange(range) || 'uncleared';
    const god = row.godLevel === null ? '—' : `Lv${row.godLevel}`;
    const basic = row.basicLevel === null ? '—' : `Lv${row.basicLevel}`;
    lines.push(
      `${row.dungeonName} [${row.dungeonId}]: ${label}  (god ${god}, basic ${basic})`,
    );
  }
  return lines.join('\n');
}
