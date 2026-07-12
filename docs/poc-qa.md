# PoC QA — journey checklist & verification

Status: current · Authority: decided micro-choices + QA log · Last verified: 2026-07-11

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
   **completion**. *(Phase 3 amends: mana is now reserved at cast start and
   refunded on cancel — see the Phase 3 section.)*
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
  consumed and summed on one cast. *(Phase 3 amends the mid-cast-death case:
  such casts are now auto-cancelled and never arm — see the Phase 3 section.)*
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

---

# Phase 3 QA — combat UX legibility (2026-07-11)

Everything below was verified against the Phase 3 handoff's "Done means" list
by the central agent — per chunk (`check` after every chunk, `smoke` for UI
chunks) and again end-to-end after integration, including a throwaway
Playwright screenshot pass over combat and the tree (script deleted after
review, per working style).

## How to run (unchanged commands, from `game/`)

| Command | Purpose |
|---|---|
| `npm run check` | typecheck + ESLint + all Vitest tests (146) + build |
| `npm run smoke` | headless boot, fails on any console error |
| `node scripts/journey.mjs [--shots DIR]` | full player journey (~5 min) |

In-game manual checks: enter Ash Gate, click `Log ▸` (top-right) to expand
the combat log; press Escape mid-cast for the cancel toast + refund; complete
a Solemn Mend with Patient Vow owned to see the gold armed border on Solemn
Vigil; hover any tree node for the anchored tooltip.

## Done-means checklist (all verified)

1. **Tree tooltips node-anchored** — hover shows a dark tooltip above the
   node (flips below / clamps at canvas edges), same content as the old
   bottom panel; long titles ellipsis-truncate inside the node box, full name
   stays in the tooltip. Verified by screenshot at the canvas edge. The
   bottom line now shows only the oath arm-confirmation message.
2. **`-N` damage floats** — every `damage` event floats its raw amount
   (0 and overkill included) in red with the heal-float motion; the `*` hit
   marker is deleted (grep-clean). Verified in journey + screenshot pass.
3. **Role-differentiated swings** — merc tank 2500 ms / merc DPS 1000 ms /
   trash 3000 ms / bosses 3500 ms (data in `constants.ts`); cadence pinned by
   unit tests, balance gate shape intact (see Retunes).
4. **Dev combat log** — top-right `Log ▸` header, click-only toggle (no
   keybind), collapsed by default, last 20 lines of damage / heal /
   castCancelled with scene-side `[N.Ns]` timestamps.
5. **Cast cancel** — Escape cancels active cast + queue with mana refund;
   target death mid-cast auto-cancels the same tick; cancelled casts never
   arm; toast (`Cast cancelled` / `Cast failed: target died`) + log line.
   13 new engine tests in `engine.cancel.test.ts`.
6. **Armed synergy border** — buttons in `state.armedBuffedSpellIds` get a
   3 px gold stroke, default border otherwise; no floater, no buff strip.
7. **Gates** — `check` (146 tests), `smoke`, and full `journey.mjs` all pass.

## Locked decisions shipped (handoff A–F) + micro-decisions made

- **Mana reserve/refund (amends Phase 1/2)**: mana is debited at cast START,
  kept on completion, refunded on cancel. A cast whose target dies mid-cast
  is auto-cancelled in the same tick the death is applied and **never arms**
  a synergy (supersedes the Phase 2 "still completes / still arms" edge).
  Queue-only `cancelCast()` clears silently (never started → no event).
- **GCD on cancel**: cancelling does NOT reset the GCD — cancel refunds mana,
  never tempo (documented in `combat/README.md`).
- **`cancelCast` buffering**: mutates immediately, `castCancelled` event is
  delivered on the next `advance()` — same pattern as `castSpell`.
- **Combat log placement**: top-right (header right-aligned at x 946, y 14;
  expanded panel 280×256 at x 666, y 34 — clear of the boss cast bar). Log
  renders at depth 500 so wave-spawned sprites stay under it.
- **Log name resolution**: the scene caches id → name for every unit it has
  seen this combat, because a kill that ends a wave leaves the engine
  snapshot before the log line is formatted.
- **Toast**: single reusable text at (480, 420), 1.5 s fade; castCancelled is
  the only toast source.
- **Tree bottom line**: kept solely for the two-click oath arm-confirmation
  message (state-driven, not hover) — dropping it would regress the swearing
  UX journey stage B exercises.

## Retunes (balance gate shape preserved, not weakened)

Faster per-role merc swings (~2.6× combined party DPS vs the old uniform
3000 ms) required scaling enemies up to hold fight length and the difficulty
shape — all gates re-verified, no hand-derived math (throwaway scripted-bot
probe, deleted):

| Value | Old | New |
|---|---|---|
| MERCS swing | 3000 ms (all) | tank 2500 ms / DPS 1000 ms |
| GATE_WARDEN / HOLLOW_KING swing | 3000 ms | 3500 ms (desync from trash) |
| GATE_WARDEN autoDamage | 3 | 4 |
| Ash Husk hp | 4 | 11 |
| Gate Warden hp | 55 | 145 |

TRASH.swingIntervalMs stays 3000. Gate shape unchanged: no-heal wipes, naive
overheal wipes, both maxed kits clear Ash Gate, The Maw stays unwinnable.

## Journey impact

No interactive element moved, so the `UI` click-coordinate table needed no
changes. One new clickable exists if a future stage wants it: the combat-log
toggle at (946, 14). Full journey re-run green after integration.

# Side-view layout QA — facing-line combat (2026-07-11)

Combat now reads as a Darkest Dungeon–style side view: party on the left
facing right, enemies on the right facing left, everyone bottom-aligned to
one shared ground line. Presentation only — no engine, save, data, or
balance changes (all balance gates byte-identical). Handoff:
`side-view-layout-handoff.md` (historical).

## How to run (unchanged commands, from `game/`)

Same gates: `npm run check`, `npm run smoke`, `node scripts/journey.mjs`.
To eyeball the layout: `npm run dev`, enter Ash Gate.

## Done-means checklist (all verified)

1. **Shared ground Y** — `GROUND_Y = 340`; units bottom-align via
   `groundAnchorY(height)` so party (64), trash (48), and boss (112) all
   stand on the same line despite different container centers.
2. **Party left→right `healer · dps2 · dps1 · tank`** — visual slots
   80→380 assigned by unit id (`PARTY_VISUAL_ORDER`); the engine's party
   array order (tank → dps1 → dps2 → healer) is untouched. Tank fronts the
   line nearest the enemies.
3. **Enemies left→right 580→880** — engine order, evenly spread; a lone
   boss centers at x 730.
4. **Facing** — new `facing: 'left' | 'right'` on `UnitSpriteConfig`;
   party unflipped, enemies `flipX`. Kenney tiles are front-facing
   portraits, so this is the handoff's declared stopgap, not real
   side-profile art.
5. **Target marker** — the left-of-body chevron (ambiguous in a horizontal
   line: it points at the left neighbor) became a small downward chevron
   centered above the unit's topmost bar/number line (clears the healer's
   mana stack). Still party-only (heal-target indicator).
6. **Ground line** — one 2px `0x3a2a22` rect at GROUND_Y behind the units
   (the handoff's optional flourish; no other art).
7. **Phase 3 feedback intact** — lunge (horizontal toward target home X,
   unchanged logic), `-N`/`+N` floats, flash, combat log, Escape cancel +
   toast, armed spell border: all re-verified by journey stage B2 shots and
   smoke.

## Constants shipped

Handoff §C starting values held with no tuning needed (no HUD collision:
boss top edge y 228 vs boss cast bar y≈54). Name labels stay centered on
the body. Alongside this phase, the post-Phase 3 float readability tune
landed: floats rise 20px over 550ms (was 14px/400ms), damage font 22px
(was 18px), heal font 20px (was 16px).

## Journey impact

One coordinate: `UI.combatTank` moved from the old column slot (170, 95)
to the tank's new home (380, 308) — 64px body spans y 276–340 centered on
x 380. Hit area is still the sprite body bounds. Everything else in the
`UI` table (Return overlay, spell-bar slots, hub/tree) was layout-independent,
as the handoff predicted. Party hotkeys stay out of PoC (Decision D not
reopened). Full journey green after integration.

# Combat juice + forsaken-path tempo QA (2026-07-11)

Presentation juice, tree forsaken-path **Warped Tempo** (1.5× combat pace),
and spell-bar chrome. Handoff: `combat-juice-handoff.md` (historical). No
engine rule changes; balance gates byte-identical at 1× sim.

## How to run (from `game/`)

`npm run check`, `npm run smoke`, `node scripts/journey.mjs`.

## Done-means checklist (all verified)

1. **Boss screenshake** — `bossCastFinished` triggers a modest camera shake
   only; merc/trash autos and heals do not shake.
2. **Scaled floats** — `-N`/`+N` font size scales monotonically with amount
   (`floatFontPx` table in `unitSprite.ts`); rise+fade motion unchanged.
3. **Target halo** — ember/iron ellipse under targeted ally feet (primary
   indicator; chevron above bars kept as secondary).
4. **Cast effects** — `castStarted`: healer ember flash + thin beam to target;
   heal land: existing flash + optional ground ripple.
5. **Armed healer rune** — small ember sigil near healer while
   `armedBuffedSpellIds` non-empty; gold armed spell border kept; no label.
6. **Keycap badges** — spell hotkeys render as bordered square badges
   (top-left of each button).
7. **Oath lock icon** — simple padlock geometry between Vigil/Zealot nodes;
   non-interactive.
8. **Forsaken-path tempo** — after swearing one oath, rival spot offers
   purchasable `warped-tempo-via-*` (4g); `combat-tempo` exclusive group
   locks the other consolation.
9. **Pace toggle** — bottom-left control cycles `1x`/`1.5x` when 1.5× owned;
   hidden at 1×-only; `combatPaceTenths` persists in save v3.

## Pinned micro-choices

| Topic | Decision |
|---|---|
| Sim vs juice clock | `engine.advance` uses paced `dt`; float/shake/heal-ripple tweens stay wall-clock |
| Save | v3 adds `combatPaceTenths` (default 10); v2 migrates on load |
| Oath two-click arm | Subclass group only — Warped Tempo is single-click |
| Pace toggle position | Bottom-left `(20, 532)` origin; journey click `(48, 516)` |

## Journey impact

Stage B seed gold raised to 17g (tempo 4g + Patient Vow 3g after oath).
New stages: forsaken tempo purchase on zealot spot, pace toggle click in B2.
New `UI.combatPaceToggle`. Full journey green after integration.
