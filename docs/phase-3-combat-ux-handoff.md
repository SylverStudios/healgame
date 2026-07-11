# Phase 3 handoff — Combat UX legibility

Status: planning · Authority: Phase 3 scope (not yet shipped) · Last verified: 2026-07-10

**Audience:** the central agent running Phase 3. Read after `CLAUDE.md` /
`AGENTS.md`. **This doc wins on Phase 3 scope**; `poc-spec.md` still wins on
untouched PoC rules; `poc-qa.md` / historical handoffs apply unless this doc
explicitly amends them. Nothing below is in the codebase until the phase runs.

## Mission

Make combat and the spell tree readable while playing: who hit whom, what's
casting, what's armed, and what failed — without polish creep or a full
floating-combat-text framework.

## Done means (user-observable; verify each yourself)

1. **Tree tooltips** are node-anchored and stay on-screen; long node titles no
   longer overflow the node box.
2. **Damage floats** show `-N` (including `0` and overkill raw amounts); the
   old `*` hit marker is gone.
3. **Swing cadence** is role-differentiated (DPS faster than tank; trash/boss
   on their own intervals) so simultaneous party swings are rare. Balance
   gates still pass after retune.
4. **Dev combat log** (damage/heal + cast-fail lines), last 20 entries,
   collapsed by default, expand/collapse by **click only** (no keybind).
5. **Cast cancel:** target death mid-cast auto-cancels; Escape cancels active
   cast **and** queue; reserved mana returns; no synergy arm; toast + log line.
6. **Armed synergy** highlights the buffed spell button with a thicker/accent
   border (no floater, no buff strip).
7. Gates green: `npm run check`, `npm run smoke`, `node scripts/journey.mjs`.

## Chunks

| id | what | depends on | owns (CREATE / EDIT) | subagent |
|---|---|---|---|---|
| 0 | **CENTRAL.** Baseline gates green; this handoff is bible; draft swing numbers locked below | — | (verify only; no feature code) | — |
| 1 | Engine: mana reserve + cancel + mid-death cancel; `castCancelled` event; per-role swing intervals; expose armed buffed spell ids on `CombatState`; README + unit/balance tests | 0 | `game/src/combat/`, `game/src/data/constants.ts`, `game/src/data/encounters.ts` (interval fields only) | Sonnet — pure logic |
| 2 | Combat UI: `-N` floats; clickable combat log; Escape + fail toast; spell-button armed border | 1 | `game/src/scenes/CombatScene.ts`, `game/src/ui/` (new `combatLog.ts` ok; `unitSprite.ts`, `spellBar.ts`) | Sonnet — Phaser UI |
| 3 | Tree: node-anchored tooltip + in-node title clamp | 0 | `game/src/scenes/TreeScene.ts`, optionally `game/src/ui/` tooltip helper if shared | Sonnet — scene only |
| 4 | **CENTRAL.** Cross-boundary fixes; journey UI if layout moved; amend `poc-qa.md`; QA note; full journey | 1–3 | `game/scripts/journey.mjs`, `docs/poc-qa.md`, short QA note | — |

Chunks 2 and 3 have disjoint ownership after chunk 1 lands — may run
**parallel**. Default sequential if unsure. Never parallelize 1 with 2.

## Locked decisions (do not re-ask)

### A — Damage floats
- Replace `*` with numeric `-N` (same float motion as heals).
- Always show, including **0** and **overkill** (display the event's raw
  `amount`; engine already emits full swing damage, not clamped to remaining HP).
- Keep heal `+N` unchanged. No FCT framework.

### B — Swing intervals (not phase offsets)
- **No** initial phase offsets. Differentiate by **interval length**.
- Draft data (retune freely if balance gates demand it; shape stays):

```ts
// constants.ts — replace single MERCS.swingIntervalMs
MERCS = {
  tankAutoDamage: 1,
  dpsAutoDamage: 2,
  tankSwingIntervalMs: 2500, // slow
  dpsSwingIntervalMs: 1000,  // fast
}
TRASH.swingIntervalMs = 3000        // keep unless gates need change
GATE_WARDEN.swingIntervalMs = 3500  // desync from trash
HOLLOW_KING.swingIntervalMs = 3500
```

- Both DPS share the same interval (they may sync with each other; tank/DPS/trash/boss must not all share one cadence).
- Engine seeds `swingTimers` from the unit's role/encounter interval.
- **Retune** `balance.test.ts` (and any timing-sensitive combat tests) as needed; keep gate *shape* (no-heal wipe, naive wipe, full-kit clear, Maw unwinnable).

### C — Combat log (dev/debug)
- Collapsed by default; **click** header/toggle to expand/collapse. **No keybind.**
- Lines: `damage` and `heal` events, **plus** `castCancelled` (D6 exception).
- Timestamps: **scene-side elapsed ms** accumulator (easier; no engine clock field).
- Cap: **last 20** lines (drop oldest).
- Placement: corner that does not cover spell bar / party / rewards — suggest
  bottom-left above spell bar or top-right; central agent picks one and pins it
  in the chunk-2 prompt. Temp art only (monospace text + rect).

### D — Cast cancel + mana reserve (amends Phase 1/2 rules)

**Supersedes** combat README + `poc-qa` synergy edge note that said
“target died mid-cast still completes / spends mana / still arms”.

| Moment | Rule |
|---|---|
| Cast **start** | **Reserve** mana: subtract from `healer.mana` immediately (blocks double-spend). Emit `castStarted` as today. |
| Cast **succeeds** (target alive at completion) | Mana already gone = **debited**. Apply heal / arm / consume per existing synergy rules. |
| Cast **cancelled** (Escape, or target dead when checked) | **Refund** reserved mana; clear `playerCast` **and** queue; **do not arm**; emit `castCancelled`. |
| Target dies **during** cast | Auto-cancel at the moment death is applied (or at next tick before complete — pick one, unit-test it; prefer cancel in the same tick the target dies if a cast is targeting them). |
| Escape | Calls `engine.cancelCast()`: clears active cast + queue; refund if a cast was active. Works even if only queue is set (clear queue, no refund). |
| UI | Toast/status line **and** combat-log line (e.g. `Cast failed` / `Cast cancelled`). |

New public API:

```ts
engine.cancelCast(): void
// CombatEvent addition:
| { type: 'castCancelled'; spellId: string; reason: 'escape' | 'target-dead' }
```

Commands stay buffered until next `advance()` (same as `castSpell`).

Queue re-validation: still drops illegal queued casts silently when busy ends;
that is **not** a `castCancelled` (never started).

### E — Bonus feedback (minimal)
- **Only** spell-button **border highlight** when a synergy that buffs that
  spell is armed. No healer floater, no buff strip (easiest; fewest files).
- Expose on `CombatState` (snapshot each read):

```ts
/** Spell ids that currently have at least one armed synergy buffing them. */
armedBuffedSpellIds: string[];
```

- `SpellBar` gets e.g. `setArmedSpellIds(ids: ReadonlySet<string> | string[])`
  and draws a thicker accent stroke on matching buttons.
- Passives / missing-health are **not** highlighted (not “armed” state).
  Curate later if a list is wanted.

### F — Tree hover
- Replace bottom description panel with a **node-anchored tooltip** (reuse
  combat `SpellTooltip` patterns: clamp to canvas, prefer above/below node).
- Clamp/truncate **in-node titles** so they fit `NODE_HEIGHT` / `NODE_WIDTH`.
- If node positions change, update `journey.mjs` `UI` table.

## Pinned contracts (spell out in subagent prompts)

### CombatState / events (chunk 1 → 2)

```ts
interface CombatState {
  // ...existing fields...
  armedBuffedSpellIds: string[];
}

type CombatEvent =
  // ...existing...
  | { type: 'damage'; targetId: string; amount: number; sourceId: string }
  | { type: 'heal'; targetId: string; amount: number; overheal: number; spellId: string }
  | { type: 'castCancelled'; spellId: string; reason: 'escape' | 'target-dead' };
```

### Engine surface additions

```ts
engine.cancelCast(): void  // clear cast + queue; refund if cast was active
// castSpell start: reserve mana (healer.mana -= cost) when cast begins
// complete: mana already reserved — do not subtract again
// cancel / target-dead: healer.mana += cost (refund)
```

### SpellBar

```ts
spellBar.setArmedSpellIds(ids: Iterable<string>): void
// accent border when id is armed; default border otherwise
```

## Non-goals (reject creep)

Third subclass; respec; Aegis/Wildbloom; major CDs; hub buffs; party hotkeys;
real art; audio; tree pan/zoom; buff strip / healer floater icons; full FCT
framework; networking; combat-log keybind; logging non-damage/heal events
except `castCancelled`.

## Doc amendments (chunk 4)

- Update `game/src/combat/README.md` mana + mid-death + cancel sections.
- Append a Phase 3 section to `docs/poc-qa.md` with the locked decisions above.
- Short QA note: how to run + checklist against Done means.

## Document history

| Version | Date | Notes |
|---|---|---|
| v1 | 2026-07-10 | Compiled from user bug/feature list + A–F decisions |
