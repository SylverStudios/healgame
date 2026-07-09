# CLAUDE.md — operating healgame

healgame is a healer-focused auto-battler PoC: Phaser 3 + TypeScript (strict) +
Vite. The game lives in `game/`; design docs in `docs/`.

## Doc authority (highest wins)

1. `docs/poc-spec.md` — the build bible for PoC-scope questions
2. `docs/poc-qa.md` — decided micro-choices + tuning log (don't re-decide these)
3. `docs/phase-1-poc-outcome.md` — what exists, key lessons, deferred scope
4. `docs/tech-options.md` — stack rationale; `docs/GDD.md` — long-term context only

## Commands (run from `game/`)

| Command | Purpose |
|---|---|
| `npm run dev` | Play at http://localhost:5173 |
| `npm run check` | **The gate**: typecheck + ESLint + all Vitest tests + build |
| `npm run smoke` | Headless Chromium boot; fails on any console error |
| `node scripts/journey.mjs` | Full player-journey e2e with save assertions (~5 min) |
| `npm run test:watch` | Vitest watch mode while developing |

**Definition of done for any change:** `check` + `smoke` pass. If the change
touches scenes, save shape, progression, or encounter/spell data, run
`journey.mjs` too. Never commit red.

## Where things live

```
game/src/
  combat/   pure TS combat engine — NO Phaser imports, no wall clock, no Math.random.
            Public API + rule decisions: game/src/combat/README.md
  data/     ALL gameplay numbers as data (constants, spells, encounters, tree)
  meta/     pure progression logic (rewards, loadout, purchases, subclass)
  save/     SaveData + localStorage wrapper (injectable store for tests)
  scenes/   Phaser scenes; keys in scenes/keys.ts; CombatScene exports the
            CombatSceneData / CombatResult contracts other scenes call it with
  ui/       placeholder widgets (Bar, UnitSprite, SpellBar)
  scripts/  smoke.mjs, journey.mjs (Playwright, pinned 1.49.1)
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
- **Pure logic first**: meta/combat behavior lives in tested pure functions;
  scenes are thin wiring that call them and `saveGame()` immediately after
  any mutation. New logic gets colocated `*.test.ts` (Vitest).
- **Temp art only**: rects, bars, monospace text, dark palette (`#1a1210` bg).
  Real UI/art is a separate future slice — reject polish creep.
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
