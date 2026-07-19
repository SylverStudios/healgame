# Unit art — Kenney Tiny Dungeon + custom stills

Status: current · Authority: combat unit tile mapping · Last verified: 2026-07-19

Combat units render from two presentation paths (see `game/src/ui/sprites.ts`
`presentationForUnit`):

1. **Kenney Tiny Dungeon** (default) — 16×16 tiles from the packed sheet
2. **Custom textures** — single stills (PixelLab tank / ash-husk) or the
   ragged-healer spritesheet (cast poses)

Everything else in the game stays temp art per CLAUDE.md.

## Where things are

- `game/public/assets/tiny-dungeon.png` — Kenney packed tilesheet (12 cols ×
  11 rows, 16px tiles, no spacing) + license copy alongside.
- `game/public/assets/units/tank/east.png` — PixelLab starter tank (combat
  facing right). Authoring cache: `artifacts/pixellab-starter-tank/`.
- `game/public/assets/units/ash-husk/west.png` — PixelLab ash husk (combat
  facing left). Authoring cache: `artifacts/pixellab-ash-husk/`.
  Idle/attack frame folders are shipped beside the stills for a later anim
  pass; BootScene loads the stills only today.
- `game/public/assets/ragged-healer-sheet.png` — healer cast sheet (v0.3).
- `game/src/ui/sprites.ts` — the ONLY place art choices live
  (`presentationForUnit`, `frameForUnit`, texture keys/URLs). Presentation-
  only; never gameplay data.
- `kenney_tiny-dungeon/` at repo root — the full source pack, **untracked**
  (gitignored). Browse `Preview.png` or `Tiles/tile_XXXX.png` to pick new
  tiles. If it's missing, re-download "Tiny Dungeon 1.0" from kenney.nl.

## How it works

- **Kenney**: frame index = `row * 12 + col`. BootScene preloads the sheet
  once (`this.load.spritesheet`). `UnitSprite` applies `flipX` by side
  (party right / enemies left) because Kenney tiles are front-facing.
- **Custom still** (`kind: 'texture'`): BootScene `load.image` for
  `unit-tank` / `unit-ash-husk`. `UnitSprite` uses the texture key with **no
  frame index** and **no flipX** — facing is authored into the PNG (tank
  east, husk west).
- **Healer sheet**: still a CombatScene special case (idle + cast frames);
  not selected by `presentationForUnit`.
- `pixelArt: true` in `main.ts` gives nearest-neighbor filtering game-wide.
- Display sizes (`CombatScene.ts`): custom party/trash **64 / 48**; Kenney
  party/trash **48 / 32**; bosses **80** (all Kenney today). Custom canvases
  are larger than the display size and scale down cleanly.
- Death state = dark tint + alpha + shrink (`update()` in unitSprite.ts).

## Current casting

| Unit | Path | Asset |
|------|------|-------|
| tank | custom still | `unit-tank` (east.png) |
| healer | ragged sheet | cast/idle frames |
| dps1 / dps2 | Kenney | fighter 98 / ranger 112 |
| ash-husk | custom still | `unit-ash-husk` (west.png) |
| other trash | Kenney | ghost 121 |
| Gate Warden / Ember / Matriarch | Kenney | brute 109 |
| Spire / Dirge / Hollow King | Kenney | demon 110 |

Party maps by unit id. Catalog enemies map by stable `Unit.mobId` →
`MobDef.visualKey` → presentation (custom for `ash-husk`, else Kenney
`MOB_VISUAL_FRAMES`). Unknown mobs fall back to ghost/demon by role.

## Adding a unit's art

**Kenney tile:** add the key to `MOB_VISUAL_KEYS` in `data/content/types.ts`,
set the mob's `visualKey`, and map that key in `MOB_VISUAL_FRAMES` in
`sprites.ts`.

**Custom still:** drop a PNG under `game/public/assets/units/…`, preload with
`this.load.image` in BootScene, extend `UnitPresentation` / `presentationForUnit`
to return `{ kind: 'texture', key }`, and keep authored facing (no flipX).

Then run `npm run verify:fast` (`npm run verify` if scene layout moved) and
eyeball one combat screenshot — art picks can only be verified visually.
