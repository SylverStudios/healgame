# Phase 2 handoff — combat feedback, spell tooltips, real spell tree

Status: historical · Authority: none — Phase 2 shipped · Last verified: 2026-07-10

**Shipped.** Do not re-run this mission. Live tree/combat contracts:
[`game/src/tree/AGENTS.md`](../game/src/tree/AGENTS.md),
[`game/src/combat/README.md`](../game/src/combat/README.md),
[`game/src/data/spellTree.ts`](../game/src/data/spellTree.ts). QA log:
[`poc-qa.md`](./poc-qa.md) (Phase 2 section).

Originally: central-agent handoff. `poc-spec.md` still won on Phase-1 scope;
**this doc won on Phase 2** and amended poc-spec §6 (subclass in-tree).

## Mission (completed)

Make combat legible (who attacked whom, what healed), make spells inspectable
(tooltips), and turn the flat node list into a real prerequisite tree with
functional branch effects — plus a research-only pixel-art pipeline chunk.

## Done means (all verified at phase close)

1. Combat: attacker lunge + `*` hit marker + green `+N` heal floats.
2. Spell tooltips reflect tree modifiers.
3. Tree node graph with edges, ranks, in-tree subclass oaths; SubclassScene gone.
4. Branch effects work in combat (engine-tested).
5. v1→v2 save migration.
6. Gates green: `check`, `smoke`, `journey.mjs`, balance tests.
7. `docs/research/pixel-art-pipeline.md` delivered.

## Chunks (historical ownership)

| id | what | owns |
|---|---|---|
| 0 | Save v2, tree model, spells, progression | `save/`, `data/`, `meta/` |
| 1 | Engine synergies + missing-health | `combat/` |
| 2 | Lunge, `*`, `+N`, tooltips | `CombatScene`, `ui/` |
| 3 | Tree graph, delete SubclassScene | `TreeScene`, Hub, keys |
| R | Pixel-art research | `docs/research/pixel-art-pipeline.md` |
| 4 | Journey rewrite + QA | `scripts/`, `docs/` |

## Pinned contracts → live files

Implemented types and APIs live in code — do not duplicate here:

| Concern | Source of truth |
|---------|-----------------|
| Save v2 + v1 migration | `game/src/save/save.ts` |
| Live spell tree config + combat resolve | `game/src/data/spellTree.ts` |
| Tree service (config / state / update / view) | `game/src/tree/` — see `AGENTS.md` |
| Legacy `TREE_NODES` (tests only) | `game/src/data/tree.ts` |
| Loadout / `loadoutFromSave` | `spellTree.ts`; `buildLoadout` alias in `meta/progression.ts` |
| Engine options + synergy rules | `game/src/combat/README.md`, `engine.ts`, `types.ts` |
| `CombatSceneData` | `game/src/scenes/CombatScene.ts` |

## Locked decisions (still in force unless a later phase amends)

- **Two subclasses** (Vigil, Zealot). No third path.
- **poc-spec §6 amended:** blind pick retired; oaths in the tree; rival LOCKED visible.
- **Tree shape / draft numbers:** see `SPELL_TREE` in `spellTree.ts` (authoritative).
- **Visual feedback / tooltip / tree layout:** as shipped in Phase 2 QA (`poc-qa.md`).
- **Balance gate shape** unchanged (tune data, not gates).

## Chunk R — pixel-art pipeline

Deliverable: [`docs/research/pixel-art-pipeline.md`](./research/pixel-art-pipeline.md).
Post-phase: Kenney Tiny Dungeon wired — see [`unit-art.md`](./unit-art.md).

## Non-goals (still reject unless reopened)

Third subclass; respec; Aegis/Wildbloom; procs/major CDs; hub buffs; party
hotkeys; audio; tree pan/zoom; networking.

## Document history

| Version | Date | Notes |
|---|---|---|
| v1 | 2026-07-09 | Compiled by /forge-goal |
| v2 | 2026-07-10 | Marked historical; code contracts → file refs |
