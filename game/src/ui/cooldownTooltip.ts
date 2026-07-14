import type { CooldownDef } from '../combat/types';
import type { TooltipLine } from './spellTooltip';

const NAME_LINE_COLOR = '#f2c14e';
const DEFAULT_LINE_COLOR = '#e8d8c8';

/** Pure cooldown tooltip content: effect copy plus explicit active duration and reuse timing. */
export function buildCooldownTooltipLines(cooldown: CooldownDef): TooltipLine[] {
  const duration =
    cooldown.effect.kind === 'manaCostReduction'
      ? `${cooldown.effect.durationMs / 1000}s`
      : 'Until next heal';

  return [
    { text: cooldown.name, color: NAME_LINE_COLOR },
    { text: cooldown.description, color: DEFAULT_LINE_COLOR },
    { text: `Duration: ${duration}`, color: DEFAULT_LINE_COLOR },
    { text: `Cooldown: ${cooldown.cooldownMs / 1000}s`, color: DEFAULT_LINE_COLOR },
  ];
}
