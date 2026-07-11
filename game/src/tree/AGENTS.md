# Skill tree — agent notes

Config-driven tree service (`game/src/tree/`) plus the live spell-tree data and
combat resolve (`game/src/data/spellTree.ts`). Phaser stays out of this folder.

## Mental model

```
TreeConfig  +  TreeState  →  update(action)  →  new state | reject + feedback
                          →  view()         →  TreeView (for UI)
                          →  ownedContents  →  flat content bag
                          →  resolveCombatMods / loadoutFromSave → CombatMods
```

- **Config** is pure data: nodes (cost, requires, exclusiveGroup, opaque
  `content`), spots (visual slots; `chain` length >1 = multi-unlock ranks).
- **State** is opaque — only this module reads/mutates it. Persist via
  `snapshot` / `restore`, or the live bridge in `spellTree.ts`
  (`treeStateFromLegacy` / `applyTreeStateToSave`).
- **Content is opaque to the tree.** Never branch on effect kinds inside
  `tree.ts`. UI and combat interpret `SpellTreeContent` in `spellTree.ts`.

## Live game wiring

| Concern | Where |
|---|---|
| Authoritative config | `SPELL_TREE` in `data/spellTree.ts` |
| Tree UI | `scenes/TreeScene.ts` — `view` + `layoutSpots` + `update` |
| Layout | `layoutSpots(treeView, { width, overrides? })` — overrides keep journey click coords |
| Fight start | `loadoutFromSave(save)` → `CombatMods` → `CombatScene` / engine options |
| Save shape | still `treeRanks` + gold/rubies; bridge converts ↔ owned chain ids |

`buildLoadout` in `meta/progression.ts` is a thin alias of `loadoutFromSave`.
Legacy `purchaseNode` / `TREE_NODES` (`data/tree.ts`) are deprecated test-only
paths — do not extend them.

## Rules of thumb

1. **Tune numbers in `SPELL_TREE`**, not in scenes or the engine.
2. Multi-rank = spot **chain** (one content entry per purchase), not
   `maxRanks` / `amountPerRank` on the service.
3. Prerequisites: `requires: { mode: 'all' \| 'any', nodes }`. Spot chain order
   also gates later entries. Exactly one root (no requires, first in its spot).
4. Subclass lockout = `exclusiveGroup` on the oath nodes; UI two-click arm is
   scene-only, not tree-service state.
5. Combat never sees the graph — only `CombatMods` (`spells` with castMod
   baked in, `bonusMaxMana`, `synergies`, `missingHealthBonuses`).
6. Changing TreeScene click positions → update the `UI` table in
   `scripts/journey.mjs`.

## Gates

From `game/`: `npm run check` and `npm run smoke`. Tree/save/combat changes
also need `node scripts/journey.mjs`.
