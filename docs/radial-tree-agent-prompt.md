# Cloud agent prompt — Radial talent tree (Wave 5 dual-ship)

Status: planning · Authority: paste this into a cloud/remote agent · Last verified: 2026-07-29

**How to use:** Select everything inside the `PROMPT` fence below and paste it
as the cloud agent’s initial instruction.

**Before launching (human):** Prefer committing
[`docs/radial-tree-handoff.md`](radial-tree-handoff.md) and
[`docs/radial-tree-design.md`](radial-tree-design.md) to the branch the agent
will use so it can read them. The prompt below is self-contained if those
files are missing.

**Context:** Playtest Waves 0–4 are on `main`. This is Wave 5: ship **Classic
lattice** and **Radial** progression in parallel, toggleable from Settings.

---

````PROMPT
You are the **central orchestrator** for healgame **Wave 5 — Radial talent
tree (dual-ship)**. You delegate middle chunks to subagents, own foundations +
integration + PR, and verify gates yourself. Work autonomously to the end.

Minimize your own context cost: do not dump large files into your thread when
a subagent can own them. Do not wait for the user unless blocked on a true
product decision not locked below — if blocked, pick the reversible default,
note it in the PR, continue.

================================================================================
MISSION
================================================================================

Ship **one PR** from **latest `origin/main`** that adds a **Radial** talent /
spell progression system **beside** the existing lattice tree. Players pick
mode in **Settings** (switching **wipes the save and restarts**). Both modes
must work for friend A/B testing.

Combat still only consumes **`CombatMods`**. Do not make the engine depend on
tree topology.

**Done means (verify each yourself before declaring victory):**

1. Branch from up-to-date `origin/main`.
2. Fresh installs default to **`progressionMode: 'lattice'`** — existing
   lattice journey / loadout behavior stays green.
3. Settings exposes **Talent tree: Classic | Radial** (wording OK if clear).
   Switching requires confirm → **wipe save** → restart in that mode.
4. Radial new game: bar has **Heal** + **Bonk** (plain names, new spell ids).
   Tree shows them **prepurchased**. **Mend** is an obvious Ring-1 unlock that
   teaches spending.
5. Specializing a spell **auto-replaces** the action-bar slot and **removes**
   the previous spell from the library (no dual versions).
6. Rings gate by level: **Ring 1 = Lv1–4**, **Ring 2 = Lv5–9**,
   **Ring 3 = Lv10+** (`minLevel` on nodes).
7. Ring 2 **offense fork**: unlock **Vowstrike** XOR **upgraded Bonk** (hard
   lock). Upgraded Bonk A/B = **Mana Bonk** (restore mana on Bonk) vs
   **Blessed Bonk** (stacking +10% next heal, cap 3).
8. Ring 2 also offers **Still Waters**, **Wrath**, **Frenzied Liturgy** as CD
   spokes (player cannot afford all; specialization matters).
9. A/B picks use a **modal** (not two rival nodes on the wheel). Hard lock.
10. Save key rotated (**v8 → v9**); no migration of old saves.
11. `npm run verify` green. PR opened with Summary + Test plan + how to A/B
    the two modes.

================================================================================
READ FIRST (authority order — highest wins)
================================================================================

1. **This prompt** (locked micro-choices win for v1 scope)
2. `docs/radial-tree-handoff.md` if present on the branch (chunk/file map)
3. `docs/radial-tree-design.md` if present (intent / history)
4. `CLAUDE.md` — gates, hard rules, working style
5. `AGENTS.md` — doc conventions
6. Module contracts as needed:
   - `game/src/tree/AGENTS.md`
   - `game/src/combat/README.md`
   - `game/src/data/README.md`
   - `.claude/skills/rotate-save-version/SKILL.md`
   - `.claude/skills/add-interactive-control/SKILL.md`
7. Touchpoints (point subagents; do not paste wholes):
   - `game/src/data/talentTree.ts` (`TALENT_TREE`, `loadoutFromSave`, `CombatMods`)
   - `game/src/tree/*` (reuse service: exclusiveGroup, minLevel, ownedContents)
   - `game/src/scenes/TreeScene.ts`, `SettingsScene.ts`, `HubScene.ts`
   - `game/src/save/save.ts` (`SAVE_KEY`, `resetSave`, `SaveData`)
   - `game/src/combat/engine.ts` + `types.ts` (castBuff / heal potency)
   - `game/scripts/journey.mjs` + `docs/semantic-targets.md`

================================================================================
DELEGATION PROTOCOL (NON-NEGOTIABLE)
================================================================================

You are a **thin orchestrator**. Subagents implement; you integrate.

1. **Chunk 0 and final QA/PR are YOURS.** Delegate chunks 1–4.
2. **One subagent per chunk**, synchronous. If a chunk fails after one retry,
   take over or escalate model — you still own the outcome.
3. Every subagent prompt MUST include:
   - Exact docs/paths to read
   - File ownership: CREATE / MAY EDIT / DO NOT TOUCH
   - Pinned public API contracts (signatures) for anything later chunks consume
   - Locked micro-decisions from this prompt (no open design questions)
   - Definition of done = runnable gate commands
   - “Report cross-boundary friction; do not fix outside your scope.”
4. Sequential when files overlap. **After chunk 0**, chunks **1 and 2 may run
   in parallel** (radial data vs combat stacks — disjoint). Then 3 → 4 → you.
5. After every chunk: run gates **yourself** (`verify:fast` mid-flight), read
   the diff, fix cross-boundary integration yourself, **commit one checkpoint
   per chunk**.
6. Do **not** paste whole source files into your thread.

### Chunks

| Id | Who | Depends | Owns | Deliverable |
|----|-----|---------|------|-------------|
| **0** | You | — | Save rotate v9 + `progressionMode`; `loadoutForSave` facade; retarget call sites; Settings toggle + wipe confirm; stub radial starter Heal+Bonk; lattice path unchanged | Mode switch works; lattice still plays; verify:fast |
| **1** | Subagent | 0 | `game/src/data/radial/**` pure spells/tree/resolve + tests (no Phaser) | Ring 1–2 data: Mend, Heal s1 A/B, Big Heal, Mend s1, offense fork, Vowstrike s1, 3 CDs, specializeSpell replace |
| **2** | Subagent | 0 | `combat/types.ts`, `engine.ts`, combat tests, README note | Blessed Bonk stacking next-heal potency (cap 3) |
| **3** | Subagent | 1 | Radial tree UI (new scene **or** TreeScene mode — pick in chunk 0 and document); A/B modal; polar layout; semantic target names | Clickable wheel + modal specialize |
| **4** | Subagent | 1–3 | Ring 3 nodes; synergy resolve polish; radial journey/smoke path; light balance bot coverage for radial starter/mid kit | Lv10+ sinks + automated radial path |
| **5** | You | 1–4 | Integration, full `npm run verify`, `poc-qa` + CHANGELOG notes, open PR | Green dual-ship PR |

**Suggested branch:** `playtest/wave-5-radial-tree`

================================================================================
LOCKED MICRO-CHOICES (v1)
================================================================================

### Mode / save
- `SaveData.progressionMode: 'lattice' | 'radial'` (default `'lattice'`).
- Rotate `SAVE_KEY` to `healgame-save-v9`; delete stale keys (including v8).
- Update `journey.mjs` SAVE_KEY + seeds in the **same** commit as the rotate.
- Settings: two clear options or a toggle; **confirm** copy that save will be
  wiped; then `resetSave` / equivalent with the chosen mode and restart scene
  flow (Tutorial for new wipe is fine).
- No migration of lattice `treeRanks` into radial.

### Facade
```ts
loadoutForSave(save): CombatMods
```
- Lattice → existing `loadoutFromSave` behavior.
- Radial → `loadoutFromRadialSave`.
- All combat / hub / loadout entry points use the facade.

### Naming
- Base spells: plain English — **Heal**, **Mend**, **Bonk**, **Big Heal**,
  **Vowstrike**.
- Flavor only on specialized forms — **Zealous Heal**, **Solemn Heal**,
  **Vowstrike: Absolution**, **Vowstrike: Reckoning**, **Mana Bonk**,
  **Blessed Bonk**.
- New radial spell ids (do not reuse `solemn-mend` etc. for radial catalog).

### Starter / Ring 1 (minLevel 1)
- Prepurchased: Heal, Bonk (show owned on wheel; already in unlockedSpells/bar).
- Purchases (1pt each):
  1. `mend` — grant Mend
  2. `heal-s1` — A/B Zealous Heal vs Solemn Heal (specialize Heal)
  3. `big-heal` — grant Big Heal (slow/big; start from live Solemn Vigil-ish numbers)
  4. `mend-s1` — A/B **Arming Mend** (next Heal or Big Heal +2 heal) vs
     **Battle Mend** (after Bonk/Vowstrike, next Mend costs 1 less mana)
- No Instant / Buff / Guard spokes in v1.
- No global subclass / oath.

### Ring 2 (minLevel 5)
- `offense`: Vowstrike XOR Bonk Upgrade; Bonk Upgrade then A/B Mana Bonk
  (e.g. +1 mana on Bonk hit) vs Blessed Bonk (stacks).
- `vowstrike-s1`: Absolution vs Reckoning (reuse live castBuff behaviors).
- CDs: `still-waters`, `wrath`, `liturgy` — three spokes, limited points.
- `big-heal-s1`, `heal-s2`: dope A/Bs (not +1 filler). See handoff for intent.

### Ring 3 (minLevel 10)
- Thin: further A/B on Heal line, further A/B on owned offense, dope upgrades
  if Wrath / Still Waters owned. Exact ints in data.

### A/B UX
- Single socket → modal with A vs B stats/fantasy → confirm → fill socket.
- Hard lock; no forsaken-path consolation; no visible rival node.

### Bar / spellbook
- `specializeSpell { fromId, toId }` removes fromId everywhere and equips toId
  if fromId was on the bar.

### Bonk stacks (combat contract)
- If `nextHealPotencyPct` cannot stack, add engine support, e.g.
  `{ kind: 'stackNextHealPotencyPct'; pct: 10; cap: 3 }`.
- On Bonk complete: increment stacks to cap. On next heal (heal>0) land: apply
  floor(heal * stacks * pct / 100) or ceil — match existing potency rounding
  (`Math.ceil` like Vowstrike), then clear stacks.
- Lattice spells unaffected. Unit-test.

### UI / presentation
- Center node + result BUILD stamp: **placeholders OK** (do not redesign BUILD
  into radial silhouette unless trivial).
- Prefer **RadialTreeScene** (or clear mode branch) so lattice TreeScene stays
  stable.
- Temp art rules still apply (CLAUDE.md).

### Journey / names
- Update `docs/semantic-targets.md` for new controls:
  - settings mode controls
  - `treeChoice:a` / `treeChoice:b` (or option ids)
  - radial `treeNode:<spotId>`
- Lattice journey must pass in lattice mode.
- Add a focused **radial** journey/smoke path (Mend → Heal specialize → assert
  spell ids). Full lattice B-path need not be fully duplicated for radial.

### Numbers
- Start by cloning live lattice-ish magnitudes into radial ids; tune only if
  balance bots / smoke fail. Do not hand-derive a full rebalance of all
  dungeons in this PR.

================================================================================
NON-GOALS (REJECT CREEP)
================================================================================

- Deleting or “finishing” the lattice tree
- Save migration / keeping progress across mode switch
- Respec, dual-spec, Vigil/Zealot subclass identity
- Defense / Dark / Light axes
- New Instant / Buff spokes
- Relic redesign, BUILD→circle art pass
- Icon pass on lattice glyphs
- Roguelike run structure
- Broad UI polish unrelated to radial tree / settings toggle

================================================================================
QUALITY BAR
================================================================================

From `game/`:

```bash
npm run verify:fast   # after each chunk
npm run verify        # before PR open
```

- Engine purity: nothing under `combat/` / `data/` / `tree/` / `meta/` / `save/`
  imports Phaser or uses wall-clock / `Math.random` (eslint bans).
- Colocated tests for: radial resolve (specialize replace, offense XOR, grants),
  Bonk stacks, save mode default + wipe behavior (pure where possible).
- Never commit red. Commit style: what + why, one checkpoint per chunk.
- PR via `gh pr create` with Summary + Test plan (Classic path / Radial path /
  Settings wipe). No force-push to `main`.

================================================================================
STARTUP SEQUENCE (DO THIS FIRST)
================================================================================

1. `git fetch origin` && branch from `origin/main`
   (suggested: `playtest/wave-5-radial-tree`).
2. Read handoff/design docs if present; otherwise rely on locks above.
3. Write a short internal chunk plan (ownership lists) — keep it short.
4. Execute Chunk 0 yourself → commit.
5. Delegate 1 ∥ 2 → verify → commit each.
6. Delegate 3 → 4 → verify → commit each.
7. Chunk 5: integrate, full verify, poc-qa + CHANGELOG, open PR.
8. Final message: PR URL, how to toggle modes, what is placeholder, residual
   risks, follow-ups (Instant/Buff, BUILD silhouette, balance pass).

If a locked choice is impossible against current engine constraints, state the
issue in one paragraph, implement the smallest reversible workaround, note it
in the PR, and continue. Do not stall on taste or brainstorm spells outside v1.
````
