# Radial talent tree — implementation handoff

Status: planning · Authority: Wave 5 radial dual-ship implementation bible
(wins conflicts for this phase) · Last verified: 2026-07-29

Design intent and Q&A history:
[`docs/radial-tree-design.md`](radial-tree-design.md). This handoff **locks
v1 micro-choices** left open there and defines chunks / contracts for the
orchestrator prompt in
[`docs/radial-tree-agent-prompt.md`](radial-tree-agent-prompt.md).

---

## Mission

Ship **lattice and radial progression side-by-side**. Player toggles mode in
Settings (wipe + restart). Radial is an ability-spoke wheel with plain spell
names, A/B specialize modals, and ring level bands. Combat still only sees
`CombatMods`.

### Done means

1. Fresh install defaults to **lattice** (existing journey stays green).
2. Settings has a **Talent tree: Classic / Radial** control; switching
   confirms, **wipes save**, restarts into that mode.
3. Radial starter: **Heal + Bonk** on bar; tree shows them prepurchased;
   **Mend** is the obvious first Ring-1 purchase.
4. Specialize auto-**replaces** bar slot and **removes** the prior spell from
   the library.
5. Ring bands gate content: **1–4 / 5–9 / 10+**.
6. Ring 2 offense: **Vowstrike XOR upgraded Bonk** (hard lock). Bonk upgrade
   A/B = mana return vs stacking next-heal amp.
7. Both modes: `npm run verify` green (lattice journey + radial smoke path).

---

## Locked v1 kit (resolves design §11)

| Topic | Lock |
|---|---|
| Default mode | **Lattice** |
| Instant / Buff spokes | **Out of v1** (brainstorm only) |
| Big Heal | **Ring 1 unlock** (1pt); stage A/B from Ring 2+ |
| Frenzied Liturgy | **Third Ring-2 CD spoke** competing for points with Still Waters + Wrath (player typically affords ~2 of 3) |
| Offense exclusivity | **Forever** in v1 (no splash) |
| Vowstrike flavor names | **Vowstrike: Absolution** / **Vowstrike: Reckoning** (plain base = Vowstrike) |
| Bonk heal stacks | **+10% per stack, cap 3**, consumed by **next healing spell** (any heal>0); needs engine support (see contract) |
| Mend cost | **1 talent point** |
| Save | **Rotate key** (`healgame-save-v8` → `v9`); no migration |
| Center / build stamp | Placeholders OK |
| Subclass / Defense axis / relics redesign / respec | **Out** |

### Ring 1 (minLevel 1) — spend targets

Prepurchased (0 cost, owned at create): `heal`, `bonk`.

| Spot id | Kind | Notes |
|---|---|---|
| `mend` | grantSpell | Teaching unlock |
| `heal-s1` | A/B specialize | **Zealous Heal** (faster, pricier) vs **Solemn Heal** (slower, cheaper mana) — numbers ≈ live Flare vs Vigil-ish retune of base Heal |
| `big-heal` | grantSpell | Separate spoke; slow big heal (≈ live Solemn Vigil numbers as starting point) |
| `mend-s1` | A/B synergy | **Arming Mend**: next Heal or Big Heal +2 heal vs **Battle Mend**: after Bonk/Vowstrike, next Mend costs 1 less mana (min 0) |

Four purchase spots + prepurchased display = enough for Lv1–4 without Instant/Buff.

### Ring 2 (minLevel 5)

| Spot id | Kind | Notes |
|---|---|---|
| `offense` | exclusive fork | **Vowstrike** grant vs **Bonk Upgrade** entry; if Bonk Upgrade → immediate A/B **Mana Bonk** (restore 1 mana on Bonk) vs **Blessed Bonk** (stacking +10% next heal, cap 3). Hard lock vs Vowstrike. |
| `vowstrike-s1` | A/B (requires Vowstrike) | Absolution vs Reckoning (live castBuffs) |
| `still-waters` | grantCooldown | Live Still Waters |
| `wrath` | grantCooldown | Live Wrath Ascendant |
| `liturgy` | grantCooldown | Live Frenzied Liturgy |
| `big-heal-s1` | A/B (requires Big Heal) | Prepared (+heal, +cast) vs Thrifty (−mana, slightly less heal) — plain copy in modal |
| `heal-s2` | A/B (requires heal-s1) | Fast-path: shorter cast again / Slow-path: missing-health bonus — must feel dope, not +1 filler |

### Ring 3 (minLevel 10)

Thin but real:

| Spot id | Kind | Notes |
|---|---|---|
| `heal-s3` | A/B on Heal line | One more identity spike (e.g. free-cast proc feel vs bigger committed heal) — tune in data |
| `offense-s2` | A/B on owned offense | Vowstrike: shorter CD vs harder hit; Bonk path: +1 damage vs +1 stack cap |
| `crown-wrath` | upgrade | If Wrath owned: extend window or +1 bonus heal (dope) |
| `crown-waters` | upgrade | If Still Waters owned: also arms +2 on that free heal |

Exact integers are data — behavior shape above is the contract.

### Synergy resolve (no subclass)

Re-home twists as aspect × aspect in radial `resolveCombatMods` only when both
sides owned. Minimum v1:

- Blessed Bonk stacks × any heal (engine).
- Absolution / Reckoning castBuffs (existing).
- Arming Mend / Battle Mend (synergy or castBuff rules).
- Liturgy (−1 mana window) remains generally strong; copy should call out
  fast casters.

---

## Architecture contracts

### Progression mode

```ts
export type ProgressionMode = 'lattice' | 'radial';

// On SaveData (v9):
progressionMode: ProgressionMode; // default 'lattice'

export function loadoutForSave(save: SaveData): CombatMods;
export function treeConfigForSave(save: SaveData): /* lattice | radial config */;
```

Settings toggle → confirm → `resetSave()` / new defaults with chosen mode →
boot Tutorial or Hub per existing new-game rules.

### Specialize replace

```ts
{ kind: 'specializeSpell'; fromId: string; toId: string }
```

Resolver: drop `fromId` from unlocked + bar; grant `toId`; if bar had
`fromId`, write `toId` in that slot.

### Bonk stacks (combat)

If engine cannot express stacking with current `nextHealPotencyPct` (max/replace),
add a dedicated stack counter (preferred):

```ts
// SpellCastBuff extension or Bonk-specific rule:
{ kind: 'stackNextHealPotencyPct'; pct: number; cap: number }
// Engine: on Bonk complete, stacks = min(cap, stacks+1); on heal land,
// potency from stacks*pct, then stacks = 0.
```

Unit-test in `combat/`. Lattice spells unchanged.

### Facade call sites

All fight-start / spellbook / tree loadout paths use `loadoutForSave`, not
bare `loadoutFromSave`. Lattice implementation stays the current function body.

### Journey / semantic targets

- Lattice journey unchanged when mode is lattice.
- Radial: `treeNode:<spotId>` for radial spots; A/B modal buttons
  `treeChoice:a` / `treeChoice:b` (or `treeChoice:<optionId>`); settings
  `settingsProgressionLattice` / `settingsProgressionRadial` (names stable —
  update `docs/semantic-targets.md`).
- Add a **radial smoke journey stage** or separate script path that: set
  radial mode → buy Mend → specialize Heal → assert bar ids. Full lattice
  B-journey need not be re-encoded for radial in v1 if a focused radial
  journey covers the new UI.

### File ownership map (chunk guide)

| Area | Path |
|---|---|
| Mode + save rotate | `game/src/save/save.ts`, save tests, `game/scripts/journey.mjs` SAVE_KEY |
| Facade | `game/src/data/loadout.ts` (new) or export from `talentTree.ts` + thin wrapper |
| Radial catalog | `game/src/data/radial/` (`spells.ts`, `tree.ts`, `resolve.ts`, tests) |
| Bonk stacks | `game/src/combat/types.ts`, `engine.ts`, tests, README note |
| Settings UI | `game/src/scenes/SettingsScene.ts` |
| Tree UI | prefer `game/src/scenes/RadialTreeScene.ts` **or** mode branch in `TreeScene.ts` — pick one in chunk 0 and stick to it; A/B modal colocated |
| Hub wiring | `HubScene` only if tree scene key / button target changes |
| Docs | `semantic-targets.md`, `poc-qa.md` note, this handoff → current when shipped |

Lattice `TALENT_TREE` / `TreeScene` lattice path: **do not break**; edit only
for facade indirection.

---

## Chunks

| Id | Owner | Depends | Owns | Deliverable |
|---|---|---|---|---|
| **0** | Central | — | save rotate, `ProgressionMode`, `loadoutForSave` facade, Settings toggle+wipe confirm, wiring call sites to facade, stub radial loadout = Heal+Bonk | Mode switch works; lattice playthrough unchanged; verify:fast |
| **1** | Subagent | 0 | `data/radial/*` pure tree+spells+resolve (Ring 1–2 data, specialize, offense fork); no Phaser | Unit tests: Mend grant, specialize replace, offense XOR, CD grants |
| **2** | Subagent | 0 | combat Bonk stack buff + tests + README | Blessed Bonk stacks work in engine |
| **3** | Subagent | 1 | Radial tree UI + A/B modal + polar layout; journey names | Player can buy/specialize visually |
| **4** | Subagent | 1,2,3 | Ring 3 nodes, synergy resolve polish, radial balance bot smoke, radial journey stage | Depth band playable |
| **5** | Central | 1–4 | Integration, full `npm run verify`, PR, poc-qa note | Dual-ship PR green |

Sequential: 0 → (1 ∥ 2) → 3 → 4 → 5. Chunks 1 and 2 are disjoint
(`data/radial` vs `combat/`) and may run in parallel after 0.

---

## Non-goals

- Delete lattice / make radial the only tree
- Save migration from v8 ranks → radial
- Respec, dual-spec, subclass oaths, Defense axis
- Instant / Buff / Guard new spokes
- Relic spoke-tags, result BUILD→radial silhouette art
- Retuning all dungeon balance for radial (smoke bots + shape tests enough;
  full rebalance can follow playtest)
- Icon art polish pass on lattice glyphs

---

## When shipped

- Append `docs/poc-qa.md`, prepend `docs/CHANGELOG.md`
- Set this handoff + design doc to historical or fold decisions into
  `game/src/tree/AGENTS.md` + `data` README
- Update playtest canvas Wave 5 row to Shipped / PR link
