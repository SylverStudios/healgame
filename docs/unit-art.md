# Unit art — Kenney Tiny Dungeon

Combat units render 16×16 tiles from Kenney's **Tiny Dungeon** pack (CC0, no
attribution required). Everything else in the game stays temp art per
CLAUDE.md.

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
Ash Husk→121 ghost · Gate Warden→109 brute · Hollow King→110 demon.
Party maps by unit id, bosses by encounter boss id, trash by role
(fallbacks: fighter / demon).

## Adding a unit's art

Add its id→frame entry in `sprites.ts` — nothing else. New enemy types need
either a new id entry or they inherit the role fallback. Then run the gates
(`npm run check`, `npm run smoke`; `journey.mjs` if scene layout moved) and
eyeball one combat screenshot — tile picks can only be verified visually.
