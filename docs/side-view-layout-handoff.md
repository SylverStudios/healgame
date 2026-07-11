# Side-view combat layout — handoff

Status: historical · Authority: none (shipped 2026-07-11; see poc-qa.md "Side-view layout QA") · Last verified: 2026-07-11

**Audience:** whoever implements the facing-line layout. Read after
`CLAUDE.md` / `AGENTS.md`. **This doc wins on layout scope below**;
`poc-spec.md` still wins on combat rules; party hotkeys stay out of PoC
unless Decision D is explicitly reopened.

**Baseline:** main @ Phase 3 merge (`20ee48a`). Combat UX (numeric floats,
dev log, cast cancel, armed borders, per-role swings) is **shipped** — see
`docs/poc-qa.md` Phase 3 section and historical `docs/phase-3-combat-ux-handoff.md`.
This phase is presentation layout only on top of that.

## Mission

Make combat read as a **side-view facing line**: party on the left looking
right, enemies on the right looking left, everyone on a shared ground line.
Keep existing Phase 3 feedback (lunge / `-N`+`+N` floats / flash / log /
cancel toast). No engine, save, or balance changes. Kenney tiles stay for
now (layout + optional flip only).

## Why

Design intent (GDD §6, CombatScene header, tech-options) already describes a
Darkest Dungeon–style facing line. The scene still ships **two vertical
columns** (`PARTY_X` / `ENEMY_X` + `slotY`). Combined with top-down Kenney
tiles, it reads as overhead, not side-view.

## Done means (user-observable)

1. Party units share one ground Y and are spaced left→right on the left half.
2. Enemy units share that ground Y and are spaced left→right on the right half.
3. Party faces right, enemies face left (`flipX` or equivalent).
4. Target marker still reads clearly (not the old left-of-column chevron).
5. Phase 3 feedback still works: lunge, `-N`/`+N` floats, combat log,
   Escape cancel + toast, armed spell border.
6. Gates green: `npm run check`, `npm run smoke`, `node scripts/journey.mjs`.
7. `docs/poc-qa.md` notes the layout change; this handoff → `historical` when
   shipped.

## Locked decisions

### A — Composition (not new art)

- Shared `GROUND_Y`; horizontal `slotX` for party and enemies.
- Keep Kenney Tiny Dungeon tiles and current display sizes (64 / 48 / 112).
- Apply `flipX` so party faces right and enemies face left (stopgap; tiles
  remain top-down silhouettes).
- Optional: one flat ground rect/line under the battle line. No background art
  pack, no walk/attack animations.

### B — Party order on X

Engine order is `tank → dps1 → dps2 → healer`. **Visual order (left→right):**

`healer · dps2 · dps1 · tank`

Tank is nearest the enemy line (front); healer farthest back. Presentation
only — engine array order unchanged. Journey / targeting must use **unit id**
(tank), not “leftmost sprite.”

### C — Rough layout constants (tune in play; keep integer)

Viewport 960×540. Illustrative starting point:

```ts
const GROUND_Y = 340;
const PARTY_SLOT_LEFT = 80;    // healer (back)
const PARTY_SLOT_RIGHT = 380;  // tank (front)
const ENEMY_SLOT_LEFT = 580;   // nearest party
const ENEMY_SLOT_RIGHT = 880;  // farthest / boss center when n=1
```

Boss (n=1) centers in the enemy X range. Prefer moving units, not HUD.

**HUD already on main (do not break):**

| Element | Placement today | Side-view note |
|---------|-----------------|----------------|
| Combat log | Top-right (`Log ▸`, expand panel ~280× wide) | Stays; ground line clears vertical overlap with the old enemy column |
| Boss cast bar | Top-center y≈54 | Unchanged |
| Player cast bar + GCD | y≈448 | Unchanged; toast at y=420 |
| Spell bar | y=502 | Unchanged |
| Rewards | Top-left | Unchanged |
| Result overlay Return | Center (~480, 330) | Unchanged |

If `GROUND_Y` + boss height (112) crowds the cast bar, nudge `GROUND_Y` up
slightly — do not relocate the log or spell bar for this phase.

### D — Journey / keybinds (see analysis below)

**Default for this phase:** update `journey.mjs` `UI` coords for the new tank
home (and Return if it moves). Do **not** reopen party hotkeys solely for
test convenience.

**Optional follow-up (explicit reopen):** combat-only keybinds so
`playCombat()` is keyboard-driven — see § Journey & keybinds.

## Out of scope

- Side-profile art pack / custom frames
- Walk, idle, or attack animations
- Engine spatial model, formation rules, or targeting changes
- Hub / tree / tutorial layout
- Party hotkeys (poc-spec §4 / §9) unless Decision D is reopened
- Reopening Phase 3 UX (float style beyond light tune, log keybind, cancel
  rules, swing intervals)

## Chunks

| id | what | depends on | owns | who |
|----|------|------------|------|-----|
| 0 | **CENTRAL.** Baseline gates green on main; bible = this doc; confirm float tune already landed (leave alone) | — | verify only | central |
| 1 | Layout: `slotX`, ground Y, party order, optional ground line, facing flip, target-marker + name placement | 0 | `CombatScene.ts`, `unitSprite.ts` | subagent |
| 2 | **CENTRAL.** Journey UI coords; smoke eyeball; poc-qa note; mark this handoff historical; full journey | 1 | `journey.mjs`, `poc-qa.md`, this file | central |

Sequential only — chunk 1 and 2 share the tank home coordinate contract. No safe parallelism.

## Files

| File | Change |
|------|--------|
| `game/src/scenes/CombatScene.ts` | Replace column constants + `slotY` with ground/slotX; pass facing into sprites; optional ground graphic |
| `game/src/ui/unitSprite.ts` | `facing` / `flipX`; retarget marker; name may sit below sprite |
| `game/scripts/journey.mjs` | Update `combatTank` (and any other combat coords that moved) |
| `docs/poc-qa.md` | Append layout decision |
| `docs/unit-art.md` | Only if flip/facing policy is worth a one-liner |

**Leave alone unless forced:** `combatLog.ts` (top-right), `spellBar.ts`,
`combat/engine.ts`, encounters, save, BootScene.

## Journey & keybinds

### What journey depends on today (post–Phase 3)

| Interaction | How journey drives it | Positional? |
|-------------|----------------------|-------------|
| Spell cast | `keyboard.press('1')` | No |
| Target tank | `mouse.click(combatTank)` @ `(170, 95)` | **Yes — combat layout** |
| Return after wipe | blind `mouse.click(combatReturn)` | Yes — overlay |
| Escape cast cancel | (manual QA; not journey-driven) | Key — already shipped |
| Tutorial / hub / tree | mouse clicks on `UI.*` | Yes — **not** combat layout |
| Vigil tooltip (B2) | `mouse.move(combatSpellSlot)` | Yes — spell bar hover |

Combat already uses hotkeys for spells. The **only combat-layout-coupled click**
in the fight loop is targeting the tank. Return is overlay-centered and
independent of the battle line.

### If every interactable had a keybind

**Combat loop (`playCombat`): yes.** With party-slot keys and a Return /
Enter dismiss on the result overlay, the fight loop could drop mouse coords.
Escape already cancels casts (Phase 3) — that is not the same as Return.

**Full journey: not automatically.** Hub / tutorial / tree stay click-driven.
Tooltip verification still needs hover.

### Scope conflict

`poc-spec.md` §4 / §9: **party hotkeys not in PoC.** Phase 3 kept them out.
Adding them “for journey” is a deliberate scope reopen and should ship as
real player UX (visible hints), not test-only ghosts.

### Recommendation

| Path | When |
|------|------|
| **Update coords** (default) | This layout phase — one `combatTank` line change |
| **Combat keybinds** (optional reopen) | If we want layout freedom + better play UX; own small chunk with on-screen hints |
| **Keybind everything** | Not worth it for journey alone; hub/tree stay click-OK |

## Definition of done

- [ ] Party left / enemies right on shared ground Y; facing applied
- [ ] Target marker + bars readable; Phase 3 log/toast/floats still fine
- [ ] `npm run check` + `npm run smoke` pass
- [ ] `node scripts/journey.mjs` pass (UI table updated)
- [ ] `poc-qa.md` updated; this handoff set to `historical`
