# Semantic click targets

Status: current · Authority: interactive object name inventory for journey · Last verified: 2026-07-31

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
| `hubTree` | Talent Tree button (lattice/radial) or Spells (cards) | `HubScene.ts` |
| `hubLoadout` | Spellbook button (all progression modes) | `HubScene.ts` |
| `hubRestart` | restart text label | `HubScene.ts` |
| `hubSendFeedback` | "✨ Send Aaron feedback" text (bottom-left) | `HubScene.ts` |
| `hubWipePrompt` | wipe-confirm telemetry prompt | `HubScene.ts` |
| `hubWipeSendThen` | "Send, then wipe" text | `HubScene.ts` |
| `hubWipeWithoutSend` | "Wipe without sending" text | `HubScene.ts` |
| `hubWipeCancel` | wipe-confirm cancel text | `HubScene.ts` |
| `loadoutSlot:<i>` | action-bar slot rect | `LoadoutScene.ts` |
| `loadoutPick:<spellId>` / `loadoutPick:empty` | spell picker row | `LoadoutScene.ts` |
| `loadoutBack` | back button | `LoadoutScene.ts` |
| `runMod:<id>` | oath/relic icon hit target (top bar) | `ui/runModsBar.ts` (Hub / Combat / Tree) |
| `treeNode:<spotId>` | node bg rect (lattice) | `TreeScene.ts` (e.g. `treeNode:deep-reserves`) |
| `treeNode:<spotId>` (radial) | wheel socket — logical ids: `heal`, `bonk`, `mend`, `heal-s1`, `big-heal`, `mend-s1`, `offense`, `vowstrike-s1`, `bonk-s1`, `still-waters`, `wrath`, `liturgy`, `big-heal-s1`, `heal-s2`, `heal-s3`, `offense-s2`, `crown-waters`, `crown-wrath` | `RadialTreeScene.ts` |
| `treeBack` | back-button rect | `TreeScene.ts` and `RadialTreeScene.ts` |
| `treeChoice:a` / `treeChoice:b` | Radial A/B specialize choice buttons (inside modal) | `RadialTreeScene.ts` |
| `combatAlly:<unitId>` | sprite body when clickable | `unitSprite.ts` |
| `combatSpell:<spellId>` | SpellButton bg rect | `spellBar.ts` |
| `combatCooldown:<cooldownId>` | CooldownButton bg rect | `spellBar.ts` |
| `combatReturn` | Return rect in result overlay | `ui/resultPanel.ts` (`mountResultReturn`) |
| `combatPaceToggle` | pace control bg | `paceToggle.ts` |
| `combatLogToggle` | log header text | `combatLog.ts` |
| `relicCard:<relicId>` | RelicScene card bg | `RelicScene.ts` |
| `hubSettings` | Settings button | `HubScene.ts` |
| `settingsVolumeSlider` | music volume slider track | `SettingsScene.ts` |
| `settingsProgressionLattice` | Talent tree: Classic | `SettingsScene.ts` |
| `settingsProgressionRadial` | Talent tree: Radial | `SettingsScene.ts` |
| `settingsProgressionCards` | Talent tree: Spell cards | `SettingsScene.ts` |
| `settingsProgressionConfirm` | Wipe & restart confirm | `SettingsScene.ts` |
| `settingsProgressionCancel` | Mode-switch cancel | `SettingsScene.ts` |
| `settingsCatalogue` | Catalogue (spell/chip review) | `SettingsScene.ts` |
| `settingsBack` | back button | `SettingsScene.ts` |
| `catalogueTabSpells` | Catalogue Spells tab | `CatalogueScene.ts` |
| `catalogueTabChips` | Catalogue Chips tab | `CatalogueScene.ts` |
| `catalogueBack` | Catalogue back → Settings | `CatalogueScene.ts` |
| `catalogueSpell:<id>` | Spell / CD row in catalogue | `CatalogueScene.ts` |
| `catalogueChip:<id>` | Chip row in catalogue | `CatalogueScene.ts` |
| `cardAlbumBack` | Card album back | `CardAlbumScene.ts` |
| `cardSpell:<spellId>` | Spell / major-CD card hit target | `CardAlbumScene.ts` |
| `cardUpgrade:<spellId>` | Upgrade affordance on a spell card | `CardAlbumScene.ts` |
| `cardChipOwned:<spellId>:<slot>` | Filled chip slot (hover shows chip desc) | `CardAlbumScene.ts` |
| `cardChipOffer:<chipId>` | Chip draft modal offer card | `CardAlbumScene.ts` |
| `cardChipConfirm` | Confirm chip purchase | `CardAlbumScene.ts` |
| `cardChipCancel` | Cancel chip draft | `CardAlbumScene.ts` |

## Hook API

```ts
window.__healgame.locate(name): { x: number; y: number } | null
window.__healgame.list(): string[]
```

`locate` walks active scenes' display lists (recursing into Containers),
matches `obj.name` when `visible !== false`, and converts `getBounds()` center
to canvas px accounting for camera scroll × scrollFactor (TreeScene HUD uses
`scrollFactor` 0).
