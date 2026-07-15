# Skill tree — agent notes

Status: current · Authority: skill-tree service + live SPELL_TREE wiring · Last verified: 2026-07-15 (chunk 4)

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

## Tree topology — Alpha 0.2 hourglass (§D1)

```
[Shared early]   deep-reserves ×3 (was 5; ids deep-reserves-1..3)
       │
  Vigil │ Zealot  exclusiveGroup: subclass
       │
[Oath wedge]     branch follow-ups; pure-mana nodes cut (deep-well / spendthrift-grace)
       │
[Shared mid]     shared-mend-potency / shared-zealous-potency
                 requires: { mode: 'any', nodes: [vigil-patient-vow-1, vigil-measured-devotion,
                                                  zealot-fervent-chain-1, zealot-steady-hands] }
       │
 Virtue │ Vengeance  exclusiveGroup: vowstrike-aspect
       │
[Crown]          wrath-ascendant / vowbound-crown
                 requires: { mode: 'any', nodes: [vowstrike-virtue, vowstrike-vengeance] }
```

**Removed in Alpha 0.2**: `vigil-deep-well` and `zealot-spendthrift-grace` (pure-mana pads).
Legacy saves that held these nodes simply drop them on load (unknown ids not emitted by
`ownedIdsFromLegacyRanks`).

## New effect kinds (Alpha 0.2 §D5/D6)

`SpellTreeEffect` gains two new members:

| Kind | Shape | Resolved in |
|------|-------|-------------|
| `castMod` (extended) | `healDelta?: number` optional field | `resolveCombatMods` bakes `spell.heal += healDelta ?? 0` after `castMs`/`mana` |
| `ampOwnedSpells` | `{ spellIds: string[]; healDelta: number }` | After castMod baking: for each id already in the loadout, adds `healDelta` to spell.heal (clamp ≥ 0) |

`SpellTreeContent` gains optional `glyph?: string` (single char for tree node display, §D8).

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
for backward compatibility. `data/spellTree.ts` imports from `data/levelMana.ts`
directly — no cycle.

## Oath × Vowstrike twists (§D5)

`applyOathVowstrikeTwists(mods, contents)` is called at the end of
`resolveCombatMods`. Detects oath via `subclass` tag or `grantSpell` ids,
detects aspect via owned spell ids in mods, then applies:

| Oath × Aspect      | Twist applied to mods                              |
|--------------------|----------------------------------------------------|
| Vigil × Virtue     | vowstrike-virtue `mana −1`                         |
| Vigil × Vengeance  | `missingHealthBonus` healPer10PctMissing +1        |
| Zealot × Virtue    | `synergy` trigger vowstrike-virtue→zealous-mending +1 |
| Zealot × Vengeance | vowstrike-vengeance `heal +1`                      |

## Tree layer 2 (Alpha 0.1 §D5, trimmed in Alpha 0.2)

Retained output/tempo nodes require `mode: 'any'` on either branch follow-up:
- Vigil: thrift, still-waters (gate: patient-vow-1 OR measured-devotion)
- Zealot: quick-breath, frenzied-liturgy (gate: fervent-chain-1 OR steady-hands)

**TreeScene now scrolls.** `WORLD_HEIGHT = 1080`; max scroll = 1080 − 540 = 540.
All rows including the crown (y ≈ 960) are reachable at maximum scroll.
HUD chrome is pinned via `setScrollFactor(0)`. Journey reaches deep nodes by
wheeling to scroll and clicking by name (`treeNode:<spotId>`).

Row layout in `SPELL_TREE_POSITIONS` (y centers, 960px canvas):

| y   | spots                                                             |
|-----|-------------------------------------------------------------------|
| 125 | `deep-reserves`                                                   |
| 235 | `vigil-oath` (x 260) · `zealot-oath` (x 700)                     |
| 355 | `vigil-patient-vow` (x 150) · `vigil-measured-devotion` (x 380) · `zealot-fervent-chain` (x 590) · `zealot-steady-hands` (x 820) |
| 480 | `vigil-graven-scale` (x 150)                                      |
| 600 | `vigil-thrift` (x 160) · `vigil-still-waters` (x 375) · `zealot-quick-breath` (x 585) · `zealot-frenzied-liturgy` (x 800) |
| 720 | `shared-mend-potency` (x 320) · `shared-zealous-potency` (x 640) |
| 840 | `vowstrike-virtue` (x 260) · `vowstrike-vengeance` (x 700)       |
| 960 | `wrath-ascendant` (x 360) · `vowbound-crown` (x 600)             |

## Gates

From `game/`: `npm run check` and `npm run smoke`. Tree/save/combat changes
also need `node scripts/journey.mjs`.
