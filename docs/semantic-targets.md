# Semantic click targets

Status: current · Authority: interactive object name inventory for journey · Last verified: 2026-07-17

Every interactive game object a journey stage may aim at carries a stable
Phaser `GameObject.setName(...)`. Journey resolves via
`window.__healgame.locate(name)` / `list()` in
[`game/src/debug/testHooks.ts`](../game/src/debug/testHooks.ts) — no hard-coded
layout coordinates in [`game/scripts/journey.mjs`](../game/scripts/journey.mjs).

Adding a new clickable/hoverable control means naming it here and clicking it
by name.

## Name table

| Name | Object | Where |
|---|---|---|
| `tutorialLearn` | learn-button rect | `TutorialScene.ts` |
| `hubDungeon:<id>` (e.g. `hubDungeon:ash-gate`) | dungeon button rects | `HubScene.ts` via `hubDungeonTargetName` |
| `hubTree` | Talent Tree button | `HubScene.ts` |
| `hubLoadout` | Spellbook button | `HubScene.ts` |
| `hubRestart` | restart text label | `HubScene.ts` |
| `loadoutSlot:<i>` | action-bar slot rect | `LoadoutScene.ts` |
| `loadoutPick:<spellId>` / `loadoutPick:empty` | spell picker row | `LoadoutScene.ts` |
| `loadoutBack` | back button | `LoadoutScene.ts` |
| `runMod:<id>` | oath/relic icon hit target (top bar) | `ui/runModsBar.ts` (Hub / Combat / Tree) |
| `treeNode:<spotId>` | node bg rect | `TreeScene.ts` (e.g. `treeNode:deep-reserves`) |
| `treeBack` | back-button rect | `TreeScene.ts` |
| `combatAlly:<unitId>` | sprite body when clickable | `unitSprite.ts` |
| `combatSpell:<spellId>` | SpellButton bg rect | `spellBar.ts` |
| `combatCooldown:<cooldownId>` | CooldownButton bg rect | `spellBar.ts` |
| `combatReturn` | Return rect in result overlay | `CombatScene.ts` |
| `combatPaceToggle` | pace control bg | `paceToggle.ts` |
| `combatLogToggle` | log header text | `combatLog.ts` |
| `relicCard:<relicId>` | RelicScene card bg | `RelicScene.ts` |

## Hook API

```ts
window.__healgame.locate(name): { x: number; y: number } | null
window.__healgame.list(): string[]
```

`locate` walks active scenes' display lists (recursing into Containers),
matches `obj.name` when `visible !== false`, and converts `getBounds()` center
to canvas px accounting for camera scroll × scrollFactor (TreeScene HUD uses
`scrollFactor` 0).
