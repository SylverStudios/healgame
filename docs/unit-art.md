# Unit art — Kenney Tiny Dungeon + custom stills

Status: current · Authority: combat unit tile mapping + relic icons · Last verified: 2026-07-19

Combat units render from two presentation paths (see `game/src/ui/sprites.ts`
`presentationForUnit`):

1. **Kenney Tiny Dungeon** (default) — 16×16 tiles from the packed sheet
2. **Custom textures** — PixelLab party mercs / ash-husk stills (+ attack
   strips), or the 32×32 armored-paladin healer sheet (cast poses)

**Target density:** party characters and trash aim for **native 32×32** (chunky
SNES/GBA read). Bosses can share that pixel density at a larger canvas later.
Legacy PixelLab mercs are still ~92×92 padded canvases until replaced.

Relic pick / run-mod icons use hand-authored 32×32 stills (`ui/relicSprites.ts`).
Everything else in the game stays temp art per CLAUDE.md.

## Where things are

- `game/public/assets/tiny-dungeon.png` — Kenney packed tilesheet (12 cols ×
  11 rows, 16px tiles, no spacing) + license copy alongside.
- `game/public/assets/units/healer/` — armored-paladin healer (`east.png`,
  `sheet.png` = idle + charge + cast-action, `charge-east/`, `cast-east/`).
  Source: `art/source/armored-paladin/`. Charge loops while channeling;
  cast-action plays once on release (FE exposure timings in `sprites.ts`).
- `game/public/assets/units/tank/` — PixelLab starter tank (`east.png` +
  `attack-east/0–6.png`). Authoring cache: `artifacts/pixellab-starter-tank/`.
- `game/public/assets/units/dps1/` — PixelLab melee DPS (`east.png` +
  `attack-east/0–6.png`). Authoring cache: `artifacts/pixellab-starter-dps1/`.
- `game/public/assets/units/dps2/` — PixelLab ranger DPS (`east.png` +
  `attack-east/0–6.png`). Authoring cache: `artifacts/pixellab-starter-dps2/`.
- `game/public/assets/units/ash-husk/` — PixelLab ash husk (`west.png` +
  idle frames for a later pass). Authoring cache: `artifacts/pixellab-ash-husk/`.
- `game/public/assets/relics/<id>.png` — hand-authored FE GBA inventory icons
  (32×32 native, 64×64 nearest in game; General-sheet metal language). Cache:
  `artifacts/pixellab-relics/hand-fe-v2/`. Keys via `ui/relicSprites.ts`;
  BootScene preloads; `drawRunModGlyph` / RelicScene (HUD 32px, cards 64px).
- `game/public/assets/ragged-healer-sheet.png` — historical 64×64 healer sheet
  (superseded; kept for reference). Live healer uses `units/healer/`.
- `game/src/ui/sprites.ts` — combat unit art choices (`presentationForUnit`,
  `frameForUnit`, texture keys/URLs, attack anim defs). Presentation-only;
  never gameplay data.
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
  `unit-dps2-attack`) with an FE-style **exposure sheet**
  (`MERC_ATTACK_FRAME_DURATIONS_MS` in `sprites.ts`) — not equal frame
  durations. Rest duplicate (frame 0) is skipped; anticipation + contact
  hold longer; smear / in-betweens flash (~2 display frames). Timing model:
  [Unpacking Fire Emblem's animations](https://lost-worlds.neocities.org/blog/2024/10/20/fire-emblem-animation/).
  `UnitSprite.playAttack()` runs on tank shove / DPS jab, then restores the
  rest still.
- **Healer sheet**: CombatScene special case — charge loop on `castStarted`
  (channeled), cast-action strip on `finishCast` / instant `playCastRelease`;
  cancel returns to idle. Not selected by `presentationForUnit`. Texture key
  `unit-healer`, 32×32 frames, authored facing (no flipX).
- `pixelArt: true` in `main.ts` gives nearest-neighbor filtering game-wide.
- Display sizes (`CombatScene.ts`): PixelLab mercs **112**, healer 32×32 at
  **64** (2×), Kenney party **48**; PixelLab trash **72**, Kenney trash
  **32**; bosses **80** (Kenney today). Padded canvases use `bodyOffsetY` so
  painted feet meet `GROUND_Y`. HP/mana meters are capped at 72px wide so
  neighboring party bars don't overlap.
- Death state = dark tint + alpha + shrink (`update()` in unitSprite.ts).

## Current casting

| Unit | Path | Asset |
|------|------|-------|
| tank | custom still + attack | `unit-tank` + `unit-tank-attack` |
| dps1 | custom still + attack | `unit-dps1` + `unit-dps1-attack` |
| dps2 | custom still + attack | `unit-dps2` + `unit-dps2-attack` |
| healer | 32×32 armored-paladin sheet | `unit-healer` idle + charge loop + cast-action |
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
