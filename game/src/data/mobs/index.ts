import { ASH_HUSK } from './ashHusk';
import { GATE_WARDEN_MOB } from './gateWarden';
import { HOLLOW_KING_MOB } from './hollowKing';
import type { MobDef } from '../content/types';

export { ASH_HUSK } from './ashHusk';
export { GATE_WARDEN_MOB } from './gateWarden';
export { HOLLOW_KING_MOB } from './hollowKing';

export const MOB_ORDER = ['ash-husk', 'gate-warden', 'hollow-king'] as const;

export const MOBS = [ASH_HUSK, GATE_WARDEN_MOB, HOLLOW_KING_MOB] as const satisfies readonly MobDef[];

export const MOB_REGISTRY: Readonly<Record<string, MobDef>> = Object.freeze(
  Object.fromEntries(MOBS.map((mob) => [mob.id, mob])),
);
