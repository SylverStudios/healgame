# Semantic click targets — handoff

Status: historical — shipped 2026-07-13 (see poc-qa.md Semantic click targets
section) · Authority: none — archive · Last verified: 2026-07-15

Note: `hubRelicIcon` was superseded by `runMod:<id>` when the shared run-mods
top bar shipped (oath + cumulative relics, Hub/Combat/Tree).

**Audience:** historical — the setName / `__healgame.locate` / journey-by-name
change is live. Kept here as the design record and name inventory.

**Baseline:** side-view layout branch (PR #3) merged. The `UI` coordinate
table at the top of `game/scripts/journey.mjs` previously duplicated scene
layout constants; every layout change broke it. This phase deleted that
coupling.

## Mission (done)

Every interactive game object has a stable semantic name via Phaser's
`GameObject.setName()`. `window.__healgame.locate(name)` / `list()` live in
[`game/src/debug/testHooks.ts`](../game/src/debug/testHooks.ts) (installed from
`main.ts`). [`game/scripts/journey.mjs`](../game/scripts/journey.mjs) clicks
and hovers by name — no hard-coded layout coordinates.

## Shipped name table

| Name | Object | Where |
|---|---|---|
| `tutorialLearn` | learn-button rect | `TutorialScene.ts` |
| `hubDungeon:<id>` (e.g. `hubDungeon:ash-gate`) | dungeon button rects | `HubScene.ts` via `hubDungeonTargetName` |
| `hubTree` | Spell Tree button | `HubScene.ts` |
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

## Hook API (shipped)

```ts
window.__healgame.locate(name): { x: number; y: number } | null
window.__healgame.list(): string[]
```

`locate` walks active scenes' display lists (recursing into Containers),
matches `obj.name` when `visible !== false`, and converts `getBounds()` center
to canvas px accounting for camera scroll × scrollFactor (TreeScene HUD uses
`scrollFactor` 0).

## Out of scope (still)

- Party-target hotkeys as player UX (spell and cooldown number keys now ship)
- ScaleManager-aware mapping for arbitrary viewports
- DOM/a11y overlay, Playwright locators, screenshot diffing
