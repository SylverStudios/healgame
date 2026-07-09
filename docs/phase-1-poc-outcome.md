# Phase 1 outcome — PoC built and verified (2026-07-08)

**Read this if you're an agent joining the project.** It records what Phase 1
produced, how it was built, and the decisions you should not re-litigate.

## Outcome

The full PoC from [`poc-spec.md`](./poc-spec.md) §1 is playable in-browser:
tutorial → Ash Gate wipe → hub economy → XP auto-grant (Zealous Mending) →
gold tree node (Deep Reserves) → Ash Gate clear → 1 ruby → blind Vigil/Zealot
subclass split → The Maw (unwinnable Dungeon 2 sandbox). Single localStorage
save; restart wipes. Every §1 criterion is enforced by an automated gate —
see [`poc-qa.md`](./poc-qa.md) for the checklist, balance gates, and the §10
micro-choices that are now **decided** (level 2 at 10 XP, Deep Reserves node,
D2 unlocks on clear, healer untargetable, cast-time-is-busy-time + parallel
1s GCD, mana spent on cast completion).

Stack as locked in [`tech-options.md`](./tech-options.md): Phaser 3 +
TypeScript (strict) + Vite under `game/`. Temp art only (rects + text).

## What exists (map)

| Where | What |
|---|---|
| `game/src/combat/` | Pure deterministic TS combat engine — **no Phaser imports**. API documented in `game/src/combat/README.md`. Driven by `advance(dtMs)`; zero randomness; event log is reproducible. |
| `game/src/data/` | Every gameplay number as data: `constants.ts`, `spells.ts`, `encounters.ts` (Ash Gate, The Maw), `tree.ts` (base + branch nodes). |
| `game/src/meta/progression.ts` | Pure meta logic: `applyCombatResult`, `buildLoadout`, `purchaseNode`, `chooseSubclass`, `visibleTreeNodes`, `isDungeon2Unlocked`. |
| `game/src/save/save.ts` | `SaveData` + localStorage load/save/reset, injectable store for tests. |
| `game/src/scenes/` | Boot, Tutorial, Combat, Hub, Tree, Subclass. `CombatScene` exports the `CombatSceneData`/`CombatResult` contracts. |
| `game/src/ui/` | Bar, UnitSprite, SpellBar placeholder widgets. |
| `game/scripts/` | `smoke.mjs` (headless boot, fails on console errors), `journey.mjs` (full §1 journey with real clicks + save assertions). |

## Verification gates (all deterministic; all green at phase end)

1. `npm run check` — typecheck + ESLint + 75 Vitest tests + build.
2. `npm run smoke` — headless Chromium boot, zero console errors.
3. `node scripts/journey.mjs` — 13 save-state assertions across the §1 journey (~5 min).
4. `game/src/combat/balance.test.ts` — scripted-bot difficulty gates: no-heal
   wipes, naive overhealing wipes, perfect starting-kit play never cruises,
   full kit clears with ≥3 alive + Bonehowl landing, The Maw unwinnable.

## Key decisions & lessons (don't rediscover these)

- **Draft numbers were unplayable-in-reverse**: Gate Warden (15 HP) died
  before his first Bonehowl finished — the party cleared Ash Gate with zero
  healing. QA retuned to hp 55 / auto 3 / howl 3s+12s. Lesson: enemy-side
  numbers are QA-owned data, and the balance tests now pin the shape.
- **"Base kit must lose" is not tunable via boss HP**: fight length is
  merc-driven and identical across player kits, and a wipe requires all 4
  party members dead. The workable lever is bot quality (naive overhealer
  must lose; disciplined play may scrape). Don't try to re-tune for
  "perfect play always wipes pre-upgrades" — it provably also wipes the
  full kit.
- **Orchestration**: chunks 0/5 (scaffold, QA/integration) were done by the
  central agent; chunks 1–4 were delegated sequentially to Sonnet subagents
  with pinned public API contracts in the prompt (engine API, scene data
  shapes, file ownership lists, definition-of-done = the gates). All four
  landed first-try. Subagents correctly *report* cross-boundary gaps instead
  of fixing them (e.g. tree mana bonus not plumbed into `CombatSceneData`) —
  the central agent owns integration after each chunk.
- **`journey.mjs` clicks by coordinates** copied from scene layout constants;
  its `UI` table must be updated when scene layouts change.
- One commit per chunk/milestone gave clean revert points between subagents.

## Explicitly deferred (poc-spec §9 — still out)

Aegis/Wildbloom, procs, major cooldowns, hub buffs, party hotkeys, merc trees,
boss phases, respec, real UI/art (separate slice), audio, networking.

## Known nits (accepted, not bugs)

- Healer's mana text can kiss the unit above it in the party roster — legible,
  temp-art tier.
- `castSpell` on a target that dies mid-cast still spends mana (documented in
  the engine README).
- Playwright is pinned at 1.49.1 with its Chromium build installed via
  `npx playwright install chromium`.

## Document history

| Version | Date | Notes |
|---------|------|-------|
| v1 | 2026-07-09 | Phase 1 retrospective written at phase close |
