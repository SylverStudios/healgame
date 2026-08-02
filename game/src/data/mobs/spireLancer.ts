import type { MobDef } from '../content/types';

export const SPIRE_LANCER_MOB = {
  id: 'spire-lancer',
  name: 'Spire Lancer',
  tags: ['boss'],
  hp: 260,
  // J26: raised tank auto (+floor +2 at order 2) is the Iron Pass kill lever —
  // the crown kit's Graven-Scale heals sustain the tank, the slow flat
  // efficiency heals lose it, so efficiency scrapes while crown clears clean.
  autoDamage: 6,
  swingIntervalMs: 3_500,
  abilityIds: ['tunnel-vision'],
  visualKey: 'spire-lancer',
  // Vowstrike teaching beat: crowns weaving Vowstrike clear before enrage;
  // heal-only wipes (no enough DPS); efficiency wipes (can't sustain tank).
  // 58_000ms: disciplined crown bots clear ~45-50s; heal-only bots run out of time.
  enrageAtMs: 58_000,
} as const satisfies MobDef;
