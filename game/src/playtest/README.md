# Headless balance playtest

Status: current · Authority: playtest bot contracts + curve sweep · Last verified: 2026-07-31

Drives `CombatEngine` with no Phaser / animations — sim time advances as fast
as the CPU allows via `advance(stepMs)`.

```bash
npm run content -- playtest              # all dungeons
npm run content -- playtest ash-gate     # one dungeon
```

## Bots

| Bot | Behavior |
|-----|----------|
| **basic** | Injured-target triage; random affordable heal; idle gap between casts; overheals freely; no queueing / no Bonk. |
| **god** | Queues the next cast so the GCD never idles; Bonk when nobody needs a heal; never overheals; most efficient heal (heal/mana) unless target below 40% HP (or dying) → max HPS; activates owned CDs sensibly. |

God wipe handling: mana left ⇒ next attempt prefers **throughput**; OOM ⇒
**efficiency**. Still failing ⇒ level up and retry from a clean bias.

## Kit

Cards-mode free unlocks at the swept level, **no chips** (`kitAtLevel`). Level
supplies mana pool/regen + party max HP. Cap: `PLAYTEST_MAX_LEVEL` (20).

## Baking results

Copy `{ god, basic }` clear levels onto each `DungeonDef.playtestLevelRange`
(or `null` when either bot never clears). Hub formats via
`formatPlaytestLevelRange`. Re-run after combat/number retunes.
