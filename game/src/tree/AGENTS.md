# Skill tree — agent notes

Status: current · Authority: skill-tree service + live SPELL_TREE wiring · Last verified: 2026-07-14

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
| Save shape | `treeRanks`; level-derived unplaced talent points form the tree wallet |

`buildLoadout` in `meta/progression.ts` is a thin alias of `loadoutFromSave`.
Legacy `TREE_NODES` (`data/tree.ts`) is deprecated test-only data — do not
extend it.

## Rules of thumb

1. **Tune numbers in `SPELL_TREE`**, not in scenes or the engine. Every live
   node costs exactly one `talent` point; total point capacity equals level.
2. Multi-rank = spot **chain** (one content entry per purchase), not
   `maxRanks` / `amountPerRank` on the service.
3. Prerequisites: `requires: { mode: 'all' \| 'any', nodes }`. Spot chain order
   also gates later entries. Exactly one root (no requires, first in its spot).
4. Mutually exclusive choices use `exclusiveGroup`. This covers subclass
   oaths and Vigil's Patient Vow (power) vs Measured Devotion (efficiency).
   UI two-click arm remains scene-only for the subclass group.
5. **Forsaken-path consolation:** nodes with `availableIfExclusiveLocked: true`
   in a spot chain are offered when the natural next entry is `exclusive-locked`
   (e.g. `warped-tempo-via-zealot` on the zealot spot after swearing Vigil).
   The tree service skips forward; `spellTree.ts` owns effect kinds.
6. Combat never sees the graph — only `CombatMods` (`spells` with castMod
   baked in, `bonusMaxMana`, `synergies`, `missingHealthBonuses`,
   `paceMultipliersTenths`, `cooldowns`).
7. New interactive TreeScene controls need a stable `setName` (nodes are
   `treeNode:<spotId>`); journey clicks by name via `__healgame.locate` —
   do not reintroduce a coordinate table in `journey.mjs`.
8. **`grantCooldown` effect** (Alpha 0.1 §D6): `{ kind: 'grantCooldown';
   cooldownId: string }` resolves via `cooldownById` (`data/cooldowns.ts`)
   into `CombatMods.cooldowns` (deduped by id; unknown id ignored, same as an
   unknown `grantSpell` id).

## Tree layer 2 (Alpha 0.1 §D5)

Six 1-rank nodes sit below the existing branch rows, gated by an **any-of**
prereq (`requires: { mode: 'any', nodes: [...] }`) on either follow-up into
that branch — `vigil-patient-vow-1` OR `vigil-measured-devotion` for Vigil;
`zealot-fervent-chain-1` OR `zealot-steady-hands` for Zealot. `mode: 'any'`
is native to the tree service (`tree/types.ts` `NodeRequires`); no service
change was needed.

**TreeScene now scrolls.** The 960×540 base canvas (`main.ts`) had no room
left below the existing rows (deep-reserves 130 → oaths 260 → branch
follow-ups 400 → graven-scale 550, itself already past the fold). Layer 2
lives in world space at y 650 (4 passives) and y 800 (2 CD-grant nodes),
inside a `WORLD_HEIGHT = 900` camera bounds; HUD chrome (title, wallet,
status/feedback lines, back button) is pinned via `setScrollFactor(0)` so it
stays on-screen while tree content pans. Scroll input is mouse wheel only
(`this.input.on('wheel', ...)`, clamped `0..WORLD_HEIGHT-height`). Journey
reaches layer 2 by hovering a named tree control, wheeling to max scroll, then
`clickNamed('treeNode:vigil-deep-well')` (etc.) — `locate` converts world
bounds through camera scroll, so journey does not hard-code screen y.

## Gates

From `game/`: `npm run check` and `npm run smoke`. Tree/save/combat changes
also need `node scripts/journey.mjs`.
