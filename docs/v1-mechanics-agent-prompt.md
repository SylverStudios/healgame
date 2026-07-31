# Cloud agent prompt — Road to 1.0 player mechanics

Status: planning · Authority: paste into a cloud/remote agent · Last verified:
2026-07-31

**How to use:** Check out branch **`v1/player-mechanics`**. Select everything
inside the `PROMPT` fence and paste it as the agent’s initial instruction.

**Bible (wins conflicts):**
[`docs/v1-mechanics-handoff.md`](v1-mechanics-handoff.md)

**Feel / fantasy (modifiers only):**
[`docs/relic-revamp-brainstorm.md`](relic-revamp-brainstorm.md)

**Skills to follow when relevant:**

- `.claude/skills/rotate-save-version/SKILL.md`
- `.claude/skills/add-interactive-control/SKILL.md`
- `CLAUDE.md`, `AGENTS.md`

---

````PROMPT
You are the **central orchestrator** for healgame **Road to 1.0 — Player
mechanics**. You delegate middle chunks, own foundations + final integration,
verify gates, and open **one PR**. Work autonomously to the end.

Start from branch **`v1/player-mechanics`** (planning docs already committed).
Rebase/merge latest `origin/main` if needed before coding. Do not build on
unrelated art branches.

Minimize context cost: do not paste whole source files into subagent threads
when a file-ownership list + contract signatures suffice.

If blocked on a product choice not locked in the handoff, pick the reversible
default, note it in the PR, continue.

================================================================================
MISSION
================================================================================

Ship the **cards** progression loop as the real 1.0 player path, with four
systems:

1. **Loadout** — 4 equipped spells; UI reachable in cards Hub.
2. **Modifiers** (ex-chips) — significant-only mutations; clear → points →
   authored 3-way drafts (existing album flow).
3. **Upgrades** — every level-up, pick 1 of 4 secondaries (block / crit /
   haste / manaRegen); ranks persist; applied in combat.
4. **Cooldown choice** — L6 pick 1 of Set A (existing 3 majors); L8 pick 1 of
   Set B (**3 brand-new distinct CD ids**). Persist choices. No auto-grant of
   all three legacy CDs.

Also: **default new saves to `progressionMode: 'cards'`**. Lattice/radial stay
dual-shipped (do **not** delete them this PR).

Bible (read fully before coding):
`docs/v1-mechanics-handoff.md`

Also read:
- `CLAUDE.md`, `AGENTS.md`
- `game/src/data/loadout.ts`, `game/src/save/save.ts`
- `game/src/data/cards/**`, `game/src/meta/progression.ts`
- `game/src/data/cooldowns.ts`, `game/src/combat/README.md`
- `.claude/skills/rotate-save-version/SKILL.md`
- `.claude/skills/add-interactive-control/SKILL.md` when adding journey targets

================================================================================
DONE MEANS (verify yourself before victory)
================================================================================

1. Fresh install / `newSaveData()` → **cards** mode (Heal+Bonk, album, no
   lattice tree as the default path).
2. Cards Hub: **Spells** album **and** **Spellbook/Loadout** (`hubLoadout`)
   both work; player can rearrange 4 slots.
3. Clear dungeon → +1 `upgradePoints` → can spend on **significant** modifiers
   only (power-only chips not offered).
4. Level-up → modal/UI offers **block | crit | haste | manaRegen** → pick one
   → rank saved → next fight applies effect.
5. **Block**: tank only, **deterministic** — every N damage (post-armor
   accumulator), block 1; upgrades reduce N. **No RNG for block.**
6. **Crit**: chance × ~+50% on player heals + player spell damage; injected
   `rng` on engine; tests never-proc by default.
7. **Haste**: reduces player **castMs only**; GCD unchanged.
8. **Mana regen**: rank stacks into existing regen merge.
9. Level 6 → choose 1 of Still / Wrath / Liturgy; Level 8 → choose 1 of **three
   new distinct CDs** you author; both persist on save; loadout uses choices.
10. Short `// Future:` note that upgrades will become dungeon-thematic gear
    slots (chest/legs/hands/boots/shoulders/head/rings/necklace) — do not build
    gear UI.
11. Save bump if needed; journey names for new controls; `npm run verify`
    green; **one PR** with try-steps.

================================================================================
LOCKED RULES (do not reopen)
================================================================================

- Magnitudes may be **stubs** — keep `balance.test.ts` green (secondaries off
  or tiny on default kits; crit rng never in bots).
- Modifier catalog: park/remove pure number bumps from **offers**; keep
  mechanical/synergy/castBuff/conditional chips.
- Set B CDs must be **new ids**, not duplicates of Set A.
- Do **not** delete lattice/radial/relics this PR.
- Do **not** implement gear-slot Upgrade UI (hint comment only).
- Do **not** use `Math.random` inside `combat/`, `data/`, `meta/`, `save/`.
- Numbers are data (integers). Engine purity rules in CLAUDE.md still apply.
- Every new interactive control gets `setName` + journey coverage
  (`docs/semantic-targets.md` + add-interactive-control skill).

================================================================================
CHUNKS
================================================================================

| Chunk | Owner | What |
|---|---|---|
| M0 | YOU | Re-read bible; plan file ownership; no product reopen |
| M1 | YOU | Save: `secondaryRanks`, `chosenCooldownIds`, pending fields as needed; `newSaveData` default `'cards'`; `npm run save:bump` if golden breaks; stub `data/secondaryStats.ts` + Set B id list placeholders |
| M2 | subagent | Engine haste + manaRegen from secondaries + unit tests |
| M3 | subagent | Engine tank block every-N (accumulator) + crit + `rng` option + event flags + tests |
| M4 | subagent | Level-up Upgrade picker (Hub interrupt) + wire `applyCombatResult` / Hub; journey names |
| M5 | subagent | Remove auto CD unlocks from cards table; Set A/B offers; author 3 new Set B `CooldownDef`s; picker UI; `loadoutFromCardSave` uses `chosenCooldownIds` |
| M6 | subagent | Cards Hub: show `hubLoadout` → LoadoutScene |
| M7 | subagent | Modifier offers = significant-only (edit `chips.ts` / `draft.ts` as needed) |
| M8 | YOU | Integration, cards journey updates, full `npm run verify`, open PR |

Pinned contracts: handoff §§2, 5. **Block is deterministic. Haste is castMs
only. Default mode is cards. Set B is three new CDs.**

================================================================================
DELEGATION PROTOCOL (non-negotiable)
================================================================================

- One subagent per chunk M2–M7, sequential when files overlap; after each: YOU
  run `npm run verify:fast` from `game/` (full `verify` before PR).
- Central agent owns M0, M1, M8 and any cross-cutting save/loadout facade edits
  if subagents would conflict.
- Prefer pure logic + tests before UI for engine chunks.
- Commit one checkpoint per finished chunk (what + why).
- Do not amend commits unless hooks auto-modified files and amend rules in
  user/git policy allow.

================================================================================
IMPLEMENTATION NOTES (contracts)
================================================================================

### Save (illustrative — names may vary but semantics must match)

```ts
secondaryRanks: Partial<Record<'block' | 'crit' | 'haste' | 'manaRegen', number>>
chosenCooldownIds: string[]  // 0..2
// pending flags for Hub interrupts as needed
```

Default: `progressionMode: 'cards'`.

### Block algorithm (tank only)

```
carry += postArmorDamage
blocked = floor(carry / N)
carry %= N
final = max(0, postArmorDamage - blocked)
// then consistent floor-1 policy — unit test it
```

N from rank table; rank 0 = block disabled. Higher rank → smaller N.

### Crit

After raw heal/damage assembled in `completePlayerCast`; multiply on proc;
flag events. `CombatEngineOptions.rng?: () => number`.

### Haste

`effectiveCastMs = floor(castMs * (1000 - hastePermille) / 1000)` at cast
start; GCD_MS unchanged.

### CD sets

- Set A @6: `still-waters`, `wrath-ascendant`, `frenzied-liturgy`
- Set B @8: three NEW defs in `cooldowns.ts` (reuse existing effect fields if
  possible; stub numbers OK)

### Future hint

In `secondaryStats.ts` (or upgrades module), comment:

```
// Future: present upgrades as dungeon-thematic gear slot picks
// (chest, legs, hands, boots, shoulders, head, rings, necklace).
```

================================================================================
PR
================================================================================

Open one PR from `v1/player-mechanics` → main.

Title: something like `feat(progression): cards default, upgrades, CD choice`

Body must include:
- Summary of the four systems
- Try-steps: new game (cards default) → equip loadout → clear → spend modifier
  → level up and pick secondary → at 6/8 pick CDs
- Note stub magnitudes + Set B stubs for Balance phase
- Note lattice/radial still present but not default

================================================================================
QUALITY BAR
================================================================================

- `npm run verify` green from `game/` before declaring done.
- No drive-by refactors outside ownership.
- Docs: bump handoff Last verified / checkboxes if you complete items; prepend
  CHANGELOG only if you ship user-facing behavior (yes — do a short CHANGELOG
  entry). Do not delete this planning handoff until phase is fully merged and
  a human runs ship-phase.
````
