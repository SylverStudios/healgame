import { ASH_HUSK } from './ashHusk';
import { CHOIR_SHADE } from './choirShade';
import { CINDER_WRAITH } from './cinderWraith';
import { DIRGE_SOVEREIGN_MOB } from './dirgeSovereign';
import { EMBER_COLOSSUS_MOB } from './emberColossus';
import { GATE_WARDEN_MOB } from './gateWarden';
import { HOLLOW_KING_MOB } from './hollowKing';
import { IRON_HUSK } from './ironHusk';
import { SPIRE_LANCER_MOB } from './spireLancer';
import type { MobDef } from '../content/types';

export { ASH_HUSK } from './ashHusk';
export { CHOIR_SHADE } from './choirShade';
export { CINDER_WRAITH } from './cinderWraith';
export { DIRGE_SOVEREIGN_MOB } from './dirgeSovereign';
export { EMBER_COLOSSUS_MOB } from './emberColossus';
export { GATE_WARDEN_MOB } from './gateWarden';
export { HOLLOW_KING_MOB } from './hollowKing';
export { IRON_HUSK } from './ironHusk';
export { SPIRE_LANCER_MOB } from './spireLancer';

export const MOBS = [
  ASH_HUSK,
  IRON_HUSK,
  GATE_WARDEN_MOB,
  SPIRE_LANCER_MOB,
  HOLLOW_KING_MOB,
  CINDER_WRAITH,
  EMBER_COLOSSUS_MOB,
  CHOIR_SHADE,
  DIRGE_SOVEREIGN_MOB,
] as const satisfies readonly MobDef[];

export const MOB_REGISTRY: Readonly<Record<string, MobDef>> = Object.freeze(
  Object.fromEntries(MOBS.map((mob) => [mob.id, mob])),
);
