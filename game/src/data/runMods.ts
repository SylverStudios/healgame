/**
 * Display-only run modifiers for the StS-style top bar: sworn oath + permanent
 * relics. Combat effects still come from the tree loadout / engine `relics`
 * option — this module only assembles name/description for HUD tooltips.
 */

import type { SubclassId } from '../save/save';
import { TALENT_TREE, type TalentTreeContent } from './talentTree';
import { relicsById } from './relics';

export type RunModKind = 'oath' | 'relic';

/** One slot in the run-mods bar (oath or relic). */
export interface RunModDisplay {
  id: string;
  kind: RunModKind;
  name: string;
  description: string;
}

const OATH_NODE_ID: Record<SubclassId, string> = {
  vigil: 'vigil-oath',
  zealot: 'zealot-oath',
};

function treeContent(nodeId: string): TalentTreeContent | undefined {
  const node = TALENT_TREE.nodes.find((n) => n.id === nodeId);
  if (!node) return undefined;
  return node.content as TalentTreeContent;
}

/** Oath shown as a relic-like slot once the player has sworn a subclass. */
export function oathRunMod(subclass: SubclassId): RunModDisplay {
  const id = OATH_NODE_ID[subclass];
  const content = treeContent(id);
  return {
    id,
    kind: 'oath',
    name: content?.name ?? id,
    description: content?.description ?? '',
  };
}

/**
 * Ordered run mods for the HUD: oath first, then permanent relics.
 */
export function runModsFromSave(save: {
  subclass: SubclassId | null;
  relicIds: readonly string[];
}): RunModDisplay[] {
  const mods: RunModDisplay[] = [];
  if (save.subclass !== null) {
    mods.push(oathRunMod(save.subclass));
  }
  for (const relic of relicsById(save.relicIds)) {
    mods.push({
      id: relic.id,
      kind: 'relic',
      name: relic.name,
      description: relic.description,
    });
  }
  return mods;
}
