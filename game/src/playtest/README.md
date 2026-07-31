# Headless balance playtest

Status: current · Authority: playtest bot contracts + curve sweep · Last verified: 2026-07-31

Drives `CombatEngine` with no Phaser / animations — sim time advances as fast
as the CPU allows via `advance(stepMs)`.

```bash
npm run content -- playtest              # all dungeons
npm run content -- playtest ash-gate     # one dungeon
```

## Kit (cards mode)

Both bots play **spell cards** with:

- free level unlocks (`heal` / `bonk` / `mend` / `vowstrike`)
- baked **chip** plans (`loadouts.ts`) — not rolled at runtime
- **secondary** upgrade ranks (block / crit / haste / manaRegen)
- **chosen** major CDs at L6 / L8

| Profile | Chips (intent) | Secondaries | CDs |
|---------|----------------|-------------|-----|
| **basic** | Simple passives / flats (Graven+Heavy, Surge+Penny, Mana Bonk…) | all into block | Still Waters → Mercy Reserve |
| **god** | Mend→Heal links (+4) + Vigor, Penny Mend, Mana Bonk + Reckoning, Heavy Vow | block×3 then manaRegen/crit/haste | Liturgy → Iron Canticle |

## Bots

| Bot | Behavior |
|-----|----------|
| **basic** | Injured-target triage; random affordable heal; idle gap between casts; overheals freely; no queueing / no Bonk. |
| **god** | Queues so the GCD never idles; Bonk filler; never overheals against *effective* heal; efficiency unless below 40% HP → max HPS; **combo-aware** (arms Mend before Heal when mend→heal is live; scores armed synergy / potency / missing-HP rules). |

God wipe handling: mana left ⇒ next attempt prefers **throughput**; OOM ⇒
**efficiency**. Still failing ⇒ level up and retry from a clean bias.

## Baking results

Copy `{ god, basic }` clear levels onto each `DungeonDef.playtestLevelRange`
(or `null` when either bot never clears). Hub formats via
`formatPlaytestLevelRange`. Re-run after combat/number/chip retunes.
