# Unit art — Kenney Tiny Dungeon + custom stills

Status: current · Authority: combat unit tile mapping + relic icons · Last verified: 2026-07-19

Chunk 1B: healer combat facing is now **south** (camera), with a breathing
idle loop and a Bonk-only zap strip — see "Current casting" and "Healer
sheet" below.

Style law (density, canvas tiers, palette, timing): [`art/STYLE.md`](../art/STYLE.md).
Unit registry + audit: [`art/manifest.json`](../art/manifest.json) via
`npm run art -- audit`. Generation workflow:
`.claude/skills/pixellab-art-pipeline/SKILL.md`.

Combat units render from two presentation paths (see `game/src/ui/sprites.ts`
`presentationForUnit`):

1. **Kenney Tiny Dungeon** (default) — 16×16 tiles from the packed sheet
2. **Custom textures** — PixelLab party mercs / ash-husk stills (+ attack
   strips), or the 32×32 armored-paladin healer sheet (cast poses)

**Target density:** party characters and trash aim for **native 32×32** (chunky
SNES/GBA read). Bosses can share that pixel density at a larger canvas later.
All three party mercs (tank, dps1, dps2) are now tight 32×32; ash-husk is the
last legacy ~92×92 padded canvas still queued for replacement.

Relic pick / run-mod icons use hand-authored 32×32 stills (`ui/relicSprites.ts`).
Everything else in the game stays temp art per CLAUDE.md.

## Where things are

- `game/public/assets/tiny-dungeon.png` — Kenney packed tilesheet (12 cols ×
  11 rows, 16px tiles, no spacing) + license copy alongside.
- `game/public/assets/units/healer/` — armored-paladin healer. Combat still
  is `south.png` (camera-facing still; `east.png` mirrors for preload compat).
  `sheet.png` is a rest/preload still. Live strips: `idle-south/` (breathing),
  `charge-solemn-south/` + `charge-zealous-south/` (4f charge loops),
  `cast-solemn-south/` + `cast-zealous-south/` (9f releases),
  `attack-south/` (Bonk zap). Source: `art/source/armored-paladin/`.
  Spell → style: solemn-* / vowstrike-virtue → Solemn; zealous-* /
  vowstrike-vengeance → Zealous; bonk → zap only (FE exposure in `sprites.ts`).
- `game/public/assets/units/tank/` — tight 32×32 tank (`east.png` +
  `attack-east/0–6.png` + `hurt-east/0–4.png`). Displays at 64 with the
  healer foot-pad ratio. Own exposure sheets: `TANK_ATTACK_FRAME_DURATIONS_MS`,
  `TANK_HURT_FRAME_DURATIONS_MS` (`sprites.ts`). Authoring cache:
  `artifacts/pixellab-tank-v2/` (frozen still also in `art/source/tank/`).
- `game/public/assets/units/dps1/` — tight 32×32 melee DPS (`east.png` +
  `attack-east/0–6.png` + `hurt-east/0–4.png`). Displays at 64 with the
  healer foot-pad ratio, same as tank. Own exposure sheets:
  `DPS1_ATTACK_FRAME_DURATIONS_MS`, `DPS1_HURT_FRAME_DURATIONS_MS`
  (`sprites.ts`). Authoring cache: `artifacts/pixellab-dps1-v2/` (source
  still also in `art/source/dps1/`).
- `game/public/assets/units/dps2/` — tight 32×32 ranger DPS (`east.png` +
  `attack-east/0–6.png` + `hurt-east/0–4.png`). Displays at 64 with the
  healer foot-pad ratio, same as tank/dps1. Own exposure sheets:
  `DPS2_ATTACK_FRAME_DURATIONS_MS`, `DPS2_HURT_FRAME_DURATIONS_MS`
  (`sprites.ts`). Authoring cache: `artifacts/pixellab-dps2-v2/` (source
  still also in `art/source/dps2/`).
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
  `unit-dps2-attack`) with FE-style **exposure sheets** — not equal frame
  durations. Tank, dps1, and dps2 each have their own tight-32-native
  sheets — `TANK_ATTACK_FRAME_DURATIONS_MS`, `DPS1_ATTACK_FRAME_DURATIONS_MS`,
  `DPS2_ATTACK_FRAME_DURATIONS_MS` (all 7 frames held). The legacy
  `MERC_ATTACK_FRAME_DURATIONS_MS` (rest duplicate frame 0 skipped) is no
  longer used by a live party merc. Timing model:
  [Unpacking Fire Emblem's animations](https://lost-worlds.neocities.org/blog/2024/10/20/fire-emblem-animation/).
  `UnitSprite.playAttack()` runs on tank shove / DPS jab, then restores the
  rest still.
- **Hurt strips**: tank + dps1 + dps2 `hurt-east/0–4.png` are preloaded and
  Phaser-anim registered the same way (`unit-tank-hurt`, `unit-dps1-hurt`,
  `unit-dps2-hurt`, `TANK_HURT_FRAME_DURATIONS_MS` /
  `DPS1_HURT_FRAME_DURATIONS_MS` / `DPS2_HURT_FRAME_DURATIONS_MS` in
  `sprites.ts`, `UNIT_HURT_ANIMS` parallel to `UNIT_ATTACK_ANIMS`).
  `UnitSprite.playHurt()` runs whenever a `damage` event lands on a unit
  with a wired hurt strip (no-op otherwise), then restores the rest still.
- **Healer Solemn / Zealous cast**: CombatScene special case — per-spell
  `healerCastStyleForSpell` picks charge/cast strips from `HEALER_CAST_STYLE_ANIMS`.
  Charge loops on `castStarted` (channeled); cast-action on `finishCast` /
  instant `playCastRelease`; cancel snaps to idle. Not selected by
  `presentationForUnit`. Texture key `unit-healer`, south-facing, no flipX.
- **Healer idle / Bonk zap** (chunk 1B): `unit-healer-idle` is a continuous
  Phaser anim (`repeat: -1`, `idle-south/` frames, `HEALER_IDLE_FRAME_DURATIONS_MS`)
  that plays whenever the healer isn't charging/casting/zapping. `unit-healer-zap`
  is a one-shot (`attack-south/`, `HEALER_ZAP_FRAME_DURATIONS_MS`) that **only**
  Bonk's `castStarted` plays — `castFinished` skips `finishCast` for Bonk so
  the strip isn't snapped idle same-tick. All healer strips register via
  `HEALER_STRIP_ANIMS` (loop vs one-shot per strip). `zap-vfx`
  (`assets/zap-vfx.png`) is the pale-gold target impact on Bonk damage
  (`combatFx.showZapImpact`).
- `pixelArt: true` in `main.ts` gives nearest-neighbor filtering game-wide.
- Display sizes (`CombatScene.ts`): tight 32×32 party (healer, tank, dps1,
  dps2) at **64** (2×) — no more legacy padded 112 party mercs; Kenney party
  **48**; PixelLab trash **72**, Kenney trash **32**; bosses **80** (Kenney
  today).
  Padded canvases use `bodyOffsetY` so painted feet meet `GROUND_Y`. HP/mana
  meters are capped at 72px wide so neighboring party bars don't overlap.
- Death state = dark tint + alpha + shrink (`update()` in unitSprite.ts).

## Current casting

| Unit | Path | Asset |
|------|------|-------|
| tank | tight 32 still + attack + hurt | `unit-tank` + `unit-tank-attack` + `unit-tank-hurt` |
| dps1 | tight 32 still + attack + hurt | `unit-dps1` + `unit-dps1-attack` + `unit-dps1-hurt` |
| dps2 | tight 32 still + attack + hurt | `unit-dps2` + `unit-dps2-attack` + `unit-dps2-hurt` |
| healer | 32×32 armored-paladin south | idle + Solemn/Zealous charge/cast + Bonk zap |
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
