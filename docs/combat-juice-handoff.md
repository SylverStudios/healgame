# Combat juice + forsaken-path tempo — handoff

Status: historical · Authority: this phase's scope · Last verified: 2026-07-11

**Audience:** the central agent running this phase in a **fresh session**. Read
after `CLAUDE.md` / `AGENTS.md`. **This doc wins on juice / tempo / tree
consolation scope below**; `poc-spec.md` still wins on combat rules unless this
doc explicitly amends them. Side-view layout must already be **shipped**
(`docs/side-view-layout-handoff.md` → `historical`) before chunk 0 proceeds.

**Baseline expectation:** main after side-view merge. Phase 3 combat UX
(numeric floats, armed border, cast cancel, combat log) is shipped — see
`docs/poc-qa.md` Phase 3. This phase adds presentation juice, a small tree
service extension, one meta unlock, and spell-bar chrome.

## Mission

Make combat feel heavier and more *Last Spell* (ash, iron, blood-ruby, ember)
without an art pack or a full FCT/proc framework; make mutually exclusive oaths
read at a glance; unlock **1.5× combat pace** as a **forsaken-path** purchase
on the locked rival oath (tree challenge); let the player toggle pace in
combat.

## Done means (user-observable; verify each yourself)

1. **Boss ability screenshake** — camera shakes when a boss cast **lands**
   (`bossCastFinished` / the party-damage from that finish). No shake on merc
   autos, trash autos, player heals, or cast start.
2. **Scaled floats** — `-N` / `+N` font size scales with `amount` (bigger hit /
   heal → bigger text). Motion stays Phase 3 rise+fade.
3. **Target halo** — ember/iron ellipse **under** the targeted ally's feet
   (side-view ground). Player can target without relying on the old side
   chevron alone (chevron may stay as secondary; halo is primary).
4. **Cast effects** — on player `castStarted`: brief caster flash + thin
   ember line/beam toward target. On heal land: existing flash stays; optional
   light ground ripple OK. Temp geometry only.
5. **Armed healer rune** — while `armedBuffedSpellIds` is non-empty, a small
   ember rune / sigil floats near the **healer** (not on the spell button, not
   labeled, no tooltip explaining it). Player infers meaning. Keep the gold
   armed **border** on the buffed spell button.
6. **WoW-ish keycaps** — spell bar hotkeys read as keycap badges (square
   keycap chrome top-left of each button), still temp rects + monospace.
7. **Oath lock icon** — a simple lock glyph/shape drawn **between** the Vigil
   and Zealot oath nodes on the tree. Enough to signal mutual exclusion; no
   severed-bridge art.
8. **Forsaken-path tempo** — after swearing one oath, the **rival** oath spot
   offers a purchasable **1.5× combat pace** consolation (not the rival oath).
   Buying it once; the other forsaken entry is locked out. Tree service must
   support this (see Locked decision T).
9. **Pace toggle** — bottom-corner combat control shows current pace (`1x` /
   `1.5x`); click cycles through **available** paces only. Hidden or inert at
   `1x`-only before unlock. Selection persists in save.
10. Gates green: `npm run check`, `npm run smoke`, `node scripts/journey.mjs`.
11. `docs/poc-qa.md` gets a phase section; this handoff → `historical` when
    shipped. Update `game/src/tree/AGENTS.md` for the consolation rule.

## Prerequisite

| Gate | Required |
|------|----------|
| Side-view layout | Shipped on the branch you start from (party left / enemies right / shared ground / facing). If still `planning`, **stop** and wait or rebase. |
| Journey `UI.combatTank` | Already updated for side-view coords |

## Chunks

| id | what | depends on | owns (CREATE / EDIT) | who |
|----|------|------------|----------------------|-----|
| 0 | **CENTRAL.** Confirm side-view is historical/shipped; gates green; this doc is bible; lock draft numbers below | — | verify only | central |
| 1 | Tree service: exclusive-locked **consolation skip** + unit tests; `SPELL_TREE` forsaken tempo nodes; `combatPace` effect → `CombatMods`; save `combatPaceTenths` (+ version bump/migrate); bridge + `tree/AGENTS.md` | 0 | `game/src/tree/`, `game/src/data/spellTree.ts`, `game/src/save/save.ts`, related tests, `meta/` only if loadout alias needs a field pass-through | Sonnet — pure logic |
| 2 | Combat juice: shake, scaled floats, halo, cast VFX, healer armed rune | 0 (parallel OK with 1 until wiring pace) | `game/src/ui/unitSprite.ts`, `game/src/scenes/CombatScene.ts`, optional tiny `game/src/ui/combatFx.ts` | Sonnet — Phaser UI |
| 3 | Spell bar keycaps + armed border kept; pace toggle widget; scene applies `dt * pace` into `advance` | 1 | `game/src/ui/spellBar.ts`, `CombatScene.ts` (pace wiring), optional `game/src/ui/paceToggle.ts` | Sonnet — Phaser UI |
| 4 | Tree lock icon between oaths + forsaken-spot UI (consolation node readable when rival sworn) | 1 | `game/src/scenes/TreeScene.ts` | Sonnet — scene |
| 5 | **CENTRAL.** Journey stages for forsaken tempo + pace toggle coords; cross-boundary fixes; `poc-qa.md`; mark this handoff historical; full journey | 1–4 | `game/scripts/journey.mjs`, `docs/poc-qa.md`, this file | — |

**Parallelism:** After chunk 1, chunks 2 and 4 are disjoint (Combat vs Tree scene). Chunk 3 needs chunk 1's `CombatMods` / save fields. Do not parallelize 1 with 3.

## Locked decisions (do not re-ask)

### J — Theme (Last Spell mood, temp art)

- Palette: ash `#1a1210`, iron, blood ruby `#e05a4e`, ember gold `#f2c14e`.
- Short heavy motion; no cute green procs, no angelic rings, no particle packs.
- Kenney tiles stay; juice is shapes / text / camera only.

### K — Screenshake

- **Only** on boss ability impact: handle `bossCastFinished` (shake once per
  finish; the following party `damage` events do not each re-shake).
- Modest Phaser camera shake (draft: duration ~120–180 ms, intensity low —
  tune in play, keep integer-ish constants in the scene or `combatFx` helper).
- No shake on `bossCastStarted`.

### L — Float scale

- Map `amount` → font px with a small table (integers only), e.g.:

```ts
// draft — retune freely; keep monotonic
function floatFontPx(amount: number): number {
  const a = Math.abs(amount);
  if (a <= 1) return 18;
  if (a <= 2) return 20;
  if (a <= 4) return 24;
  if (a <= 6) return 28;
  return 32;
}
```

- Damage and heal share the same scale function; colors stay Phase 3.

### M — Target halo

- Ellipse under unit feet (below sprite center toward ground), ember fill +
  iron stroke, only when `setTargeted(true)`.
- Side-view: sits on the shared ground line under the ally.

### N — Cast effects

- `castStarted`: flash healer + thin line from healer to target (ember).
- Heal land: keep `flashHeal`; optional one-shot ellipse pulse under target.
- No permanent beams; destroy line when cast finishes/cancels or after a short
  tween.

### O — Armed feedback

- **Keep** gold armed border on buffed spell button(s).
- **Add** healer-only rune while any synergy is armed. No label, no tooltip,
  no spell-button floater, no buff strip.
- Rune clears when `armedBuffedSpellIds` is empty.

### P — Spell bar keycaps

- Hotkey shown as a small square keycap badge (bordered rect + digit), WoW
  action-bar vibe, still monospace.
- If button bounds / Y change, update `journey.mjs` `UI` hover/click targets.

### Q — Mutual exclusion visual

- Draw a **lock icon** (simple geometry or "🔒"-free vector padlock from rects)
  **between** Vigil and Zealot oath node positions.
- Do **not** build bridge/blade metaphors. Existing LOCKED label on
  exclusive-locked spots may remain.

### R — Combat pace (gameplay)

- Multiplier **1.5×** only (plus base **1×**).
- **Scene-side:** `engine.advance(Math.floor(delta * paceTenths / 10))` (or
  equivalent integer math). Do **not** change CombatEngine purity; do **not**
  rely on Phaser `timeScale` alone (sim and tweens must stay consistent —
  scale the `dt` fed to `advance`, and use the same factor for juice tweens
  that should match sim, or keep juice in wall-clock deliberately; prefer
  scaling `advance` dt and leaving juice wall-clock so shake/floats stay
  readable at 1.5×).
- **Pinned preference for juice vs sim:** sim uses paced `dt`; float/shake
  durations stay wall-clock (readable). Document in `poc-qa.md`.
- Balance tests / bots stay at effective 1× sim (they call `advance` directly).
- Journey runs at whatever pace the save has; prefer asserting tree unlock
  then optionally clicking toggle — do not make journey timing fragile; spell
  hotkeys + tank click stay the fight loop.

### S — Pace toggle UI

- Bottom corner (prefer **bottom-left**, clear of spell bar center and of
  top-right combat log). Label shows current pace (`1x` or `1.5x`).
- Click cycles available paces in ascending order, wrapping.
- If only `1x` available: either hide the control **or** show `1x` non-cycling
  (prefer **hide** until 1.5× owned — cleaner).
- Persist selection on `SaveData` immediately on click (`saveGame`).

### T — Forsaken-path tempo (tree challenge) — pinned design

**Player fantasy:** you swear one oath; the forsaken rival still yields a
bitter gift — Warped Tempo (name draft; metal rename OK).

**Config shape (authoritative intent):**

```text
vigil-oath spot chain:  [vigil-oath,  warped-tempo-via-vigil]
zealot-oath spot chain: [zealot-oath, warped-tempo-via-zealot]
```

| Node | requires | exclusiveGroup | flag | effect |
|------|----------|----------------|------|--------|
| `warped-tempo-via-vigil` | `{ mode:'all', nodes:['zealot-oath'] }` | `combat-tempo` | `availableIfExclusiveLocked: true` | `{ kind:'combatPace', multiplierTenths: 15 }` |
| `warped-tempo-via-zealot` | `{ mode:'all', nodes:['vigil-oath'] }` | `combat-tempo` | `availableIfExclusiveLocked: true` | same |

**Service rule (new):** when resolving a spot's next node, if the normal next
unowned chain entry is `exclusive-locked`, **skip forward** within the same
spot chain to the first later node that has `availableIfExclusiveLocked: true`
and whose `requires` are met and which is not itself exclusive-locked by
`combat-tempo` (etc.). That consolation node becomes `next` with normal
affordable/unaffordable status.

**Examples:**

- Own `vigil-oath` only → zealot spot shows `warped-tempo-via-zealot` (not the
  Zealot oath). Vigil spot's next consolation requires zealot → stays unmet /
  locked.
- Buy `warped-tempo-via-zealot` → `combat-tempo` group owned → the vigil-side
  consolation locks out.
- Cost draft: **4 gold** (retune freely; keep integer).

**Do not** put tempo on the sworn path as a normal follow-up; the point is the
forsaken spot.

**Content opacity:** tree service never interprets `combatPace`; only
`availableIfExclusiveLocked` is a service flag on `NodeDef`. Effect resolve
stays in `spellTree.ts` → `CombatMods`.

### U — Save / CombatMods

```ts
// SaveData — bump version per CLAUDE.md (v2 → v3); migrate unknown → fresh
// or migrate v2→v3 adding:
combatPaceTenths: number; // selected pace; default 10

// CombatMods addition:
paceMultipliersTenths: number[]; // always includes 10; adds 15 if owned
```

`loadoutFromSave` / `resolveCombatMods` populate `paceMultipliersTenths`.
Scene clamps saved selection into the available list.

### V — Scope reopen vs poc-spec §9

This phase **is** the deferred UI/juice slice, plus one meta unlock.
Explicitly still out: full proc framework, party hotkeys, hub buff shop,
respec, audio pack, side-profile art, major CDs.

Amends Phase 3 decision E: healer rune **is** now allowed (border remains).

## Pinned contracts (spell out in subagent prompts)

### Tree (`NodeDef` addition)

```ts
interface NodeDef {
  // ...existing...
  /**
   * When the spot's natural next node is exclusive-locked, the resolver may
   * skip to this node if requires are met. Used for forsaken-path rewards.
   */
  availableIfExclusiveLocked?: boolean;
}
```

Expose on `NodeView` / spot `next` as today once selected. Unit-test:
swear vigil → zealot spot next id is `warped-tempo-via-zealot`; purchase;
vigil consolation becomes exclusive-locked via `combat-tempo`.

### CombatMods / scene

```ts
interface CombatMods {
  // ...existing...
  paceMultipliersTenths: number[]; // sorted unique; includes 10
}

// CombatScene update loop (sketch):
const pace = save.combatPaceTenths; // clamped to available
engine.advance(Math.max(0, Math.floor(delta * pace / 10)));
```

### Events for shake

```ts
// existing — do not invent a parallel event
| { type: 'bossCastFinished'; name: string }
```

### PaceToggle (UI)

```ts
// suggested surface
setAvailable(multipliersTenths: readonly number[]): void; // empty or [10] → hide
setCurrent(tenths: number): void;
// onClick → next available → callback(tenths)
```

## Non-goals (reject creep)

- Shake on non-boss hits; heal-land shake
- Explaining the armed rune in UI copy
- Severed-bridge / prayer / blade exclusion metaphors (lock icon only)
- 2× pace, continuous slider, or hub purchase
- Putting tempo on the sworn oath's normal follow-ups instead of forsaken skip
- Full floating combat text framework / multi-proc indicators
- Party hotkeys; audio; real art packs; networking
- Reopening side-view layout constants unless juice forced a journey coord fix

## Files (expected touch set)

| File | Role |
|------|------|
| `game/src/tree/types.ts`, `tree.ts`, tests | consolation skip |
| `game/src/tree/AGENTS.md` | document flag + forsaken pattern |
| `game/src/data/spellTree.ts` + tests | nodes, effect, CombatMods |
| `game/src/save/save.ts` | `combatPaceTenths`, version migrate |
| `game/src/scenes/CombatScene.ts` | shake, cast FX, rune, paced advance, toggle |
| `game/src/ui/unitSprite.ts` | halo, float scale |
| `game/src/ui/spellBar.ts` | keycaps |
| `game/src/ui/paceToggle.ts` (optional) | pace control |
| `game/src/ui/combatFx.ts` (optional) | shake/beam helpers |
| `game/src/scenes/TreeScene.ts` | lock icon; consolation rendering |
| `game/scripts/journey.mjs` | UI coords + forsaken purchase stage |
| `docs/poc-qa.md` | phase log |

## Journey notes

Add a stage after oath swear:

1. Confirm rival oath spot is consolation (click buys tempo, not zealot/vigil).
2. Assert `treeRanks` / owned snapshot includes one `warped-tempo-via-*`.
3. Enter combat; if toggle visible, click once and assert save `combatPaceTenths`.
4. Update any moved click targets (oath positions unchanged preferred; lock
   icon must not steal clicks — `setInteractive` false).

## Definition of done (central)

- [ ] All done-means 1–9 verified in play or journey/screenshots
- [ ] `npm run check` + `npm run smoke` + full `journey.mjs`
- [ ] `poc-qa.md` appended; this file `Status: historical`
- [ ] One commit per chunk (central)

## Document history

| Version | Date | Notes |
|---------|------|-------|
| v1 | 2026-07-11 | Preparer brief from juice planning; waits on side-view |
