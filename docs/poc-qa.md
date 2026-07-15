# PoC QA — journey checklist & verification

Status: current · Authority: decided micro-choices + QA log · Last verified: 2026-07-15

<!-- Alpha 0.2 section appended at end; living amendments win over earlier rows. -->

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

1. Level 2 at **10 XP** → auto-grants **Zealous Mending** (XP's only PoC
   job; no spend UI). Further XP accrues with no extra levels yet.
2. Gold tree node: **Deep Reserves** — **+5 max mana per rank**, 5 gold,
   5 ranks (one rank = one extra Solemn Mend cast from the base pool).
3. Dungeon 2 unlocks **after Ash Gate first clear** (spec's preference).
4. Healer is **never targeted** by enemies in PoC.
5. Cast time is the busy time; GCD 1s runs in parallel (`max(cast, GCD)`),
   one-slot spell queue re-validated when busy ends. Mana spent on cast
   **completion**. *(Phase 3 amends: mana is now reserved at cast start and
   refunded on cancel — see the Phase 3 section.)*
6. Subclass follow-ups are **synergies / cast mods / missing-health** (Patient
   Vow, Measured Devotion, Fervent Chain, Desperate Zeal) — not flat mana.
   Retired v1 nodes `vigil-deep-focus` / `zealot-battle-fervor` refund on
   migration only.
7. The Maw has one light trash wave before the Hollow King so grind attempts
   still pay a little gold/XP (grind-sandbox intent of §7).

## Architecture notes for the next slice

- `game/src/combat/` — pure deterministic TS; see `game/src/combat/README.md`.
- `game/src/tree/` + `data/spellTree.ts` — config-driven tree; see
  `game/src/tree/AGENTS.md`. Combat loadouts via `loadoutFromSave`.
- All numbers in `game/src/data/`, guarded by balance tests.
- `game/src/data/README.md` + `npm run content -- validate|list|preview` —
  typed dungeon/mob/ability catalogs compiled into `EncounterDef`.
- `scripts/journey.mjs` clicks by semantic name via `__healgame.locate` (see
  `docs/semantic-targets-handoff.md`); interactive objects must `setName`.

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
   Mend` with Patient Vow rank 1 owned; healer mana scales with Deep Reserves
   (20 base + ranks × amount — see micro-choice 2 / playtest retune).
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
| Gate Warden / Hollow King mob swing | 3000 ms | 3500 ms (desync from trash) |
| Gate Warden mob autoDamage | 3 | 4 |
| Ash Husk hp | 4 | 11 |
| Gate Warden hp | 55 | 145 |

Ash Husk swing stays 3000. Gate shape unchanged: no-heal wipes, naive
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

# Playtest retune — mana feel, spell affordance, currencies (2026-07-12)

Post-juice playtest. No new phase handoff; living numbers + hub copy.

## Changes

| Topic | Before | After | Why |
|---|---|---|---|
| Deep Reserves | +2 max mana / rank | **+5 max mana / rank** | A couple ranks must buy a real cast (Solemn Mend costs 5) |
| Zealous Mending | heal 5 / mana 8 / 1s | **heal 6 / mana 6 / 1s** | Second spell is a tempo tool, not a mana trap vs Mend |
| Spell bar OOM | 35% alpha only | Stronger dim + **crimson cost** when unaffordable | Uncastable-from-mana must read at a glance |
| Hub currencies | `Gold N  XP N (Lv)  Rubies N` | Labeled roles + XP progress to Zealous | XP purpose was opaque; gold/ruby sinks were clearer |

## Currency roles (pinned for hub copy)

| Currency | PoC job |
|---|---|
| **XP** | Auto-unlock kit breadth at level thresholds (only Lv 2 → Zealous today) |
| **Gold** | Buy spell-tree nodes (Deep Reserves, forsaken tempo, …) |
| **Rubies** | Swear a subclass oath (scarce; first-clear only) |

## Gates

`balance.test.ts` shape unchanged (no-heal wipe, naive wipe, full-kit clear,
The Maw unwinnable). Retune values live in `constants.ts` / `spellTree.ts`.

# Alpha 0.1 QA — mid dungeon, tree layer 2, cooldowns, relics (2026-07-13)

Everything below was verified against `alpha-0.1-handoff.md`'s "Done means"
list by the central agent — per chunk (`check` after every chunk) and again
end-to-end after integration (chunk 9b: balance bots + `journey.mjs` +
this section). Handoff status flips to historical.

## How to run (unchanged commands, from `game/`)

| Command | Purpose |
|---|---|
| `npm run check` | typecheck + ESLint + all Vitest tests (240) + build |
| `npm run smoke` | headless boot, fails on any console error |
| `node scripts/journey.mjs [--shots DIR]` | full player journey (~4 min) |

## What shipped (the four pillars)

1. **Mid dungeon — Iron Pass.** Ash Gate → Iron Pass → The Maw
   (`isIronPassUnlocked`/`isMawUnlocked` in `meta/progression.ts`). Four
   harder-hitting trash waves, then Spire Lancer's **Tunnel Vision**: a 3s
   telegraph, then a 10s/1s-tick single-target channel on a focused non-tank
   ally, with its own halo (distinct from the heal-target chevron/halo).
2. **Tree layer 2 — mana focus.** 2 passive mana nodes + 1 CD-granting node
   per branch (Deep Well/Thrift/Still Waters for Vigil; Quick Breath/
   Spendthrift Grace/Frenzied Liturgy for Zealot), behind existing branch
   follow-ups. Plus the **§D4 rebalance**: `zealot-desperate-zeal` retired;
   Vigil's `Solemn Vigil` missing-health bonus is now percent-of-base-heal
   (`Graven Scale`); Zealot gets a new full-health identity node
   (`Steady Hands`, +1 heal at ≥80% target HP) at the old node's tree slot.
3. **Two cooldowns — first major CDs.** Vigil's **Still Waters** (60s: next
   completed heal is free) and Zealot's **Frenzied Liturgy** (30s: heals cost
   1 less mana). Off-GCD activation; spell-bar buttons appear only when the
   loadout grants a cooldown (zero layout shift otherwise).
4. **Relics — one-time pick.** After the **first-ever** Ash Gate clear,
   `relicPickPending` routes the next Hub load straight to `RelicScene`
   (pick 1 of 3 — Ember Ledger / Triage Bell / Still Reservoir); the choice
   persists as `save.relicId`, shows as a hub icon + hover tooltip, and is
   never offered again. Save is v4 (`relicId`, `relicPickPending`).

## Decided micro-choices (amend/extend PoC + prior phases)

1. **Tunnel Vision may target the healer** — amends PoC micro-choice 4
   ("healer never targeted") for this boss only: eligible focus targets are
   living party members with `role !== 'tank'` (deterministic round-robin by
   stable unit id), which includes the healer. Ash Gate/The Maw enemy
   targeting is unchanged (tank only, then DPS, then healer once the tank
   is dead).
2. **Ruby stays Ash-Gate-only.** Iron Pass's first clear still records
   `clearedDungeons` (unlocking The Maw) and shows a `FIRST CLEAR!` notice,
   but grants no ruby — Alpha 0.1 adds no new ruby sink.
3. **CDs are off-GCD and can fire mid-cast** — activating a cooldown never
   consumes the GCD and is allowed at any point except while the run has
   already ended (victory/wipe); it can land while a heal is mid-cast.
4. **Still Waters' free-heal charge is consumed at cast START, even on
   cancel** — locked. Arming the charge and then cancelling the cast it was
   meant for still burns the charge (no refund-of-the-refund); this keeps
   the charge's bookkeeping identical to normal mana reservation instead of
   adding a second special case to `cancelCast`.
5. **Relic pick is one-time, no skip; restart wipes it.** `RelicScene` has
   no skip/back button — the player must choose. `resetSave` clears
   `relicId`/`relicPickPending` like everything else.
6. **TreeScene now scrolls.** Layer 2 sits below the existing branch rows
   (world y 650/800, past the 900-tall world / 540-tall viewport); mouse
   wheel pans a screen-fixed HUD over a taller world (`WORLD_HEIGHT = 900`,
   max scroll 360). No change to any pre-existing (unscrolled) node position.

## Chunk 9a tuning table (verbatim from the balance-bot diagnostic)

| Value | Draft | Shipped | Why |
|---|---|---|---|
| Iron Pass wave HP | 14 / 14 / 16 / 16 (182 total) | **9 / 9 / 10 / 10** (115 total) | The draft burned ~65% of a maxed healer's max mana before the boss even spawned, leaving too little to survive Tunnel Vision |
| `spire-lancer` mob hp (`data/mobs/spireLancer.ts`) | 170 | **190** | Fits 2 Tunnel Visions landing in the fight (design's "ideally 2"); >195 starts costing the fight's 3rd survivor |
| `spire-lancer` mob autoDamage | 4 | **3** | Eases passive tank-swing pressure that compounds with healing the Tunnel Vision target |

## Balance gates (all pass; shape widened, not weakened)

1. Ash Gate, no healing → wipe.
2. Ash Gate, naive spam-healing on the starting kit → wipe.
3. Ash Gate, disciplined play on the starting kit → never cruises (wipe, or
   an OOM pyrrhic scrape with ≤2 survivors).
4. Ash Gate, disciplined play, **both** maxed subclass builds → victory,
   ≥3 alive, Bonehowl lands ≥1×.
5. Iron Pass, maxed **Vigil** build, disciplined play → victory, ≥3 alive,
   Tunnel Vision fires ≥1, ≥1 cooldown activation.
6. Iron Pass, maxed **Zealot** build, disciplined play → victory, ≥3 alive,
   ≥1 cooldown activation.
7. The Maw, either maxed build **with any of the 3 relics**, disciplined
   play → wipe (sandbox holds even with the new relic layer).

## Journey.mjs rewrite (chunk 9b)

New stages layered onto the Phase-2/3/juice flow (letters keep the existing
convention). The current **M** stage proves a stale save is deleted and returns
to tutorial. **Relic** seeds `pendingRelicOffers`—the exact state
`applyCombatResult` leaves after a first clear—to exercise the live
Hub→RelicScene routing, pick, persistence, and cleared-offer behavior without a scripted
live combat win), **D2** (Ash-Gate-only save → Iron Pass unlocked, The Maw
slot inert; enters Iron Pass and bails without playing it out — Iron Pass's
clearability is gates 5/6, not a journey job), **B3** (tree layer 2: scrolls
to the new row, buys a Vigil mana passive + Still Waters; a second lean seed
proves the §D4 rebalance by buying Zealot's Steady Hands at the retired
Desperate Zeal position). Stage **C** (was the Maw stage) is now explicitly
gated: Ash-Gate-only save asserts the Maw slot is inert before re-seeding
with Iron Pass also cleared and re-running the existing unwinnable-sandbox
wipe wait. All `UI` table coordinates for Iron Pass/Maw hub buttons, relic
cards, the relic hub icon, and the scrolled tree-layer-2 nodes were added
against the live scene code (not eyeballed) — see the table's comments in
`scripts/journey.mjs` for the exact math (canvas 960×540, scroll clamp 360).

**Note on scope:** stages B/B3/D2 seed save state directly rather than
scripting a live Ash-Gate/Iron-Pass win — the fight requires reactive,
per-tick target selection (who's low) that isn't observable from outside the
canvas (no DOM text, no exposed engine state), so a blind live replay would
trade a real, deterministic gate (`balance.test.ts`'s scripted bots) for
wall-clock-timing guesswork, which cuts against this project's
determinism-over-vibes rule. Full journey run: 0 failures, 0 console errors,
~4 minutes, 29 screenshots.
# Data-driven dungeon content QA (2026-07-13)

Enemy abilities, mobs, and ordered dungeons now live in typed catalogs under
`game/src/data/`; authoring and runtime contracts are documented in
`game/src/data/README.md`. A pure validator and compiler resolve those
references into the existing `EncounterDef` combat input.

## Pinned decisions

- TypeScript remains the authoring format. No JSON/YAML source, generated
  output, or arbitrary ability scripting layer.
- Dungeon order is the explicit `DUNGEON_ORDER`, never filename order.
- A boss is a reusable mob in the dungeon's final wave; the compiler lowers
  that authoring form into the engine's current separate boss field.
- Current runtime limits remain explicit: one scheduled boss ability
  (`partyAoE` or `tunnelVision`) and no active trash abilities. New ability
  kinds require engine behavior first.
- Mob stat overrides are allowed for deliberate encounter tuning and are
  always exposed by textual preview.
- The content CLI is read-only; source-writing scaffolds remain deferred.

## Behavior and verification

Ash Gate, Iron Pass, and The Maw compile to their Alpha 0.1 effective HP,
damage, timing, wave, reward, and ability values. Balance shape is unchanged.
Encounter lookup, unlocks, first-clear rewards, hub buttons, and enemy sprite
selection now consume catalog IDs/metadata; cleared dungeon IDs remain
save-compatible and required no additional save migration.

From `game/`, content authors can run:

```bash
npm run content -- validate
npm run content -- list
npm run content -- preview <dungeon-id>
npm run content -- preview --all
```

Validation covers references, IDs, integer ranges, cast cadence, explicit
order, unlock cycles, final-boss shape, visual keys, runtime ability limits,
and unused-content warnings. Vitest additionally pins legacy-equivalent
compiled values, deterministic assembly/simulation, reward overrides, mob
identity, and preview text. Catalog additions must also update
`content/cli.test.ts` output pins, `ui/sprites.test.ts` art coverage, and any
dungeon-specific sanity/balance cases. Full `npm run verify` passed after
integration; the journey `UI` table tracks the three-dungeon Hub reflow.

---

# Semantic click targets — journey by name (2026-07-13)

Status: current · Authority: QA log for this phase · Last verified: 2026-07-13

## What shipped

Interactive GameObjects carry stable `setName` labels. Journey drives the game
through `window.__healgame.locate(name)` / `list()` from
`game/src/debug/testHooks.ts` (installed in `main.ts`). The hard-coded `UI`
coordinate table in `scripts/journey.mjs` is gone. Return clicks in combat are
conditional on `locate('combatReturn')`. Maw gating asserts
`locate('hubMaw') === null` before Iron Pass clear.

Name inventory and design record: [`docs/semantic-targets-handoff.md`](semantic-targets-handoff.md)
(`Status: historical`). CLAUDE.md hard rule retitled to **Interactive objects ↔
journey.mjs**. `AGENTS.md` / `game/src/tree/AGENTS.md` no longer point at a
coordinate table.

## Alpha 0.1 extensions named beyond the original handoff table

`hubIronPass`, `combatPaceToggle`, `relicCard:<relicId>` — everything journey
still aims at after Iron Pass / relics / pace toggle. Relic/oath HUD icons use
`runMod:<id>` (see Run mods top bar section).

## Acceptance

Full `npm run verify` passed (typecheck, lint, test, build, smoke, journey).
Journey no longer embeds ally/spell/hub pixel tables — a `GROUND_Y` layout
nudge cannot desync journey because `locate('combatAlly:tank')` reads live
bounds.

# Run mods top bar — oath + relic HUD (2026-07-13)

Status: current · Authority: QA log for this slice · Last verified: 2026-07-13

## What shipped

Shared StS-style top-right icon strip (`game/src/ui/runModsBar.ts`) shows the
sworn oath (diamond glyph) and chosen relic (circle glyph) on Hub, Combat, and
Tree. Hover shows kind + name + description. Oath display text is pulled from
the tree oath nodes via `runModsFromSave` (`game/src/data/runMods.ts`) — no
duplicate effect copy. Hub no longer prints a mid-screen `Oath: …` line; Relic
pick cards use the same glyph language.

Semantic targets: `runMod:<id>` (e.g. `runMod:vigil-oath`,
`runMod:triage-bell`). Former `hubRelicIcon` name retired.

---

# v0.1.1 playtest improvements (2026-07-13)

The post-Alpha playtest pass keeps progression and combat rules intact except
for the Frenzied Liturgy cadence below:

- Cooldown buttons now match spells with hover details, sequential number
  hotkeys, and `combatCooldown:<id>` semantic targets.
- Tunnel Vision keeps a top-screen focused-ally callout throughout its channel
  and marks that ally with a crimson crosshair distinct from heal targeting.
- Wave changes announce themselves without pausing simulation; victory/wipe
  results fade and reveal in stages while `combatReturn` exists immediately.
- Hub currencies use one compact summary and unlocked dungeons share a bounded
  row above Spell Tree and Restart, eliminating the two-dungeon collision.
- Spell-tree nodes and spacing are more compact, with stronger title/header
  contrast; graph behavior, tooltips, scrolling, and purchases are unchanged.
- Relic hover required no duplicate work: the merged shared run-mods bar
  already exposes oath and relic details on Hub, Combat, and Tree.

Frenzied Liturgy keeps its 30s mana-cost-reduction window, but its cooldown is
now **40s**, creating a 10s post-expiry recovery window. A temporary diagnostic
ran the existing maxed-Zealot Iron Pass bot unchanged across every integer
candidate from 31–45s: 31–43s preserved its pinned victory, while 44–45s wiped.
The round 40s cadence makes activation timing matter while retaining a safety
margin above that failure boundary. Deterministic cooldown tests pin expiry
with 10s still remaining, rejection during recovery, and reactivation only at
the exact 40s boundary.

---

# Healing, economy, and tree-impact retune (2026-07-14)

Post-playtest tuning makes heals cheaper to press but smaller per cast:
Solemn Mend **4 heal / 3 mana**, Zealous Mending **4/4**, Solemn Vigil
**6/5**, and Zealous Flare **2/2**. Cast times are unchanged.

Vigil now makes a permanent branch choice: Patient Vow is the power path
(+2 armed heal per rank), while Measured Devotion is the efficiency path
(Vigil +1s cast, -3 mana). Their shared `vigil-specialization` exclusive group
prevents stacking both. Balance gates cover both maxed Vigil specializations
independently.

Tree prices are unchanged; lower gold income slows completion without making
individual purchases feel farther away. Node effects are more visible:
Deep Reserves grants **+6 mana/rank**, three-rank synergies grant
**+2 heal/rank**, Deep Well grants +6 mana, Spendthrift Grace +5, and Steady
Hands +2 heal.

Gold now drops in one-gold bundles every **2 enemy kills** while XP still
accrues every kill. Full-clear gold falls from 6→3 in Ash Gate and 13→6 in
Iron Pass; wipe earnings remain banked. The content schema exposes this as
`goldEveryKills`.

---

# XP consolidation, talent points, and stat relics (2026-07-14)

This amendment supersedes the PoC spec's gold/ruby economy and one-time relic
rules. XP is now the only currency-like progression value:

- Every enemy kill grants **1 XP**, retained through wipes.
- Level 2 remains at 10 XP. Later levels use cumulative thresholds of 30, 60,
  100, and so on (10/20/30/40… XP between levels).
- Each level supplies one total spell-tree allocation. Tree nodes all cost one
  talent point; points are placements, not spendable loot. Level 6 therefore
  supports six owned ranks/nodes, with any remainder shown as unplaced.
- Always-available spells may unlock directly at level milestones; currently
  only Zealous Mending unlocks at level 2.
- Gold and rubies are removed from saves, combat rewards, dungeon content,
  Hub UI, and tree costs.

Every distinct dungeon **first clear** now queues a random offer of three
unowned permanent relics. Replays remain valuable for XP but do not become an
unbounded relic farm. Offers persist until one is selected. The initial pool
uses simple visible stats—healer mana/regen/healing/health, tank
health/armor/damage, and DPS health/damage/attack speed—rather than conditional
proc text. Selected relics accumulate and appear in the shared run-mod bar.

Save v5 deliberately rotates the local-storage key and deletes the old
development key. There is no migration contract before release: stale or
unrecognized payloads return the player to a fresh tutorial.

---

# Mid-tier dungeons — Cinder Vault & Black Choir (2026-07-15)

Status: current · Last verified: 2026-07-15

Inserted two dungeons between Iron Pass and The Maw:

| Order | Dungeon | Boss | Mechanic | Balance gate |
|------|---------|------|----------|--------------|
| 3 | Cinder Vault | Ember Colossus | `partyDoT` Emberfall | Maxed Vigil/Zealot + efficiency Vigil clear with ≥3 alive; DoT lands ≥1 |
| 4 | Black Choir | Dirge Sovereign | `manaSiphon` Soul Toll | Maxed kits wipe; Soul Toll mana-burns at least once (soft talent-point gate) |
| 5 | The Maw | Hollow King | Extinction | Still Extinction-scale unwinnable; unlock now requires Black Choir clear |

New ability kinds landed in the engine (`partyDoT`, `manaSiphon`) with events
`partyDoTStarted` / `partyDoTEnded` / `manaBurned`. Content authored through
the typed catalogs (`enemyAbilities/`, `mobs/`, `dungeons/`) and validated via
`npm run content -- validate|preview`. Hub buttons auto-wire from
`ORDERED_DUNGEONS`; journey names: `hubCinderVault`, `hubBlackChoir`.

---

# Content DX + Verdant Rift proof dungeon (2026-07-15)

Status: current · Last verified: 2026-07-15

## Authoring DX

- `npm run content -- balance <id|--all>` runs maxed Vigil/Zealot disciplined
  bots via shared `combat/balanceBot.ts` (same harness as balance gates).
- Hub dungeon journey names are always `hubDungeon:<id>` from
  `hubDungeonTargetName` — no HubScene per-id switch.
- CLI validate/list/preview/balance tests derive expectations from live
  catalogs so adding a data-only dungeon does not require hand-pinned count
  strings.

## Verdant Rift (Dungeon 4)

Proof add that reused `tunnelVision` (Needle Gaze) with new trash/boss data
only. Clearable with maxed kits (≥3 alive, Needle Gaze lands ≥1). Inserted
between Cinder Vault and Black Choir; Black Choir unlocks after Verdant Rift;
The Maw is Dungeon 6.

---

# Alpha 0.2 — Oathbound Depth (2026-07-15)

Status: current · Last verified: 2026-07-15

Planning bible (now historical): [`oathbound-depth-handoff.md`](./oathbound-depth-handoff.md).

## How to run

```bash
cd game
npm install
npm run verify        # full gate (includes journey)
npm run content -- balance --all
npm run content -- validate
```

## Checklist (done means)

| # | Criterion | Status | Enforced by |
|---|-----------|--------|-------------|
| 1 | Level → max mana + combat mana regen; relics stack; no player HoTs | ✅ | `manaBonusesForLevel`, `loadoutFromSave`, `CombatEngineOptions.manaRegen`, progression/engine tests |
| 2 | Hourglass SPELL_TREE (shared → oath → mid → Vowstrike → crown); pure-mana pads slimmed | ✅ | `spellTree.ts` + tests; Deep Reserves 3 ranks; Deep Well / Spendthrift cut |
| 3 | `vowstrike-virtue` / `vowstrike-vengeance` instant (`castMs: 0`); oath lightly colors aspect | ✅ | catalog + `engine.instant.test.ts`; `applyOathVowstrikeTwists` |
| 4 | Placeholder glyphs on tree nodes + combat spell/CD buttons; hover full detail | ✅ | `ui/glyph.ts`, TreeScene, spellBar; tooltip tests |
| 5 | Ash/mid shape preserved; Black Choir clearable with crown kits (≥3, Soul Toll ≥1); Maw unwinnable ± relic | ✅ | `balance.test.ts` + `npm run content -- balance --all` |
| 6 | No respec; no status/cleanse this phase | ✅ | scope hold |
| 7 | Full `npm run verify` green; handoff historical; AGENTS active mission cleared | ✅ | this section + `AGENTS.md` |

## Decisions locked / shipped

1. **Level mana (§D2):** `LEVEL_MANA` in `data/constants.ts`; helper in `data/levelMana.ts` (re-exported from `meta/progression`). +3 max mana per level above 1; regen +1/10s at L2, +1 rank every 3 levels. Engine merges loadout `manaRegen` with relic regen (sum amounts, min interval).
2. **Instant cast:** `castMs === 0` completes inside `beginCast`; GCD still applies.
3. **`healBonus` CD kind:** Wrath Ascendant 45s / 12s / +2 heal; stacks after synergy/missing/full/relic healing.
4. **Save v6:** `healgame-save-v6`; purges v5/v1 keys; no migration.
5. **Tree hourglass:** spots include `shared-mend-potency`, `shared-zealous-potency`, `vowstrike-*`, `wrath-ascendant`, `vowbound-crown`. Exclusive group `vowstrike-aspect`. Crown amp via `ampOwnedSpells`.
6. **Oath×aspect twists:** Vigil+Virtue mana−1 Absolution; Vigil+Vengeance missing-health Reckoning; Zealot+Virtue Absolution→Zealous Mending synergy; Zealot+Vengeance Reckoning +1 heal.
7. **Black Choir:** Dirge Sovereign `statOverrides.hp: 200` (was mob base 260) so crown kits clear under Soul Toll; gate flipped wipe→clear for all oath×aspect kits.
8. **The Maw:** Hollow King `hp: 9999`; bots treat 10‑min sim cap as wipe (`capAsWipe`). Still unwinnable ± any relic.
9. **Glyphs:** single-char placeholders (`M/Z/G/F/V/X/S/L/W`…). Tree WORLD_HEIGHT 1080; journey clicks by name.
10. **QWER stretch parked:** digit hotkeys remain; note for a later pass (handoff §D7).

## Journey notes

Stage B3 scrolls the hourglass and buys Still Waters → shared mid → Virtue Vowstrike → Wrath Ascendant → Vowbound crown (named targets). Cut nodes `vigil-deep-well` / `zealot-spendthrift-grace` are gone.
