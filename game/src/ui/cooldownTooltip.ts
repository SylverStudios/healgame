import type { CooldownDef } from '../combat/types';
import type { TooltipLine } from './spellTooltip';

const NAME_LINE_COLOR = '#f2c14e';
const DEFAULT_LINE_COLOR = '#e8d8c8';

/** Pure cooldown tooltip content: effect copy plus explicit active duration and reuse timing. */
export function buildCooldownTooltipLines(cooldown: CooldownDef): TooltipLine[] {
  // Both manaCostReduction and healBonus carry a timed window (durationMs).
  // freeNextHeal is charge-based (no duration) — display as "Until next heal".
  const duration =
    cooldown.effect.kind === 'manaCostReduction' || cooldown.effect.kind === 'healBonus'
      ? `${cooldown.effect.durationMs / 1000}s`
      : 'Until next heal';

  return [
    { text: cooldown.name, color: NAME_LINE_COLOR },
    { text: cooldown.description, color: DEFAULT_LINE_COLOR },
    { text: `Duration: ${duration}`, color: DEFAULT_LINE_COLOR },
    { text: `Cooldown: ${cooldown.cooldownMs / 1000}s`, color: DEFAULT_LINE_COLOR },
  ];
}
