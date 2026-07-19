# CLAUDE.md — operating healgame

Status: current · Authority: gates, hard rules, working style · Last verified: 2026-07-18

healgame is a healer-focused auto-battler: Phaser 3 + TypeScript (strict) +
Vite. The game lives in `game/`; design docs in `docs/`. Doc conventions and
authority hierarchy: [`AGENTS.md`](AGENTS.md). Ship history:
[`docs/CHANGELOG.md`](docs/CHANGELOG.md).

## Doc authority (highest wins)

Full list in [`AGENTS.md`](AGENTS.md). Short form:

1. Active phase handoff (`Status: planning`) — wins that phase's scope
2. `docs/poc-spec.md` — PoC baseline (phase amendments in poc-qa / handoffs win)
3. `docs/poc-qa.md` — decided micro-choices + tuning log
4. Module docs — `game/src/tree/AGENTS.md`, `game/src/combat/README.md`,
   `game/src/data/README.md`
5. This file — gates and hard rules
6. `docs/CHANGELOG.md` / `docs/GDD.md` / research — lower

## Commands (run from `game/`)

| Command | Purpose |
|---|---|
| `npm run dev` | Play at http://localhost:5173 |
| `npm run verify` | **The gate**: typecheck + lint + test + build + smoke + journey |
| `npm run verify:fast` | Same without journey (~5 min faster) |
| `npm run test:watch` | Vitest watch mode while developing |
| `npm run content -- validate` | Validate all dungeon, mob, and enemy-ability data |
| `npm run content -- list` | List dungeon order and unlock prerequisites |
| `npm run content -- preview <id>` | Print one resolved dungeon definition |
| `npm run content -- preview --all` | Print the resolved ordered dungeon catalog |

`verify` is implemented by `scripts/verify.mjs` — one entry point for local
and CI. Passing stages print one line; failures dump captured output. Individual
stages (`npm run check`, `npm run smoke`, `node scripts/journey.mjs`) still
exist but prefer `verify`.

A pre-commit hook (`.githooks/`, wired by `npm install` via the `prepare`
script) runs typecheck + lint as a fast local backstop; CI runs the full gate.

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
  data/     ALL gameplay numbers as data: constants, spells, typed enemy
            abilities/mobs/dungeons compiled into encounters, talentTree.ts
            (live TALENT_TREE + loadoutFromSave). Authoring: data/README.md
            tree.ts = legacy TREE_NODES (deprecated; tests only)
  meta/     pure progression (rewards, buildLoadout alias, dungeon unlock).
            purchaseNode is deprecated — TreeScene uses tree.update
  save/     SaveData + localStorage wrapper (injectable store for tests)
  scenes/   Phaser scenes; keys in scenes/keys.ts; CombatScene exports
            CombatSceneData / CombatResult
  ui/       placeholder widgets (Bar, UnitSprite, SpellBar)
  debug/    journey test hooks (`window.__healgame.locate` / `list`)
  scripts/  verify.mjs (quality gate), smoke.mjs, journey.mjs (Playwright 1.49.1)
```

## Hard rules

- **Engine purity**: nothing under `src/combat/` or `src/data/` may import
  Phaser or read time/randomness. Simulation advances only via `advance(dtMs)`
  and must stay deterministic (same inputs → same event log). Lint-enforced:
  `eslint.config.js` bans `phaser` imports and `Math.random` / `Date.now` /
  `performance.now` under combat, data, tree, meta, and save.
- **Numbers are data**: gameplay values go in `src/data/`, never inline in
  scenes or engine code. Integers only, roughly 1–10 scale where possible.
- **Balance is pinned**: `src/combat/balance.test.ts` encodes the difficulty
  shape (no-heal wipes, naive overheal wipes, full kit clears, The Maw
  unwinnable). Retune data freely — but these gates decide if the tune ships.
- **Pure logic first**: meta/combat/tree behavior lives in tested pure
  functions; scenes are thin wiring that call them and `saveGame()`
  immediately after any mutation. New logic gets colocated `*.test.ts`.
- **Temp art only, few exceptions**: combat units render Kenney Tiny Dungeon
  16×16 tiles (CC0; sheet in `game/public/assets/`, unit→tile mapping in
  `game/src/ui/sprites.ts`, `pixelArt: true`) plus PixelLab party/trash
  stills; the party healer is the 32×32 armored-paladin sheet
  (`assets/units/healer/`, source in `art/source/armored-paladin/`); heal
  VFX uses the user-authored sheet (`heal-vfx.png`); relic icons are
  hand-authored 32×32 stills (`assets/relics/`, `ui/relicSprites.ts`); and
  background audio is a placeholder generated loop (`assets/audio/`, see its
  README). Target density for new character art is **32×32** (bosses may be
  larger canvases at the same density). Everything else stays rects, bars,
  monospace text, dark palette (`#1a1210` bg) — reject polish creep.
- **Scope discipline**: reject additions outside the active planning handoff
  (or, if none, outside what [`docs/CHANGELOG.md`](docs/CHANGELOG.md) and
  [`docs/poc-qa.md`](docs/poc-qa.md) already shipped). poc-spec §9 is the PoC
  baseline out-list; Alpha reopened major CDs, mid dungeons, relics, and
  loadout. Still out unless explicitly reopened: procs, hub buffs, respec,
  Aegis/Wildbloom, party-target hotkeys, networking, polished final art.
- **Interactive objects ↔ journey.mjs**: every clickable/hoverable GameObject
  a journey stage may aim at carries a stable `setName(...)` (see the table in
  [`docs/semantic-targets.md`](docs/semantic-targets.md)).
  Journey resolves via `window.__healgame.locate(name)` — layout changes must
  **not** require journey coordinate edits. Adding a new interactive control
  means naming it and clicking it by name.
- **Save changes**: `SaveData` is versioned (`healgame-save-v8`); during
  development, shape changes rotate the key and `loadSave` deletes stale or
  unrecognized data instead of migrating it.

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
