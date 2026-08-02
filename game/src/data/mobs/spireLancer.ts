import type { MobDef } from '../content/types';

export const SPIRE_LANCER_MOB = {
  id: 'spire-lancer',
  name: 'Spire Lancer',
  tags: ['boss'],
  hp: 340,
  // J26: raised tank auto (+floor +2 at order 2) is the Iron Pass kill lever —
  // the crown kit's Graven-Scale heals sustain the tank, the slow flat
  // efficiency heals lose it, so efficiency scrapes while crown clears clean.
  autoDamage: 6,
  swingIntervalMs: 3_500,
  abilityIds: ['tunnel-vision'],
  visualKey: 'spire-lancer',
  // Vowstrike teaching beat: players who only heal wipe here; weaving Vowstrike
  // (6s CD at 7 dmg) shortens the boss phase enough to clear before enrage.
  // 90_000ms chosen so the disciplined Zealot crown balance bot (~78s boss
  // phase) clears with room to spare. Retune once playtest bots + UI land.
  enrageAtMs: 90_000,
} as const satisfies MobDef;
