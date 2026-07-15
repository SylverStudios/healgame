# Unit art — Kenney Tiny Dungeon

Status: current · Authority: combat unit tile mapping · Last verified: 2026-07-15

Combat units render 16×16 tiles from Kenney's **Tiny Dungeon** pack (CC0, no
attribution required). Everything else in the game stays temp art per
CLAUDE.md. Live mapping: `game/src/ui/sprites.ts`.

## Where things are

- `game/public/assets/tiny-dungeon.png` — the committed packed tilesheet
  (12 cols × 11 rows, 16px tiles, no spacing) + license copy alongside.
- `game/src/ui/sprites.ts` — the unit→tile mapping (`frameForUnit`) and the
  texture key/URL/frame-size constants. This is the ONLY place art choices
  live; it's presentation-only, never gameplay data.
- `kenney_tiny-dungeon/` at repo root — the full source pack, **untracked**
  (gitignored). Browse `Preview.png` or `Tiles/tile_XXXX.png` to pick new
  tiles. If it's missing, re-download "Tiny Dungeon 1.0" from kenney.nl.
- `docs/research/pixel-art-pipeline.md` — background on why 16×16 native +
  nearest-neighbor; only needed if adding custom-drawn art.

## How it works

- Frame index = `row * 12 + col`, identical to Kenney's `tile_XXXX` file
  numbering — view `Tiles/tile_0096.png` to see frame 96.
- BootScene preloads the sheet once (`this.load.spritesheet`); textures are
  global, no other scene loads anything.
- `pixelArt: true` in `main.ts` gives nearest-neighbor filtering game-wide.
- `UnitSprite` scales with `setDisplaySize` (never `setScale` — the image is
  already scaled up from 16px). Party 64px (4×), trash 48px (3×), boss
  112px (7×) — **keep display sizes integer multiples of 16** or pixels
  render unevenly.
- Death state = dark tint + alpha + shrink (`update()` in unitSprite.ts).

## Current casting

tank→96 knight · dps1→98 fighter · dps2→112 ranger · healer→84 wizard ·
Ash Husk / Iron Husk / Cinder Wraith / Choir Shade / Thorn Husk→121 ghost · Gate Warden /
Ember Colossus / Thorn Matriarch→109 brute · Spire Lancer / Hollow King / Dirge Sovereign→110
demon. Party maps by unit id. Catalog enemies map by stable `Unit.mobId` →
`MobDef.visualKey` → `MOB_VISUAL_FRAMES`; unknown mobs fall back to
ghost/demon by role.

## Adding a unit's art

Add the key to `MOB_VISUAL_KEYS` in `data/content/types.ts`, set the mob's
`visualKey`, and map that key in `MOB_VISUAL_FRAMES` in `sprites.ts`. Reuse an
existing key when the same temporary tile is intentional. Then run
`npm run verify:fast` (`npm run verify` if scene layout moved) and eyeball one
combat screenshot — tile picks can only be verified visually.
