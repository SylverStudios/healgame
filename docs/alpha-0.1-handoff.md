# Alpha 0.1 — game shell + feel

Status: planning · Authority: this phase's scope · Last verified: 2026-07-12

**Audience:** whoever picks up the next slice. Read after [`CLAUDE.md`](../CLAUDE.md)
/ [`AGENTS.md`](../AGENTS.md). **This doc wins on Alpha 0.1 scope below.**
[`poc-spec.md`](./poc-spec.md) still wins on combat rules unless this doc
explicitly amends them. PoC summary (frozen):
[`poc-changelog.md`](./poc-changelog.md).

## Mission

Turn the shipped PoC into something that **reads as a game**, not a dev
harness: entry menu, settings (including audio), basic dialogue, combat SFX,
and clearer run feedback. Keep scope small — temp art, rects, monospace — per
[`CLAUDE.md`](../CLAUDE.md) hard rules.

**Not in Alpha 0.1:** second archetype, proc framework, major CDs, respec,
leaderboards, backend, final art pipeline.

---

## Backlog (from planning board)

Sticky notes from the whiteboard, translated to healgame and sorted.

### Already done (PoC — do not re-build)

| Board item | healgame | Notes |
|------------|----------|-------|
| Basic mechanics | Combat + hub loop | See `poc-changelog.md` |
| Basic tiles / levels | Side-view combat + Ash Gate / Maw | Kenney temp art |
| Simple progression | Gold / XP / ruby / tree | |
| Tutorials | `TutorialScene` | May **extend** with dialogue boxes |
| Avatar info | Hub currency header | |
| Inventory (partial) | Spell bar loadout | Not an item bag |

### Alpha 0.1 — prioritized

| P | Board item | healgame target | Done means (user-observable) |
|---|------------|-----------------|------------------------------|
| **P0** | **Interactive menu** (Start, Settings) | **Title scene** before tutorial/hub | New game / Continue (if save) / Settings; boots without console errors |
| **P0** | **Sound toggle** | **Settings → mute SFX** (and music stub if no tracks yet) | Toggle persists in save; smoke + journey still pass |
| **P0** | **New sound effects** | **Combat + UI SFX** (cast start, heal land, hit, boss howl land, button click) | Audible in dev; respects mute; no autoplay policy violations in smoke |
| **P1** | **Dialogue boxes** | **Tutorial + hub lines** (modal text box, click to advance) | Tutorial uses at least 3 beats; hub welcome on first return after wipe |
| **P1** | **Scoreboard** | **Post-combat results panel** | After win or wipe: gold/XP earned this run, time, survivors; then Return |
| **P1** | **Stores** | **Hub “Quartermaster”** surface | One screen listing spend options (even if only links to Tree for now); copy explains gold vs ruby |
| **P1** | **Better level and grid controls** | **Party slot hotkeys 1–4** + target clarity pass | Keys 1–4 select party members; journey updated if layout clicks change |
| **P2** | **More variety in plant/seed types** | **Content pass**: +1 spell node or encounter tweak | Only after P0 shell ships; must not break balance gate shape without retune + poc-qa note |
| **—** | Memory game | **Icebox** | Not healer-core |
| **—** | Leaderboard | **Icebox** | Needs backend or local-best-only design later |

---

## Recommended chunk order

Work top-to-bottom; each chunk ends with gates green.

| Chunk | Scope | Owns (typical) | Depends on |
|-------|-------|----------------|------------|
| **A** | Save fields for settings (`sfxMuted`, etc.) + migration if needed | `save/save.ts`, tests | — |
| **B** | Title / menu scene + scene routing from Boot | `scenes/`, `keys.ts`, `journey.mjs` UI table | A |
| **C** | Settings panel (mute toggle) reachable from menu + hub | scenes, save | A, B |
| **D** | SFX wiring in combat + hub (howler or Web Audio — pick one, document in poc-qa) | `CombatScene`, assets under `public/` | A, C |
| **E** | Dialogue box component + tutorial/hub script | `ui/dialogue.ts`, Tutorial, Hub | B |
| **F** | Post-combat scoreboard overlay | `CombatScene` | — (parallel with D/E if careful) |
| **G** | Hub quartermaster stub + party hotkeys | `HubScene`, `CombatScene` input | B |
| **H** | Journey stages for menu/settings/dialogue/scoreboard; `poc-qa.md` Alpha section; mark this handoff `historical` | docs, `journey.mjs` | all |

**Parallelism:** F can run beside D/E once combat result flow is stable. G
(hotkeys) touches combat input — sequence after D or coordinate merges.

---

## Locked decisions (draft — change only with user sign-off)

| Topic | Proposal |
|-------|------------|
| Menu flow | Boot → **Title** → Tutorial (no save) or Hub (save) |
| Continue | Disabled / hidden when no valid save |
| Audio | SFX only for 0.1; music = optional single loop or silent stub |
| Dialogue | Rect + monospace; no typewriter required; click or key to advance |
| Scoreboard | Same overlay style as wipe/win today; add stats block above Return |
| Stores | Quartermaster is navigation + copy, not a new currency |
| Hotkeys | 1–4 map to party visual order (healer, dps2, dps1, tank) — see side-view handoff |
| Balance | Alpha 0.1 shell work must **not** change difficulty shape; content chunk (P2) is separate |

---

## Out of scope (stay icebox)

- Proc floats / combo UI (GDD pillar — needs engine work; Alpha 0.2+)
- Major cooldowns, hub permanent buffs
- Wildbloom / Aegis second archetype
- Respec (conflicts with oath permanence unless redesigned)
- Real art pipeline (see `docs/unit-art.md`, `docs/research/pixel-art-pipeline.md`)
- Leaderboard / memory minigame from the board

---

## Definition of done (whole phase)

1. P0 rows in the backlog table are shipped and user-observable.
2. At least **two** P1 rows shipped (team picks: recommend **dialogue + scoreboard**).
3. `npm run check`, `npm run smoke`, `node scripts/journey.mjs` pass.
4. [`poc-qa.md`](./poc-qa.md) gets an **Alpha 0.1** section; this file → `historical`.
5. [`poc-changelog.md`](./poc-changelog.md) stays frozen (no edits).

---

## Doc hygiene (avoid stale docs)

| Doc | Role during Alpha 0.1 |
|-----|------------------------|
| **`alpha-0.1-handoff.md`** | Only `Status: planning` mission doc — update backlog checkboxes here |
| **`poc-changelog.md`** | Frozen PoC summary — never edit |
| **`poc-qa.md`** | Append-only log when chunks ship |
| **`poc-spec.md`** | Baseline rules — amend only if combat rules change |
| **`GDD.md`** | Long-term north star — do not sync every tweak |
| **Phase handoffs** | Already `historical` — do not revive |

When Alpha 0.1 ships, open **`alpha-0.2-handoff.md`** (or a feature-specific
handoff) instead of letting this file linger in `planning`.
