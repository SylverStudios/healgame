# PoC changelog — healgame (frozen summary)

Status: historical · Authority: none — one-page PoC retrospective · Last verified: 2026-07-12

**Do not edit.** This is the closed book on the proof of concept. For live
behavior see [`poc-qa.md`](./poc-qa.md). For what we build next see
[`alpha-0.1-handoff.md`](./alpha-0.1-handoff.md) (`Status: planning`).

Organized from the planning board: **Finished (PoC)** modules, **PoC current
features**, and the four **component pillars** (utility, controls, tiles,
progression).

---

## Component pillars (what the PoC proved)

| Pillar | Board label | healgame meaning | Shipped as |
|--------|-------------|------------------|------------|
| **Utility** | What tools does the player need? | Healer kit: Solemn Mend → XP grant → tree perks → oath branch → forsaken tempo | `game/src/data/spells.ts`, `spellTree.ts`, `loadoutFromSave` |
| **Controls** | Available actions | Click ally → click spell / hotkey; hub buttons; tree buy; pace toggle; Escape cancel | `CombatScene`, `HubScene`, `TreeScene`, `SpellBar` |
| **Tiles** | Level / grid presentation | Side-view facing line, Kenney unit tiles, temp rects + bars | `CombatScene` layout, `unitSprite.ts`, `sprites.ts` |
| **Progression** | Gather → invest → reap loop | Wipe or clear → bank gold/XP → spend on tree → ruby oath → unlock Maw sandbox | `meta/progression.ts`, `save/save.ts` |

---

## Finished modules (board → shipped)

| # | Board module | healgame module | Status |
|---|--------------|-----------------|--------|
| 1 | **Basic game mechanics** (move, water, harvest) | **Core combat loop**: target, cast, GCD, queue, mana discipline, wipe keeps rewards | ✅ Phase 1 |
| 2 | **Basic tiles** (dirt, water, plant, fruit) | **Unit + UI chrome**: Kenney sprites, HP/mana bars, spell bar, temp dark palette | ✅ Phase 2 art + ongoing juice |
| 3 | **Simple level design** (grass, dirt, water, rock, fruit) | **Encounters**: Ash Gate (3 waves + Gate Warden / Bonehowl), The Maw sandbox | ✅ Phase 1 content |
| 4 | **Simple progression** (plant → water → harvest → fruit) | **Meta loop**: tutorial → wipe → hub → level 2 auto-grant → gold tree → ruby oath → D2 | ✅ poc-spec §1 |
| 5 | **Simple score** (score / timer) | **Currencies + pace**: gold, XP, rubies on hub; combat pace 1× / 1.5× when unlocked | ✅ |
| — | **Framework** (add modules / objects) | **Architecture**: pure combat engine, config-driven tree service, thin Phaser scenes, journey e2e | ✅ |
| — | **Rules** (object interactions) | **Engine contract**: deterministic `advance(dt)`; numbers in `data/`; balance gates pin difficulty shape | ✅ `combat/README.md`, `balance.test.ts` |

---

## PoC current features (board → status)

Features from the “current PoC” sticky notes — what exists vs what is still thin.

| Feature | Board intent | healgame today | PoC status |
|---------|--------------|----------------|------------|
| **Splash screen** | Title / boot moment | `BootScene` preloads assets and routes to tutorial or hub — no title card | ⚠️ Minimal |
| **Inventory** | What the player carries | **Spell loadout** on the combat bar (XP + tree grants); no item bag | ⚠️ Combat-only |
| **Avatar info** | Who am I, how am I doing? | Hub header: gold, XP, level, rubies | ✅ |
| **Profile** | Name, bio, identity | Save holds progress only — no profile screen | ❌ Not built |
| **Settings** | Player preferences | Two-click **restart**; combat **pace toggle** when unlocked — no settings scene | ⚠️ Partial |
| **Tutorials** | Onboarding | `TutorialScene` → first Solemn Mend unlock → Ash Gate | ✅ |
| **Memory game** | Side activity | Out of scope for healer PoC | ❌ Icebox |
| **Leaderboard** | Compare runs | Out of scope (no backend) | ❌ Icebox |

**PoC verdict:** Core loop and rules are **complete** (see [`poc-qa.md`](./poc-qa.md)).
Presentation and “game shell” features (menu, settings, dialogue, audio) are
**thin or missing** — that gap defines Alpha 0.1.

---

## Phase timeline (implementation order)

| Phase | Theme | Highlights |
|-------|-------|------------|
| **1** | poc-spec §1 | Engine, scenes, save, Ash Gate / Maw, progression, balance bots |
| **2** | Feedback + tree | Lunge/floats, node-graph tree, in-tree oaths, v2 save migration, Kenney art |
| **3** | Combat UX | Numeric floats, role swing cadences, dev log, cast cancel, armed border |
| **Side-view** | Layout | Party left / enemies right, shared ground, facing flip |
| **Juice + tempo** | Feel + meta | Screenshake, halo/VFX, keycaps, forsaken Warped Tempo, save v3 |

---

## Gates (unchanged for all future work)

From `game/`:

```bash
npm run check    # typecheck + lint + tests + build
npm run smoke    # headless boot, zero console errors
node scripts/journey.mjs   # full player journey (~5 min)
```

---

## Explicitly deferred past PoC

Still out unless [`alpha-0.1-handoff.md`](./alpha-0.1-handoff.md) or a later
handoff reopens them (originally poc-spec §9):

- Procs / floating combo indicators
- Major cooldowns
- Hub permanent buffs
- Party slot hotkeys (1–4 target)
- Aegis / Wildbloom archetypes
- Respec
- Polished final art pipeline
- Boss phases, merc trees, networking
