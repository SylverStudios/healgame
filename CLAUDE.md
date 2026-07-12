# CLAUDE.md — operating healgame

Status: current · Authority: gates, hard rules, working style · Last verified: 2026-07-12

healgame is a healer-focused auto-battler PoC: Phaser 3 + TypeScript (strict) +
Vite. The game lives in `game/`; design docs in `docs/`. Doc conventions and
authority hierarchy: [`AGENTS.md`](AGENTS.md).

## Doc authority (highest wins)

Full list in [`AGENTS.md`](AGENTS.md). Short form:

1. Active phase handoff (`Status: planning`) — wins that phase's scope
2. `docs/poc-spec.md` — PoC baseline (phase amendments in poc-qa / handoffs win)
3. `docs/poc-qa.md` — decided micro-choices + tuning log
4. Module docs — `game/src/tree/AGENTS.md`, `game/src/combat/README.md`
5. This file — gates and hard rules
6. Historical handoffs / `docs/tech-options.md` / `docs/GDD.md` / research — lower

## Commands (run from `game/`)

| Command | Purpose |
|---|---|
| `npm run dev` | Play at http://localhost:5173 |
| `npm run verify` | **The gate**: typecheck + lint + test + build + smoke + journey |
| `npm run verify:fast` | Same without journey (~5 min faster) |
| `npm run test:watch` | Vitest watch mode while developing |

`verify` is implemented by `scripts/verify.mjs` — one entry point for local
and CI. Passing stages print one line; failures dump captured output. Individual
stages (`npm run check`, `npm run smoke`, `node scripts/journey.mjs`) still
exist but prefer `verify`.

**Definition of done for any change:** `npm run verify:fast` passes at minimum.
If the change touches scenes, save shape, progression, or encounter/spell data,
run full `npm run verify`. Never commit red.

## Where things live

```
game/src/
  combat/   pure TS combat engine — NO Phaser, no wall clock, no Math.random.
            Public API + rule decisions: combat/README.md
  tree/     config-driven skill-tree service (opaque state, update/view).
            Agent contract: tree/AGENTS.md
  data/     ALL gameplay numbers as data: constants, spells, encounters,
            spellTree.ts (live SPELL_TREE + loadoutFromSave).
            tree.ts = legacy TREE_NODES (deprecated; tests only)
  meta/     pure progression (rewards, buildLoadout alias, dungeon unlock).
            purchaseNode is deprecated — TreeScene uses tree.update
  save/     SaveData + localStorage wrapper (injectable store for tests)
  scenes/   Phaser scenes; keys in scenes/keys.ts; CombatScene exports
            CombatSceneData / CombatResult
  ui/       placeholder widgets (Bar, UnitSprite, SpellBar)
  scripts/  verify.mjs (quality gate), smoke.mjs, journey.mjs (Playwright 1.49.1)
```

## Hard rules

- **Engine purity**: nothing under `src/combat/` or `src/data/` may import
  Phaser or read time/randomness. Simulation advances only via `advance(dtMs)`
  and must stay deterministic (same inputs → same event log).
- **Numbers are data**: gameplay values go in `src/data/`, never inline in
  scenes or engine code. Integers only, roughly 1–10 scale where possible.
- **Balance is pinned**: `src/combat/balance.test.ts` encodes the difficulty
  shape (no-heal wipes, naive overheal wipes, full kit clears, The Maw
  unwinnable). Retune data freely — but these gates decide if the tune ships.
- **Pure logic first**: meta/combat/tree behavior lives in tested pure
  functions; scenes are thin wiring that call them and `saveGame()`
  immediately after any mutation. New logic gets colocated `*.test.ts`.
- **Temp art only, one exception**: combat units render Kenney Tiny Dungeon
  16×16 tiles (CC0; sheet in `game/public/assets/`, unit→tile mapping in
  `game/src/ui/sprites.ts`, `pixelArt: true`). Everything else stays rects,
  bars, monospace text, dark palette (`#1a1210` bg) — reject polish creep.
- **Scope discipline**: poc-spec §9 lists what stays out (procs, major CDs,
  hub buffs, respec, Aegis/Wildbloom, party hotkeys, networking…). Reject
  additions unless the user explicitly reopens scope.
- **Layout constants ↔ journey.mjs**: scene click targets are duplicated in
  the `UI` table at the top of `scripts/journey.mjs`. Changing a scene layout
  means updating that table (journey failing on a save assertion right after
  a layout change is almost always this).
- **Save changes**: `SaveData` is versioned (`healgame-save-v1`); if the shape
  changes, bump the version and keep `loadSave` falling back to a fresh save
  on unrecognized data.

## Working style (user preferences)

- **Central agent delegates**: big work is cut into chunks with pinned public
  API contracts, explicit file-ownership lists, and definition-of-done = the
  gates above. Subagents (Sonnet-class) get one chunk at a time, sequentially
  when they'd touch shared files. The central agent verifies gates itself
  after every chunk ("trust but verify"), owns cross-boundary integration,
  and commits one checkpoint per chunk.
- **Determinism over vibes**: prefer writing a script/test that proves a
  behavior over eyeballing it. Screenshots (smoke/journey `--shots`) are for
  visual review; assertions are for correctness.
- **When balance-tuning**: don't hand-derive fight math — add a scripted-bot
  diagnostic, read the telemetry, tune data, delete the diagnostic. Remember
  fight length is merc-driven (identical across player kits) and a wipe needs
  all 4 party members dead; boss HP alone can't separate base-kit from
  full-kit outcomes.
- Commit messages: what + why, one milestone per commit.
