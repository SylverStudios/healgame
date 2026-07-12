import type { EncounterDef } from '../combat/types';
import { CONTENT_CATALOGS } from './content/catalogs';
import { compileAllDungeons } from './content/compile';

/** The sole live encounter assembly path. Validation failures surface during module loading. */
export const ENCOUNTERS: EncounterDef[] = compileAllDungeons(CONTENT_CATALOGS);

export const ENCOUNTER_BY_ID: ReadonlyMap<string, EncounterDef> = new Map(
  ENCOUNTERS.map((encounter) => [encounter.id, encounter]),
);

export function getEncounterById(id: string): EncounterDef | undefined {
  return ENCOUNTER_BY_ID.get(id);
}

function requiredEncounter(id: string): EncounterDef {
  const encounter = getEncounterById(id);
  if (encounter === undefined) {
    throw new Error(`Compiled live encounter "${id}" is missing from dungeonOrder`);
  }
  return encounter;
}

export const ASH_GATE = requiredEncounter('ash-gate');
export const IRON_PASS = requiredEncounter('iron-pass');
export const THE_MAW = requiredEncounter('the-maw');
