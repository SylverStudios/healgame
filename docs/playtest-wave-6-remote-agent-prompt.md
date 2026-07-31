# Cloud agent prompt — Playtest Wave 6 remote (R2→R5)

Status: planning · Authority: paste this into a cloud/remote agent · Last
verified: 2026-07-30

**How to use:** Select everything inside the `PROMPT` fence below and paste it
as the cloud agent’s initial instruction.

**Branch:** work on **`playtest/wave-6-remote`** (branched from `main` after
#56 Wave 5b, #58 J16 cast-bar, #60 spell-cards PoC). Do **not** start from a
different branch.

**Context for the human:** Jul 30 playtest feedback (hit VFX, Bonk UX, Steady
Hands, progression reshape). Local Cursor canvas is the human scoreboard only —
**remote agents cannot read** `~/.cursor/projects/.../canvases/`. This file is
the remote bible.

**Already on this branch tip (skip re-implementing):**
- J16 cast-bar fill inset — shipped in #58 (`Bar` `fillInset`). Treat Done
  means #1 as a quick verify, not a build task.
- Spell-cards PoC — on `main` via #60. Do **not** expand cards UI; J26 must
  still respect cards `upgradePoints` vs lattice talent points.

Local-only (do not assign to remote): J17/J18 art, J19 relic revamp, J2
nameplates, J24 slot-2@Lv5, J25b scary chip2, PixelLab.

---

````PROMPT
You are the central agent for healgame Wave 6 remote on branch
**playtest/wave-6-remote**: ship hit VFX polish, Bonk readability, Steady Hands
retarget, and progression reshape (R2→R5; R1 already shipped). You delegate,
you decide, you own the outcome. Work autonomously to the end.

This prompt is self-contained. Do not rely on Cursor canvases, local notes, or
paths under ~/.cursor/ — they are not in the repo.

================================================================================
BRANCH / BASE
================================================================================

- Checkout and work only on `playtest/wave-6-remote`.
- Base already includes Wave 5b (#56), J16 cast-bar (#58), spell-cards PoC (#60).
- Open **one PR** targeting `main` from this branch when Done means are green.

================================================================================
DONE MEANS (verify every one yourself before declaring victory)
================================================================================

1. Player cast-bar yellow fill remains fully covered by end-cap chrome
   (already shipped #58 — smoke-check only; do not rework unless broken).
2. Enemy hurt VFX (archer arrow + healer Bonk) land with a small random offset.
3. Damage numbers float just above the enemy sprite, below the HP bar
   (off-center OK); they must not collide with hit VFX.
4. Arrow impact does a tiny left→right sink slide — not a full-screen
   projectile.
5. Hover shows active Bonk castBuffs (Blessed stacks, Mana Bonk, etc.).
6. Stacking Bonk amps show stacked icons over the healer (same family as
   `game/src/ui/battleMendIcon.ts`).
7. Steady Hands is missing-HP: +10% of base heal per 10% target missing HP
   (heal 4 at 50% missing → 6). `fullHealthBonus` retired for that node.
   Vigil Graven Scale (`vigil-graven-scale`) stays at 5%.
8. Level-up grants party max HP (Guardian +5, each DPS +2, healer +2) and
   ability unlocks; does NOT grant a talent point (lattice) or upgrade point
   (cards).
9. Dungeon clear grants +1 spendable point (lattice talent point / cards
   upgrade point — mode-aware).
10. Enemy damage scales ~+2 per floor after the first (Ash Gate = floor 1
    baseline).
11. `game/src/combat/balance.test.ts` difficulty shape still holds after retune
    (no-heal wipe, naive overheal wipe, full-kit clear, The Maw unwinnable).

================================================================================
READ FIRST (authority order)
================================================================================

1. This file — wins for Wave 6 remote scope, pinned numbers, non-goals.
2. CLAUDE.md — gates, engine purity, numbers-as-data, working style.
3. Module docs as touched: game/src/combat/README.md, game/src/data/README.md,
   game/src/tree/AGENTS.md.
4. .claude/skills/balance-tune/SKILL.md — required for R5.
5. .claude/skills/rotate-save-version/SKILL.md — if SaveData shape changes.
6. .claude/skills/add-interactive-control/SKILL.md — if new clickable UI.
7. If cards progression paths are touched: docs/spell-cards-poc-handoff.md
   (cards already on main — do not expand chip UI).

================================================================================
CHUNKS
================================================================================

| id | what | depends | owns |
|----|------|---------|------|
| R1 | Cast-bar chrome (J16) | — | **SKIP** — already on branch via #58. Verify Done means #1 only. |
| R2 | Hit VFX: jitter, numbers, arrow sink (J20–J22) | — | CombatScene hit / arrow / damage-float presentation |
| R3 | Bonk hover + stacked healer icons (J27–J28) | — (parallel OK vs R2 if disjoint) | spellTooltip / hover helpers; CombatScene; ui icon stack (battleMendIcon pattern) |
| R4 | Steady Hands → missingHealthPctBonus 10%/10% (J25) | — | `talentTree.ts` (`zealot-steady-hands`); resolveCombatMods; talentTree + engine.effects tests; player-facing copy |
| R5 | Level HP + clear point + floor enemy dmg (J26) | R4 preferred first | PARTY / constants; meta/progression; cards upgradePoints grant path if separate; encounter/mob damage data; balance.test.ts; balanceBot |
| QA | Full verify + PR | R2–R5 | YOURS — integration, journey, summary |

R2–R5: you may delegate middle work; you own integration + commits + PR.
QA is yours. Prefer keeping work on this branch and opening **one PR** to
`main`.

================================================================================
LOCKED MICRO-DECISIONS (do not reopen)
================================================================================

### J20–J22 / R2 — Hit VFX
- Presentation only — no combat math.
- Stack order on enemies: sprite → hurt/arrow with jitter → tiny arrow sink
  slide → damage numbers just above body → HP bar above that.
- Arrow motion is a short L→R sink, not a flight across the battlefield.

### J27–J28 / R3 — Bonk UX
- Hover must surface active Bonk-related `castBuff` state.
- Stacking amps (`stackNextHealPotencyPct` and similar) render as stacked
  icons over the healer — follow `battleMendIcon.ts`.

### J25 / R4 — Steady Hands
- Replace `fullHealthBonus` on `zealot-steady-hands` with
  `missingHealthPctBonus` / `pctPer10PctMissing = 10` on that node's heal
  spell (engine hook already exists; Vigil Graven Scale uses the same shape
  at 5% — leave Vigil alone).
- Example: base heal 4, target at 50% HP (50% missing) → +50% → heal 6.
- Out of scope for R4: faster-cast alternative; scary slow-cast + bigger
  heal chip2 (J25b / cards chips).

### J26 / R5 — Progression
- **No** spendable point on level-up (neither lattice talent points nor cards
  `upgradePoints`).
- On level-up: Guardian +5 max HP, each DPS +2 max HP, healer +2 max HP.
  Ability unlock-on-level tables stay.
- On dungeon clear: +1 spendable point (mode-aware: talent point or
  upgrade point).
- Enemy damage ≈ +2 per floor after the first (Ash Gate baseline unchanged
  as floor 1).
- Retune via balance-tune skill (scripted-bot telemetry → tune data → delete
  diagnostic). Do not hand-derive. Preserve balance.test.ts shape.
- Cards PoC is already on main — wire the grant rules correctly; do **not**
  redesign chip offers, album UI, or D11 presentation beyond the point grant.

================================================================================
DELEGATION PROTOCOL (non-negotiable)
================================================================================

- One subagent per chunk, synchronous; if one fails after a retry, take over.
- Every subagent prompt includes: docs to read; CREATE / MAY EDIT / DO NOT
  TOUCH file lists; pinned contracts for anything later chunks consume;
  locked decisions above; gate commands; "report cross-boundary friction, do
  not fix outside your scope."
- Sequential when files overlap; R2∥R3 only if ownership is provably disjoint.
- After every chunk: run gates YOURSELF, read the diff, do integration
  fixes, commit one checkpoint per chunk.

================================================================================
QUALITY BAR
================================================================================

- Work from `game/`. Definition of done: never commit red.
- R2–R4: `npm run verify:fast` at minimum after each chunk.
- R5 + final: full `npm run verify`.
- Touches to scenes / save / progression / encounter data → full verify.
- Save shape changes → rotate-save-version skill (`npm run save:bump`).
- New interactive controls → setName + semantic-targets / journey by name.

================================================================================
NON-GOALS (reject)
================================================================================

- PixelLab / any art generation or PNG regeneration
- Re-implementing J16 cast-bar inset (already shipped)
- J19 relic revamp, J2 nameplates, BUILD→circle (#12), roguelike (#1)
- Expanding spell-cards UI; J24 slot-2@Lv5; J25b scary slow-cast chip2
- Faster-cast Steady Hands alternative
- Lattice glyph→icon pass
- Relying on Cursor canvases or local machine paths outside the repo
- Starting work on a branch other than `playtest/wave-6-remote`

================================================================================
WHEN DONE
================================================================================

Run full `npm run verify`. Open one PR from `playtest/wave-6-remote` → `main`.
PR body: how to try + checklist vs Done means above + any reversible defaults
you chose. Summarize what shipped.
````
