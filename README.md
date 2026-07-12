# healgame

![healgame concept art — healer and warband on a battle line](assets/healer-game.png)

Status: current · Authority: repo landing / vibe · Last verified: 2026-07-12

A healer-focused indie game inspired by *Master Healer Kale with useless party*, rebuilt around exclusive builds, readable casting, and old-school MMO healing — in a heavy-metal dark fantasy skin.

You keep a mercenary warband alive on a single battle line while you triage heals and mana. Between runs you spend gold and scarce rubies on trees that lock out other paths.

## Art / vibe (for concept art)

You are the only healer that matters: a grim warband stands on a single horizontal battle line facing monsters — nobody moves, steel and spells fire on cooldown, while you click targets and cast under a glowing cast bar like old-school MMO healing. The mood is heavy-metal dark fantasy (*The Last Spell* dread meets panel-van dragon swagger): ash, iron, blood-red rubies, mythic beasts, and last-stand grit — not cute, not comedy-useless. Visually, sell the silhouette of **healer in the backline keeping killers alive**, scarce crimson gems as power, and a world that looks loud, cursed, and cool enough to airbrush on a van.

## Status

**PoC playable.** Phaser 3 + TypeScript + Vite under [`game/`](game/):

```bash
cd game && npm install && npm run dev   # → http://localhost:5173
```

Verification (from `game/`): `npm run check` (types + lint + all Vitest tests +
build), `npm run smoke` (headless boot), `node scripts/journey.mjs` (full
player journey). Results + tuning: [docs/poc-qa.md](docs/poc-qa.md).

## Docs

Doc conventions + authority: [`AGENTS.md`](AGENTS.md). Operating rules:
[`CLAUDE.md`](CLAUDE.md).

| Doc | Role |
|-----|------|
| [**PoC Spec**](docs/poc-spec.md) | PoC baseline (phase amendments win) |
| [PoC QA](docs/poc-qa.md) | Journey checklist, balance gates, tuning log |
| [Tree AGENTS](game/src/tree/AGENTS.md) | Config-driven skill-tree service |
| [Combat README](game/src/combat/README.md) | Engine API + rule decisions |
| [Unit art](docs/unit-art.md) | Kenney tile mapping |
| [GDD](docs/GDD.md) | Long-term design only |
| [Tech options](docs/tech-options.md) | Stack comparison (historical decision aid) |
| [Kale research](docs/research/master-healer-kale.md) | Inspiration |

Shipped phase handoffs (historical only): Phase 1 outcome, Phase 2, Phase 3
combat UX, side-view layout, combat juice — see `docs/*-handoff.md` /
`docs/phase-1-poc-outcome.md`.

## PoC in one breath

Oathbound only · tutorial one heal · expected wipe · XP skill + gold tree ·
ruby subclass oath **in the spell tree** (rival LOCKED, visible) · Ash Gate ·
unwinnable Dungeon 2 sandbox · no procs/major CDs/hub buffs · single local
save · restart only
