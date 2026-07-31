# Cloud agent prompt — Road to 1.0 enemy mechanics

Status: planning · Authority: paste into a cloud/remote agent · Last verified:
2026-07-31

**How to use:** Check out branch **`v1/enemy-mechanics`**. Select everything
inside the `PROMPT` fence and paste it as the agent’s initial instruction.

**Bible (wins conflicts):**
[`docs/v1-enemy-mechanics-handoff.md`](v1-enemy-mechanics-handoff.md)

**Background:**
[`docs/playtest-2026-07-30.md`](playtest-2026-07-30.md) cluster A

**Module contracts:**
`game/src/data/README.md`, `game/src/combat/README.md`

---

````PROMPT
You are the **central orchestrator** for healgame **Road to 1.0 — Enemy
mechanics**. You delegate middle chunks, own foundations + final integration,
verify gates, and open **one PR**. Work autonomously to the end.

Start from branch **`v1/enemy-mechanics`** (planning docs already committed).
Rebase/merge latest `origin/main` if needed before coding. Do not invent
product scope outside the bible.

Minimize context cost: pass subagents file-ownership lists + contract
signatures, not whole source dumps.

If blocked on a product choice not locked in the handoff, pick the reversible
default, note it in the PR, continue.

================================================================================
MISSION
================================================================================

Trash must **teach the boss verb** before the boss exam.

- Each enemy has **0 or 1** ability (lift the trash ban; keep max 1).
- Abilities have **cast time**, a visible **cast bar**, and **cooldown**
  cadence (`intervalMs` / existing gap semantics).
- Per dungeon: **lesser trash** + **greater boss** versions of the same
  `kind` / verb family (~40–60% trash intensity; longer/clearer trash cast).
- Prefer **one signature trash caster** per dungeon (other trash may stay
  autos-only).
- Soft boss presentation differences OK (size / telegraph) — **do not** fork a
  second ability DSL.
- **No** interrupt, esuna, cling DoT, or boss summon in this slice.
- **No** new `kind`s unless a verb cannot express with the existing four.

Bible (read fully before coding):
`docs/v1-enemy-mechanics-handoff.md`

Also read:
- `CLAUDE.md`, `AGENTS.md`
- `game/src/data/README.md`, `game/src/combat/README.md`
- `game/src/data/content/{types,validate,compile}.ts`
- `game/src/combat/{types,engine}.ts`
- `docs/playtest-2026-07-30.md` cluster A
- `.claude/skills/add-interactive-control/SKILL.md` only if you add new
  clickable controls (unlikely — cast bars are usually non-interactive)

================================================================================
DONE MEANS (verify yourself before victory)
================================================================================

1. Trash mobs may author `abilityIds: [oneId]`; validate accepts; compile puts
   `cast` on `EnemyGroupDef`.
2. Engine runs casts for trash **and** boss (multi-caster, deterministic).
3. Combat UI shows cast bar (+ telegraph cue when authored) on the casting unit.
4. All ordered dungeons have lesser trash + greater boss pairs (handoff §5 map).
5. Trash packs feel like practice, not empty XP — threat from casts, not HP
   sponges; retune autos/ability numbers via content balance bots.
6. `npm run content -- validate` and `preview --all` clean.
7. `npm run verify` green; balance.test.ts updated if needed.
8. `data/README.md` + `combat/README.md` no longer say “no trash abilities”.
9. Short CHANGELOG + poc-qa note; **one PR** with try-steps
   (Ash Gate trash cast → boss Bonehowl; spot-check a mid dungeon).

================================================================================
LOCKED RULES (do not reopen)
================================================================================

- Max **one** ability per mob. Zero is fine.
- Reuse kinds: `partyAoE` | `tunnelVision` | `partyDoT` | `manaSiphon`.
- Keep engine pure: no Phaser, no Math.random, no wall clock in combat/data.
- Player progression systems are out of scope (do not touch cards/upgrades).
- Do not implement interrupt / esuna / cling DoT / summons.
- Prefer renaming toward `EnemyCastDef` with alias if low churn; do not
  break the world for a rename — function over cosmetics.
- If two focus channels would overlap, pick a simple global rule (boss first,
  else lowest unit id) and document it — at most one active focus channel is
  an acceptable default.

================================================================================
CHUNKS
================================================================================

| Chunk | Owner | What |
|---|---|---|
| E0 | YOU | Read bible; branch; file-ownership plan |
| E1 | YOU or sub | Types + validate (drop trash ban) + compile trash `cast` + content unit tests |
| E2 | subagent | Engine multi-caster schedule/complete for all kinds + tests (`engine*.test.ts`) |
| E3 | subagent | CombatScene: cast bars / telegraphs for any caster unit id |
| E4 | subagent | Author `*-lesser` abilities; wire signature trash mobs; Ash Gate first, then all dungeons |
| E5 | subagent | Tune with `npm run content -- balance`; update `content.test.ts` pins + balance gates |
| E6 | YOU | README/poc-qa/CHANGELOG; full `npm run verify`; open PR |

E4 may stub numbers after E1; E5 retunes after E2–E3 so bots feel casts.

Suggested lesser map (ids flexible if consistent):

| Dungeon | Trash | Lesser | Boss ability |
|---|---|---|---|
| Ash Gate | ash-husk | bonehowl-lesser | bonehowl |
| Iron Pass | iron-husk | tunnel-vision-lesser | tunnel-vision |
| Cinder Vault | cinder-wraith | emberfall-lesser | emberfall |
| Verdant Rift | thorn-husk | needle-gaze-lesser | needle-gaze |
| Black Choir | choir-shade | soul-toll-lesser | soul-toll |
| Gloam Sanctum | gloam-wretch | null-psalm-lesser | null-psalm |
| The Maw | ash-husk | extinction-lesser OR reuse bonehowl-lesser | extinction |

================================================================================
DELEGATION PROTOCOL (non-negotiable)
================================================================================

- One subagent per chunk E2–E5 when useful; sequential if files overlap
  (`engine.ts`, `CombatScene.ts`, mob catalogs).
- After each chunk: YOU run `npm run verify:fast` from `game/` (and
  `npm run content -- validate`). Full `npm run verify` before PR.
- Prefer pure engine + tests before UI.
- Commit one checkpoint per finished chunk (what + why).
- Central agent owns E0, E6, and any cross-cutting type renames.

================================================================================
IMPLEMENTATION NOTES
================================================================================

### Validation
Remove / replace `trash-abilities-unsupported`. Keep max-1 ability rule for
all mobs. Boss wave rules unchanged.

### Compile
When `mob.abilityIds[0]` exists on a trash group, compile the same way boss
casts compile today (`compileAbility`). Attach to `EnemyGroupDef.cast`.

### Engine sketch
- Per-unit cast timer + optional active cast state (not only `bossCast`).
- Events should identify `sourceId` (existing patterns).
- Preserve cadence: `firstCastAtMs`, then `intervalMs` start-to-start / gap
  rules already documented in `combat/README.md`.
- Spawn: when creating trash units from a group with `cast`, arm that unit’s
  cast scheduler.

### UI
- Bind cast bar to caster unit position (boss path already exists — generalize).
- Resolve telegraph cues from ability registry by the mob’s ability id.
- Idle enemies: no permanent cooldown chrome required.

### Content intensity (starting stubs — tune in E5)
Trash lesser ≈ 40–60% of boss damage/duration; often **longer** castMs and
readable firstCast. Fail = scary recoverable chunk, not wipe.

### Docs to update when behavior ships
- `game/src/data/README.md` — trash abilities supported; curriculum note
- `game/src/combat/README.md` — multi-caster rules
- `docs/poc-qa.md` — short decision note
- `docs/CHANGELOG.md` — prepend entry
- Handoff checkboxes / Last verified

================================================================================
PR
================================================================================

Branch: `v1/enemy-mechanics` → main.

Title idea: `feat(combat): trash cast curriculum (lesser → boss verbs)`

Body must include:
- Summary: 0/1 abilities, multi-caster engine, lesser/greater per dungeon
- Try-steps: Ash Gate wave sees trash cast bar → boss Bonehowl; one mid
  dungeon spot-check
- Note any Maw choice (unique lesser vs reuse)
- Note balance retunes

================================================================================
QUALITY BAR
================================================================================

- `npm run verify` green from `game/` before done.
- No drive-by player-progression refactors.
- No new ability scripting language.
- Deterministic tests for multi-caster ordering and at least one lesser cast
  completing in a scripted encounter.
````
