# Unit art — Kenney Tiny Dungeon + custom stills

Status: current · Authority: combat unit tile mapping · Last verified: 2026-07-19

Combat units render from two presentation paths (see `game/src/ui/sprites.ts`
`presentationForUnit`):

1. **Kenney Tiny Dungeon** (default) — 16×16 tiles from the packed sheet
2. **Custom textures** — PixelLab party mercs / ash-husk stills (+ attack
   strips), or the ragged-healer spritesheet (cast poses)

Everything else in the game stays temp art per CLAUDE.md.

## Where things are

- `game/public/assets/tiny-dungeon.png` — Kenney packed tilesheet (12 cols ×
  11 rows, 16px tiles, no spacing) + license copy alongside.
- `game/public/assets/units/tank/` — PixelLab starter tank (`east.png` +
  `attack-east/0–6.png`). Authoring cache: `artifacts/pixellab-starter-tank/`.
- `game/public/assets/units/dps1/` — PixelLab melee DPS (`east.png` +
  `attack-east/0–6.png`). Authoring cache: `artifacts/pixellab-starter-dps1/`.
- `game/public/assets/units/dps2/` — PixelLab ranger DPS (`east.png` +
  `attack-east/0–6.png`). Authoring cache: `artifacts/pixellab-starter-dps2/`.
- `game/public/assets/units/ash-husk/` — PixelLab ash husk (`west.png` +
  idle frames for a later pass). Authoring cache: `artifacts/pixellab-ash-husk/`.
- `game/public/assets/ragged-healer-sheet.png` — healer cast sheet (v0.3).
- `game/src/ui/sprites.ts` — the ONLY place art choices live
  (`presentationForUnit`, `frameForUnit`, texture keys/URLs, attack anim
  defs). Presentation-only; never gameplay data.
- `kenney_tiny-dungeon/` at repo root — the full source pack, **untracked**
  (gitignored). Browse `Preview.png` or `Tiles/tile_XXXX.png` to pick new
  tiles. If it's missing, re-download "Tiny Dungeon 1.0" from kenney.nl.

## How it works

- **Kenney**: frame index = `row * 12 + col`. BootScene preloads the sheet
  once (`this.load.spritesheet`). `UnitSprite` applies `flipX` by side
  (party right / enemies left) because Kenney tiles are front-facing.
- **Custom still** (`kind: 'texture'`): BootScene `load.image` for
  `unit-tank` / `unit-dps1` / `unit-dps2` / `unit-ash-husk`. `UnitSprite`
  uses the texture key with **no frame index** and **no flipX** — facing is
  authored into the PNG (party east, husk west).
- **Attack strips**: BootScene loads `attack-east/0–6.png` per merc and
  registers Phaser anims (`unit-tank-attack`, `unit-dps1-attack`,
  `unit-dps2-attack`). `UnitSprite.playAttack()` runs on tank shove / DPS
  jab, then restores the rest still.
- **Healer sheet**: still a CombatScene special case (idle + cast frames);
  not selected by `presentationForUnit`.
- `pixelArt: true` in `main.ts` gives nearest-neighbor filtering game-wide.
- Display sizes (`CombatScene.ts`): custom party (PixelLab mercs + healer
  sheet) **112**, Kenney party **48**; PixelLab trash **72**, Kenney trash
  **32**; bosses **80** (Kenney today). Padded canvases (PixelLab + healer
  sheet) use `bodyOffsetY` so painted feet meet `GROUND_Y`. HP/mana meters
  are capped at 72px wide so neighboring party bars don't overlap.
- Death state = dark tint + alpha + shrink (`update()` in unitSprite.ts).

## Current casting

| Unit | Path | Asset |
|------|------|-------|
| tank | custom still + attack | `unit-tank` + `unit-tank-attack` |
| dps1 | custom still + attack | `unit-dps1` + `unit-dps1-attack` |
| dps2 | custom still + attack | `unit-dps2` + `unit-dps2-attack` |
| healer | ragged sheet | cast/idle frames |
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

**Attack strip:** add frames beside the still, extend `UNIT_ATTACK_ANIMS` in
`sprites.ts` (BootScene loads + registers the anim; pass `attackAnimKey` from
CombatScene).

Then run `npm run verify:fast` (`npm run verify` if scene layout moved) and
eyeball one combat screenshot — art picks can only be verified visually.
