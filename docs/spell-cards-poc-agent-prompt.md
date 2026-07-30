# Cloud agent prompt — Spell-card upgrades PoC

Status: planning · Authority: paste into a cloud/remote agent · Last verified:
2026-07-30

**How to use:** Check out branch **`poc/spell-card-upgrades`** (this prompt +
handoff are committed there). Select everything inside the `PROMPT` fence and
paste it as the agent’s initial instruction.

**Bible (wins conflicts):**
[`docs/spell-cards-poc-handoff.md`](spell-cards-poc-handoff.md)

**Background only:**
[`docs/spell-card-upgrades-brainstorm.md`](spell-card-upgrades-brainstorm.md)

---

````PROMPT
You are the **central orchestrator** for healgame **Spell-card upgrades PoC**.
You delegate middle chunks, own Chunk 0 + final integration, verify gates, and
open **one PR**. Work autonomously to the end.

Start from branch **`poc/spell-card-upgrades`** (already has planning docs).
Rebase/merge latest `origin/main` if needed before coding. Do not build on
unrelated art branches.

Minimize context cost: do not paste whole source files into subagent threads
when a file-ownership list + contract signatures suffice.

If blocked on a product choice not locked in the handoff, pick the reversible
default, note it in the PR, continue.

================================================================================
MISSION
================================================================================

Dual-ship a third progression mode **`cards`** (“Spell cards” in Settings):

- No relics, no talent-tree path.
- Free level unlocks for spells + major CDs.
- Spend **upgrade points** only on **random chip drafts** that fill slots on
  spell cards.
- Resolve everything into existing **`CombatMods`** (engine unchanged).

Bible (read fully before coding):
`docs/spell-cards-poc-handoff.md`

Also read: `CLAUDE.md`, `AGENTS.md`, `game/src/data/loadout.ts`,
`game/src/save/save.ts`, `game/src/data/radial/resolve.ts` (pattern to mirror),
`.claude/skills/rotate-save-version/SKILL.md`,
`.claude/skills/add-interactive-control/SKILL.md` when adding journey targets.

================================================================================
DONE MEANS (verify yourself before victory)
================================================================================

1. Settings: Classic | Radial | **Spell cards**; switch wipes save → Tutorial.
2. Cards new game: Heal + Bonk; album/Spells UI; can spend upgrade points.
3. Level unlocks exactly as handoff §3:
   - Lv1 heal+bonk, Lv2 mend, Lv5 vowstrike,
   - Lv6 still-waters, Lv7 wrath-ascendant, Lv8 frenzied-liturgy
   - +1 upgrade point every level; unlocks are free.
4. Spend flow: pick spell with free slot → 3 offers from pool ≤6 → chip sticks
   → combat uses baked mods (including Arming Mend / Battle Mend chips).
5. RelicScene never opens in cards mode; first-clear grants bonus upgrade point.
6. Hub cards mode: single **Spells** entry via `hubTree` → album; hide loadout;
   lattice + radial still work.
7. `npm run verify` green; PR opened with try-steps.

================================================================================
CHUNKS
================================================================================

| Chunk | Owner | What |
|---|---|---|
| 0 | YOU | Mode shell, save fields + bump, Settings button, loadout stub, relic skip, Hub route stub |
| 1 | subagent | Unlock table + level-up grants + points economy + tests |
| 2 | subagent | Chip defs, draft roll, resolve apply, synergy tests, purchase helper |
| 3 | subagent | CardAlbumScene + draft modal + semantic names + cards journey smoke |
| 4 | subagent | Hub/Tutorial/first-clear polish for cards |
| 5 | YOU | Balance smoke, retune if needed, full verify, open PR |

Pinned contracts, chip tables, unlock table, semantic names, non-goals: all in
the handoff. **Do not invent alternate unlock levels or relic behavior.**

================================================================================
DELEGATION PROTOCOL (non-negotiable)
================================================================================

- One subagent per chunk 1–4, sequential; after each: YOU run
  `cd game && npm run verify:fast`, read the diff, fix cross-boundary gaps,
  **commit one checkpoint** (message: what + why).
- Every subagent prompt includes: handoff path; CREATE / MAY EDIT / DO NOT TOUCH;
  copied API signatures from handoff §6; locked micro-decisions; DoD = verify:fast;
  “report cross-boundary friction, do not fix outside scope.”
- Parallelism only if ownership is disjoint (it is not — stay sequential).
- Never commit red. Never `--no-verify`. Do not force-push `main`.

================================================================================
QUALITY BAR
================================================================================

- Numbers in `game/src/data/` only; integers.
- No Phaser / Math.random / Date in `combat/`, `data/`, `tree/`, `meta/`, `save/`
  (draft uses injected `random` from caller).
- Interactive controls get `setName` + `docs/semantic-targets.md` updates.
- Save shape changes → rotate-save-version skill / `npm run save:bump`.
- Prefer extending `loadoutForSave` over scene-level mode switches for combat kit.

================================================================================
SCOPE / NON-GOALS
================================================================================

Reject: deleting lattice/radial; relic art; Big Heal / specializes / oaths;
CD chip pools; respec; new engine mechanics; party-stat chips; soft save
migration.

================================================================================
WHEN DONE
================================================================================

1. Run full `npm run verify` yourself.
2. Open PR with summary, Settings try-steps, and checklist mapped to Done means.
3. Short note in PR: any reversible defaults you picked.
````
