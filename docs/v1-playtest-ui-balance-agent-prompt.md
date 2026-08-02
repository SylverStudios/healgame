# Cloud agent prompt — Playtest UI + dungeon order

Status: planning · Authority: paste into a cloud/remote agent · Last verified:
2026-08-02

**How to use:** Check out branch **`v1/playtest-ui-balance`**. Select everything
inside the `PROMPT` fence and paste it as the agent’s initial instruction.

**Bible (wins conflicts):**
[`docs/v1-playtest-ui-balance-handoff.md`](v1-playtest-ui-balance-handoff.md)

---

````PROMPT
You are the **central orchestrator** for healgame **Playtest follow-up — UI +
dungeon order**. You delegate middle chunks, own integration, verify gates, and
open **one PR**. Work autonomously to the end.

Start from branch **`v1/playtest-ui-balance`** (planning docs already
committed). Rebase/merge latest `origin/main` if needed before coding.

Minimize context cost: pass subagents ownership lists + contracts, not whole
files.

If blocked on a product choice not locked in the handoff, pick the reversible
default, note it in the PR, continue.

================================================================================
MISSION
================================================================================

Systems are already shipped. This slice is **readability + light mid-game
balance**:

1. **Secondary combat HUD** — Crit countdown on healer + floating crit icon;
   Block countdown on tank + floating block icon. No combat UI for haste/regen.
2. **Upgrade picker numbers** — current → next for block/crit/haste/manaRegen.
3. **Results** — damage done per party character (damage only).
4. **Level-up** — show HP and mana increases per character/role.
5. **Dungeon order** — swap 2↔3 so Ash → **Cinder Vault** → **Iron Pass**; ease
   Cinder for ~**levels 4–5** clears; retune playtest ranges + balance gates.

Bible (read fully before coding):
`docs/v1-playtest-ui-balance-handoff.md`

Also read:
- `CLAUDE.md`, `AGENTS.md`
- `game/src/data/secondaryStats.ts`
- `game/src/ui/upgradePickModal.ts`, `game/src/ui/healerCues.ts`
- `game/src/combat/types.ts`, `game/src/combat/engine.ts` (crit/block carry)
- `game/src/ui/resultPanel.ts`, `game/src/ui/runSummary.ts`
- `game/src/data/dungeons/**`, `game/src/playtest/README.md`
- `.claude/skills/balance-tune/SKILL.md` for Cinder easing
- `.claude/skills/add-interactive-control/SKILL.md` if new clickable controls
- `.claude/skills/rotate-save-version/SKILL.md` only if SaveData shape changes

================================================================================
DONE MEANS (verify yourself before victory)
================================================================================

1. With crit rank > 0: healer shows casts-until-crit; crit casts show a floating
   crit icon.
2. With block rank > 0: tank shows damage-until-block; blocked hits show a
   floating block icon.
3. Upgrade modal shows current and next-if-selected numbers for all 4 stats.
4. Result overlay lists damage dealt per party member.
5. On level-up from a fight, player sees HP and mana gains per character/role.
6. Hub dungeon order is Ash → Cinder → Iron → …; unlocks chain correctly.
7. Cinder playtest roughly targets Lv 4–5; `balance.test.ts` green.
8. `npm run verify` green; one PR with try-steps.

================================================================================
LOCKED RULES (do not reopen)
================================================================================

- Crit/block stay deterministic every-N (no RNG).
- Block = every N **damage** (post-armor), not “hits”.
- Haste/regen: picker numbers only — no new combat chrome.
- Results: **damage done only** this slice.
- Do not delete lattice/radial; do not redesign player progression systems.
- Temp-art OK for icons/badges; no polish creep.
- Engine purity: no Phaser/Math.random/wall clock under combat/data/meta/save.

================================================================================
CHUNKS
================================================================================

| Chunk | Owner | What |
|---|---|---|
| U0 | YOU | Read bible; ownership plan |
| U1 | subagent | Expose crit/block progress on CombatState (+ tests) |
| U2 | subagent | CombatScene/UI: countdowns + float icons |
| U3 | subagent | upgradePickModal current→next numbers |
| U4 | subagent | Damage tallies in engine → CombatResult → result overlay |
| U5 | subagent | Level-up HP/mana delta display |
| U6 | subagent | Swap dungeon order + unlocks + content pins |
| U7 | subagent | Ease Cinder; `npm run content -- playtest`; balance gates |
| U8 | YOU | Integration, full verify, CHANGELOG/poc-qa, open PR |

================================================================================
DELEGATION PROTOCOL
================================================================================

- Sequential when files overlap (`engine.ts`, `CombatScene.ts`, dungeon index).
- After each chunk: `npm run verify:fast` from `game/` (+ `npm run content --
  validate` when content changes). Full `npm run verify` before PR.
- Commit one checkpoint per chunk.
- Central owns U0/U8 and any SaveData bumps.

================================================================================
IMPLEMENTATION NOTES
================================================================================

### Crit/block HUD
Expose carry/N on state so UI can show remaining. Pattern after
`healerCues.ts`. Listen for `crit` / `blocked` on events for floats.

### Picker
Use `blockThreshold(rank)`, `critThreshold`, `hastePermille`,
`manaRegenFromRank` for current and rank+1. Pass ranks into
`buildUpgradePickModal`.

### Damage results
Accumulate damage dealt by source unit in engine; pass through CombatResult;
render compact list in resultPanel/runSummary.

### Level-up deltas
`PARTY_LEVEL_HP` / `LEVEL_MANA.poolPerLevel` × levels gained. Show tank, both
DPS, healer. Regen-rank threshold crossings: mention if a new regen rank
unlocked.

### Dungeon swap
```
DUNGEON_ORDER: ash-gate, cinder-vault, iron-pass, verdant-rift, …
```
- cinder-vault: order 2, unlock ash-gate
- iron-pass: order 3, unlock cinder-vault
- verdant-rift: unlock iron-pass (was cinder)
Update content tests, floor-scaling expectations, journey if needed.

### Cinder ease
Tune authored mob/ability numbers + set `playtestLevelRange` from baked
playtest toward god≈4 / basic≈5. Keep Ash and new Iron gates sensible.

================================================================================
PR
================================================================================

Branch: `v1/playtest-ui-balance` → main.

Title idea: `feat(ui): secondary HUD, results damage, Ash→Cinder→Iron`

Body must include try-steps:
1. Rank crit/block → see countdowns in combat + floats on proc
2. Level-up upgrade modal shows current→next numbers
3. Finish a fight → damage list on results; if leveled, HP/mana deltas
4. Hub shows Cinder as dungeon 2; clear path Ash→Cinder→Iron
5. Note playtest levels after Cinder tune

================================================================================
QUALITY BAR
================================================================================

- `npm run verify` green from `game/` before done.
- No drive-by refactors outside ownership.
- Update handoff checkboxes + short CHANGELOG/poc-qa note.
````
