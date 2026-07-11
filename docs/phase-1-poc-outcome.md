# Phase 1 outcome — PoC built and verified (2026-07-08)

Status: historical · Authority: none — Phase 1 retrospective only · Last verified: 2026-07-10

**Do not use as a live map.** Scenes, tree data, and progression APIs have
moved on (no SubclassScene; live tree is `SPELL_TREE` + `game/src/tree/`).
Start from [`CLAUDE.md`](../CLAUDE.md), [`AGENTS.md`](../AGENTS.md), and
[`game/src/tree/AGENTS.md`](../game/src/tree/AGENTS.md).

**Read this for Phase 1 lessons** — what shipped then, and decisions not to
re-litigate for that era.

## Outcome

The full PoC from [`poc-spec.md`](./poc-spec.md) §1 was playable in-browser at
phase close: tutorial → Ash Gate wipe → hub → XP auto-grant → gold tree node →
Ash Gate clear → ruby subclass → The Maw. Single localStorage save; restart
wipes. Gates and micro-choices: [`poc-qa.md`](./poc-qa.md).

Stack: Phaser 3 + TypeScript (strict) + Vite under `game/`
([`tech-options.md`](./tech-options.md)).

## What existed at phase close (superseded — see live code)

| Where | Then |
|---|---|
| `game/src/combat/` | Pure engine — still true; see `combat/README.md` |
| `game/src/data/` | constants, spells, encounters, early `tree.ts` |
| `game/src/meta/progression.ts` | rewards + early purchase/loadout helpers |
| `game/src/save/save.ts` | SaveData + localStorage |
| `game/src/scenes/` | Boot, Tutorial, Combat, Hub, Tree, **Subclass** (Subclass later deleted in Phase 2) |
| `game/scripts/` | smoke + journey |

**Live map today:** [`CLAUDE.md`](../CLAUDE.md) “Where things live”.

## Verification gates (all deterministic; all green at phase end)

1. `npm run check` — typecheck + ESLint + Vitest + build.
2. `npm run smoke` — headless Chromium boot, zero console errors.
3. `node scripts/journey.mjs` — save-state assertions across the journey.
4. `game/src/combat/balance.test.ts` — difficulty shape bots.

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
| v2 | 2026-07-10 | Marked historical; live map → CLAUDE.md / tree AGENTS |
