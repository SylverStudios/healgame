# Skill tree — agent notes

Status: current · Authority: skill-tree service + live TALENT_TREE wiring · Last verified: 2026-07-18

Config-driven tree service (`game/src/tree/`) plus the live talent-tree data and
combat resolve (`game/src/data/talentTree.ts`). Phaser stays out of this folder.

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
  `snapshot` / `restore`, or the live bridge in `talentTree.ts`
  (`treeStateFromLegacy` / `applyTreeStateToSave`).
- **Content is opaque to the tree.** Never branch on effect kinds inside
  `tree.ts`. UI and combat interpret `TalentTreeContent` in `talentTree.ts`.

## Live game wiring

| Concern | Where |
|---|---|
| Authoritative config | `TALENT_TREE` in `data/talentTree.ts` |
| Tree UI | `scenes/TreeScene.ts` — round glyph nodes (`NODE_RADIUS`), hover tooltips, `view` + `layoutSpots` + `update` |
| Layout | `layoutSpots(treeView, { width, overrides? })` — overrides keep journey click coords |
| Fight start | `loadoutFromSave(save)` → `CombatMods` → `CombatScene` / engine options |
| Save shape | `treeRanks`; level-derived unplaced talent points form the tree wallet |

`buildLoadout` in `meta/progression.ts` is a thin alias of `loadoutFromSave`.
Legacy `TREE_NODES` (`data/tree.ts`) is deprecated test-only data — do not
extend it.

## Rules of thumb

1. **Tune numbers in `TALENT_TREE`**, not in scenes or the engine. Every live
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
   The tree service skips forward; `talentTree.ts` owns effect kinds.
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

## Tree topology — v0.3 lattice (retires the Alpha 0.2 hourglass)

Same node ids, same `requires`/`exclusiveGroup` graph as Alpha 0.2 (see
`docs/v0.3-handoff.md` → "Lattice tree" for why the graph shape didn't need
to change: the existing oath fork → shared mid → Vowstrike fork → dual-crown
shape already *is* a lattice of overlapping chains once redrawn on a grid —
the "hourglass" was a description of the old pixel layout, not the graph).
v0.3 adds: integer `{ col, row }` grid coordinates per spot (`SpotDef.grid`,
data only — no pixels), `minLevel` gates on the two crowns, and a pure
`buildGlyphFromTree` reduction. Root is column 0 (the lattice's single
corner); rows fan out from it:

```
row0 (Vigil spine):    vigil-oath ── vigil-patient-vow ── vigil-thrift ──────────────┐
                             │             │                                          │
row1 (Vigil lane):           vigil-measured-devotion   vigil-still-waters ─┐          │
                                                          (graven-scale     │          │
                                                           spur: row -1)    ├─ shared-mend-potency ─┐
row2 (Shared spine):   deep-reserves (ROOT, col0)                          │                        ├─ vowstrike-virtue ─┐
                             │             │                               │                        │                    │
row3 (Zealot lane):          zealot-steady-hands   zealot-frenzied-liturgy─┘          ┌─ shared-zealous-potency ─┤       ├─ CROWN-V (wrath-ascendant, minLevel 10)
                             │             │                                          │                          │       │
row4 (Zealot spine):   zealot-oath ── zealot-fervent-chain ── zealot-quick-breath ────┘                  vowstrike-vengeance ┴─ CROWN-Z (vowbound-crown, minLevel 12)
```

(Not to scale — see `TALENT_TREE.spots[].grid` in `data/talentTree.ts` for
the authoritative `{ col, row }` per spot; `vigil-graven-scale` sits at
`{ col: 3, row: -1 }`, a genuine dead-end spur above the Vigil spine.) Both
crowns stay reachable from *either* oath via the shared Vowstrike fork —
unchanged from Alpha 0.2 and required by the pinned journey sequence (buy
Wrath Ascendant *and* Vowbound Crown from one Vigil-only seed).

**Oath exclusive lock**: `vigil-oath` and `zealot-oath` share
`exclusiveGroup: 'subclass'`. Owning one permanently locks the other's entry
node. The rival spot still offers a forsaken-path consolation
(`warped-tempo-via-vigil` / `warped-tempo-via-zealot`,
`availableIfExclusiveLocked: true`) — its own `spot.status` reads
`affordable` for that reward even while the structural edge into the primary
(locked) node reads `locked` in `TreeView.edges` (see "Edge states" below).

**Removed in Alpha 0.2**: `vigil-deep-well` and `zealot-spendthrift-grace` (pure-mana pads).
Legacy saves that held these nodes simply drop them on load (unknown ids not emitted by
`ownedIdsFromLegacyRanks`).

### Level gates (`minLevel`, v0.3)

The **one** sanctioned new primitive: `NodeDef.minLevel?: number` (positive
integer; validated by `validateConfig`). Enforced only when the caller
supplies a level:

- `update(config, state, { type: 'purchase', spotId, level })` — rejects with
  `reason: 'level-too-low'` when `level < node.minLevel`. Omitting `level`
  entirely (not `level: undefined` — `exactOptionalPropertyTypes` forbids
  that) does **not** enforce the gate (back-compat: most existing tests and
  configs never pass level).
- `view(config, state, level?)` — same bypass-when-omitted rule; a
  level-gated `next` node folds into the existing `'locked'` `SpotStatus`
  (no new status was added — `NodeView.minLevel` is exposed so UI can tell
  "prereqs unmet" from "level too low" and word the tooltip accordingly).

Live values: `wrath-ascendant` → `minLevel: 10`; `vowbound-crown` →
`minLevel: 12` (ascending per the handoff; picked so the journey's B3 seed at
`xp: 660` → level 12 clears both). `TreeScene` passes
`levelForXp(save.xp)` into every `view`/`update` call.

### Edge states (`TreeView.edges[].state`, v0.3)

`TreeView.edges` now carries an `EdgeState` per config-derived edge —
`'traversed' | 'available' | 'locked' | 'inactive'` — for chunk D to draw
bright/dim/destroyed/greyed edges without re-deriving ownership logic:

| State | Meaning |
|---|---|
| `traversed` | Both the edge's source and destination spots have an owned node. |
| `locked` | The edge's destination **node** (the spot's first chain entry — the one whose `requires` produced this edge) is exclusive-locked by a rival pick. Checked at the node level, not spot `status`, so it stays `locked` even after a forsaken-path consolation on that same spot is bought. |
| `available` | Source spot owned, destination not, and not `locked` — a reachable next step. |
| `inactive` | Source spot not owned yet — this route hasn't been reached. |

`locked` is checked before `traversed`/`available` (see `edgeState` in
`tree.ts`).

### Build glyph (`buildGlyphFromTree`, v0.3 → chunk D/E)

`tree/glyph.ts` exports the pinned contract:

```ts
export type BuildGlyph = {
  id: string; // stable hash (FNV-1a) of the sorted owned edge-key set
  segments: ReadonlyArray<{ x1: number; y1: number; x2: number; y2: number }>;
};
export function buildGlyphFromTree(config: TreeConfig, ownedNodeIds: ReadonlySet<string>): BuildGlyph;
```

Pure, no Phaser/Date/Math.random. An edge counts as owned/traversed when (a)
it exists in the lattice — the destination spot's first chain node
`requires` the specific source node — and (b) **both** the specific source
node and the destination's first chain node are in `ownedNodeIds` (node-level,
same reasoning as the `locked` edge state above: a spot owned only via a
forsaken-path consolation doesn't count as having traversed its primary
entry route). Segments use each spot's `grid` coords directly as `x`/`y` (no
pixel scale — chunk D applies its own). Config traversal order is fixed
(iterates `config.spots` then each node's `requires.nodes` in declared
order), so the result is deterministic regardless of `ownedNodeIds`'s
(unordered) `Set` insertion order. Spots without `grid` are silently skipped
(defensive default for configs — including test fixtures — that don't
populate coordinates).

## New effect kinds (Alpha 0.2 §D5/D6)

`TalentTreeEffect` gains two new members:

| Kind | Shape | Resolved in |
|------|-------|-------------|
| `castMod` (extended) | `healDelta?: number` optional field | `resolveCombatMods` bakes `spell.heal += healDelta ?? 0` after `castMs`/`mana` |
| `ampOwnedSpells` | `{ spellIds: string[]; healDelta?: number; damageDelta?: number }` | After castMod baking: for each id already in the loadout, adds deltas to spell.heal / spell.damage (clamp ≥ 0) |

`TalentTreeContent` gains optional `glyph?: string` (single char for tree node display, §D8).

`CombatMods` gains optional `manaRegen?: { amount: number; intervalMs: number }` (§D2).

## Level mana in loadoutFromSave (§D2)

`loadoutFromSave` now accepts `xp?: number`. It calls `manaBonusesForLevel` (from
`data/levelMana.ts`) and adds the result on top of tree/relic bonuses:

```ts
mods.bonusMaxMana += levelMana.bonusMaxMana;
if (levelMana.manaRegen !== null) mods.manaRegen = levelMana.manaRegen;
```

**Circular-import resolution**: `manaBonusesForLevel` lives in `data/levelMana.ts`
(imports only `data/constants.ts`) and is re-exported from `meta/progression.ts`
for backward compatibility. `data/talentTree.ts` imports from `data/levelMana.ts`
directly — no cycle.

## Oath × Vowstrike twists (§D5)

`applyOathVowstrikeTwists(mods, contents)` is called at the end of
`resolveCombatMods`. Detects oath via `subclass` tag or `grantSpell` ids,
detects aspect via owned spell ids in mods, then applies:

| Oath × Aspect      | Twist applied to mods                              |
|--------------------|----------------------------------------------------|
| Vigil × Virtue     | vowstrike-virtue `mana −1`                         |
| Vigil × Vengeance  | vowstrike-vengeance `damage +1`, next-heal potency `+15`  |
| Zealot × Virtue    | `synergy` trigger vowstrike-virtue→zealous-mending +1 |
| Zealot × Vengeance | vowstrike-vengeance `damage +1`                            |

## Tree layer 2 (Alpha 0.1 §D5, trimmed in Alpha 0.2, unchanged in v0.3)

Retained output/tempo nodes require `mode: 'any'` on either branch follow-up:
- Vigil: thrift, still-waters (gate: patient-vow-1 OR measured-devotion)
- Zealot: quick-breath, frenzied-liturgy (gate: fervent-chain-1 OR steady-hands)

**TreeScene no longer scrolls (v0.3 chunk D).** The lattice (cols 0-6,
rows -1..4) fits the fixed 960×540 canvas: pixel positions come from
`layoutFromGrid(SpotDef.grid, spacing)` in `tree/layout.ts`
(GRID_LEFT 90, GRID_COL_WIDTH 130, GRID_TOP 176, GRID_ROW_HEIGHT 70 — see
`TreeScene.ts`). The old `TALENT_TREE_POSITIONS` pixel table and the
wheel-scroll world are deleted. Edges render from `TreeView.edges` with four
states (traversed bright · available dim amber · inactive faint ·
locked dark-red broken X); crowns carry `Lv N` tags; a small BUILD glyph
preview (drawn via `ui/buildGlyph.ts`) sits in the top-left HUD. Journey
still clicks nodes purely by name (`treeNode:<spotId>`), no scrolling.

## Gates

From `game/`: `npm run check` and `npm run smoke`. Tree/save/combat changes
also need `node scripts/journey.mjs`.
