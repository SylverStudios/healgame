# PoC QA — journey checklist & verification

Status: current · Authority: decided micro-choices + QA log · Last verified: 2026-07-10

**Date:** 2026-07-08 · **Verdict: PoC complete.** Every poc-spec §1 criterion is
implemented, and all of them are enforced by automated gates that run headless.
(Phase 2 amended subclass UX — see checklist row 7 and Phase 2 section below.)

## How to run

```bash
cd game
npm install
npm run dev      # → http://localhost:5173
```

Verification gates (all must pass, all deterministic):

| Command | What it proves |
|---|---|
| `npm run check` | typecheck (strict TS) + ESLint + all Vitest tests + production build |
| `npm run smoke` | game boots in headless Chromium with zero console errors |
| `node scripts/journey.mjs` | full player journey with real clicks/hotkeys, asserting on the save between stages (~5 min) |

## poc-spec §1 checklist

| # | Criterion | Status | Enforced by |
|---|-----------|--------|-------------|
| 1 | Tutorial: click to learn Solemn Mend | ✅ | journey stage A |
| 2 | Ash Gate → expected wipe → hub with gold + XP | ✅ | journey stage A + `balance.test.ts` (naive healing wipes) |
| 3 | Hub readable on second visit (gold/XP/level/rubies, buttons) | ✅ | journey screenshots |
| 4 | Level ding auto-grants Zealous Mending, no spend UI | ✅ | journey stage A2 + progression tests |
| 5 | Gold spend unlocks one tree node (Deep Reserves) | ✅ | journey stage B + progression tests |
| 6 | Ash Gate clearable → 1 ruby on first clear only | ✅ | `balance.test.ts` (full-kit bot wins) + progression tests (ruby once) |
| 7 | Ruby → Vigil/Zealot oath **in the tree** (descriptions visible); rival LOCKED (not hidden); no respec | ✅ | journey stage B + tree/progression tests |
| 8 | Dungeon 2 (The Maw): overpowered boss, endless sandbox | ✅ | journey stage C + `balance.test.ts` (full-kit bot wipes) |

Also verified: save persists everything across reloads; restart wipes the save
(two-click confirm); wipes bank gold/XP; replays never re-grant the ruby.

## Difficulty shape (balance.test.ts pins these permanently)

Scripted bots run the real engine deterministically:

- **No healing** → wipe. The healer must matter.
- **Naive spam-healing** (overheal freely) on the starting kit → wipe. This is
  the spec's expected first run — wasted mana loses the run (§4.1).
- **Perfect zero-overheal play** on the starting kit → never a comfortable
  clear (wipe, or OOM scrape-through with ≤2 survivors at best).
- **Full PoC kit** (Zealous Mending + Deep Reserves) with disciplined play →
  victory with ≥3 alive, and the Bonehowl telegraph lands during the fight.
- **The Maw** → wipe even with the full kit and perfect play.

## Tuning changes from poc-spec §4.2 drafts (all QA-driven, spec marks them tunable)

| Value | Draft | Tuned | Why |
|---|---|---|---|
| Gate Warden HP | (unspecified) 15 | **55** | at 15 the boss died before the first Bonehowl finished; party won with zero healing |
| Gate Warden auto | 2 | **3** | at 2 the fight never threatened even a heal-less party |
| Bonehowl timing | first 5s / every 15s | **first 3s / every 12s** | telegraph must land 1–2× inside a ~30s boss fight |

## Micro-choices made (poc-spec §10)

1. Level 2 at **10 XP**.
2. Gold tree node: **Deep Reserves** — +5 max mana, 5 gold.
3. Dungeon 2 unlocks **after Ash Gate first clear** (spec's preference).
4. Healer is **never targeted** by enemies in PoC.
5. Cast time is the busy time; GCD 1s runs in parallel (`max(cast, GCD)`),
   one-slot spell queue re-validated when busy ends. Mana spent on cast
   **completion**.
6. Subclass branch nodes (Deep Focus / Battle Fervor) reuse the +5 max mana
   effect with branch flavor — one visible follow-up node each, per §6.
7. The Maw has one light trash wave before the Hollow King so grind attempts
   still pay a little gold/XP (grind-sandbox intent of §7).

## Architecture notes for the next slice

- `game/src/combat/` — pure deterministic TS; see `game/src/combat/README.md`.
- `game/src/tree/` + `data/spellTree.ts` — config-driven tree; see
  `game/src/tree/AGENTS.md`. Combat loadouts via `loadoutFromSave`.
- All numbers in `game/src/data/`, guarded by balance tests.
- `scripts/journey.mjs` clicks by layout coordinates; update its `UI` table
  when scene layouts change.

---

# Phase 2 QA — combat feedback, tooltips, real spell tree (2026-07-09)

Everything below was verified against the Phase 2 handoff's "Done means"
list by the central agent, per chunk and again end-to-end after integration.

## How to run (unchanged commands, from `game/`)

| Command | Purpose |
|---|---|
| `npm run check` | typecheck + ESLint + all Vitest tests + build |
| `npm run smoke` | headless boot, fails on any console error |
| `node scripts/journey.mjs [--shots DIR]` | full Phase-2 player journey (~5 min) |

## Journey rewrite

`scripts/journey.mjs` now drives the Phase-2 flow. Stage list: A (fresh →
tutorial → wipe), A2 (level-2 Zealous auto-grant), **M (new: raw v1 payload
boots into a migrated v2 save — deep-reserves rank, 5g retired-node refund,
subclass → oath node, no ruby charged)**, B (tree graph: two Deep Reserves
ranks, two-click Vigil oath, rival-lock inertness, follow-up node behind the
oath), **B2 (new: Vigil kit in combat — Solemn Vigil tooltip screenshot with
the Patient Vow synergy line, mid-fight feedback shot)**, C (The Maw wipe).
The `UI` click-coordinate table was rebuilt for the node-graph TreeScene
(root 480,130; vigil oath 260,260; zealot oath 700,260; patient vow 150,400;
Back moved to 120,504) and the spell-bar slot helper.

## Checklist results (all green)

1. **Combat feedback at real speed** — burst-capture frames show the attacker
   lunge (unit visibly displaced toward its target, home slot empty behind
   it), `*` hit markers, and green `+N` floats; one frame shows `*` fading on
   **all four party members at once** from a Bonehowl landing. Full-overheal
   casts correctly show no float.
2. **Tooltips reflect tree modifiers** — journey shot: Solemn Vigil tooltip
   reads `Heals 9 / Costs 7 mana / Cast: 3.0s / +1 heal when armed by Solemn
   Mend` with Patient Vow rank 1 owned; healer mana in the same shot is 24/24
   (20 base + 2 Deep Reserves ranks × 2).
3. **Node-graph tree** — edges colored by state (green owned / accent
   available / dim locked), `n/N` rank pips, oath details visible on hover
   before buying, two-click oath purchase, rival oath greyed LOCKED and
   click-inert afterwards. SubclassScene is deleted (file, key, registration).
4. **Branch effects live in combat** — engine options (synergies,
   missing-health) unit-tested in `engine.effects.test.ts` (11 tests);
   balance gates run both maxed subclass builds through `buildLoadout`.
5. **v1 migration** — save unit tests + journey stage M in a real browser.
6. **Gates** — `check`, `smoke`, and `journey.mjs` all pass.
7. **Research doc** — `docs/research/pixel-art-pipeline.md` delivered.

## Decisions made during Phase 2 (beyond the handoff's locked list)

- **Synergy edge semantics** (pinned for the engine): consume-then-arm order
  on the same cast; a trigger cast whose target died mid-cast still arms; a
  buffed cast on a dead target does NOT consume (no heal event to carry the
  bonus); independent armed slot per synergy entry, all matching entries
  consumed and summed on one cast.
- **Missing-health formula**: `healPer10PctMissing * floor((maxHp-hp)*10/maxHp)`,
  integer math, computed on pre-heal HP.
- **Balance gate shape widened, not weakened**: the old single "full kit"
  clear gate now requires BOTH maxed subclass builds to clear Ash Gate with
  ≥3 alive and BOTH to wipe in The Maw. Gates 1–3 (base kit) untouched.
- **Oath purchase UX**: two-click arm/confirm in the tree (permanent choice
  deserves friction); gold nodes buy on a single click.
- **Migration persists immediately**: loadSave writes the migrated v2 back to
  storage on first load of a v1 payload.
- **buildLoadout spell order**: XP-unlocked spells first (hotkeys 1/2 stay
  stable), tree-granted spells appended after.

## Retunes

**None needed.** Both maxed builds cleared Ash Gate 4/4-up with ≤1 mana left
(Vigil: 48s, 6 heals; Zealot: 48s, 6 heals) and both wiped in The Maw —
inside the gate envelope on first try, so all handoff draft numbers shipped
unchanged.

## Art swap: Kenney Tiny Dungeon units (post-Phase 2)

Combat unit rects replaced with tiles from the CC0 **Kenney Tiny Dungeon**
pack (source pack lives untracked at repo root; the packed 12×11 tilesheet +
license are committed under `game/public/assets/`). Decisions:

- **Unit→tile mapping** (in `game/src/ui/sprites.ts`, frame = row*12+col,
  same order as Kenney's `tile_XXXX` files): tank→96 knight, dps1→98 fighter,
  dps2→112 ranger, healer→84 purple wizard, Ash Husk→121 ghost, Gate
  Warden→109 brute, Hollow King→110 demon. Unknown ids fall back to
  fighter/demon.
- **Rendering**: sheet preloaded once in BootScene; `pixelArt: true` gives
  nearest-neighbor scaling game-wide; units scale via `setDisplaySize`
  (party 4×, trash 3×). Boss rect nudged 110→112 so it's an integer 7× of
  the 16px tile (flagged in docs/research/pixel-art-pipeline.md). Death
  state = dark tint + alpha + shrink, same as the old rects.
- **No layout changes**: unit home positions and clickable bounds are
  unchanged, so the journey.mjs UI table needed no edits. Verified: check
  (99 tests) + smoke + full journey PASS; sprites visually confirmed in
  journey shots (wave, Maw boss, dead-unit tint).
