# Per-dungeon battlefield variants (bible §4 item 8)

Status: current · Last verified: 2026-07-20

Extends chunk 2's Ash Gate battlefield (`artifacts/pixellab-1/README.md`) to
all 6 dungeons via `PixelLab create_object_state` recolors of the 3 accepted
Ash Gate source objects. Wiring: `game/src/ui/battlefield.ts` (generalized
from a single hardcoded `'ashgate'` variant to a closed 6-key
`BattlefieldVariantKey` union + `battlefieldForEncounter()`).

## Result: all 5 remaining dungeons shipped custom art

No dungeon fell back to Ash Gate. Every one of `iron-pass`, `cinder-vault`,
`verdant-rift`, `black-choir`, `the-maw` has its own gate-arch +
wall-fragment + platform, recolored via `create_object_state` from the
frozen chunk-2 source objects (gate-arch `91ea497b-2eef-46dc-b674-423061be8d7c`,
wall-fragment `e896b630-1688-4d2b-99d2-f08a7aef2234`, platform
`00ec45eb-d35f-40d8-ab81-0de05efff57b`). `create_object_state` preserves the
source's composition/silhouette and canvas size exactly (verified: every
recolor came back at the same native size as its source — 300x200 /
140x110 / 170x40) and only reskins color/material per the edit prompt, so
the locked composition (arch centered, mirrored wall-fragments, platform
under each line) needed zero changes.

## Themes per dungeon

| Dungeon | Theme | Palette shift |
|---|---|---|
| iron-pass | frozen iron mountain pass | soot-black → cold grey-blue iron + frost, icicles, pale blue-white glow |
| cinder-vault | molten forge-crypt | ash-grey → dark iron/blackened brick, glowing molten-orange magma cracks (hotter than Ash Gate's dying embers) |
| verdant-rift | overgrown nature rift | charred stone → mossy vine-choked ruin, roots, pale bioluminescent green glow |
| black-choir | gothic ritual cathedral | charred stone → obsidian-black stone with bone inlays/ribs, faint pale candlelight |
| the-maw | void-touched bone maw | charred stone → colossal bone-white ribs fused into void-black rock, deep blood-red void glow |

Every prompt reused the shared STYLE.md vocabulary ("heavy-metal dark
fantasy," "chunky pixel art," "single black outline," "basic shading," "one
light source upper-left") plus an explicit "instead of ember-orange"
instruction so the model shifted the accent color rather than defaulting
back to Ash Gate's own palette.

## Unexpected win: real alpha on the recolors

Ash Gate's original gate-arch has **zero transparent pixels** (a fully
opaque painted diorama — see pixellab-1/README.md's caveat). Checked with
Pillow across all 5 recolors: every one came back with genuine transparency
at the canvas corners (`(0,0,0,0)` sampled at (5,5) for all 5, vs Ash Gate's
opaque `(36,15,21,255)`), and cinder-vault / the-maw even have a transparent
archway *opening* (the model rendered those as a glowing void rather than a
painted-in scene). This means these 5 variants composite more honestly onto
the code sky-gradient than Ash Gate's own diorama does — no accident, just a
side effect of `create_object_state` editing an existing raster rather than
re-running the same inpainting-diorama generation path. No code changes were
needed to benefit from it (the wall-fragment overlap-masking trick still
applies harmlessly; it just has less to hide now).

## Generation ledger (16 jobs, 15 accepted + 1 stalled/abandoned = 15 generations spent — 1362 → ~1062)

Balance checked before (`1362`) and after (`1062`) via `get_balance`; cost
came out to roughly 20 generations per accepted asset (300 total for 15
assets), consistent with chunk 2's low per-job cost for `create_object_state`
style edits.

| Dungeon | Asset | Job ID | Verdict |
|---|---|---|---|
| iron-pass | gate-arch | `50c3f921-83d8-43ae-a1c9-5fe869465778` | **ACCEPTED** |
| iron-pass | wall-fragment | `a5bdfc06-8573-4f1d-86e0-b38c8b731b24` | **ACCEPTED** |
| iron-pass | platform | `83cb443e-7961-47ae-93b8-d236df59a9a8` | **ACCEPTED** |
| cinder-vault | gate-arch (attempt 1) | `ad79def7-2ea0-488c-a778-ee112b148503` | **stalled** — stuck at 74% "creating" for 8+ minutes across many polls (ETA climbing instead of shrinking, a stall pattern distinct from the ash-gate ember-haze rejections in chunk 2), abandoned per the phase timebox rule rather than waited out indefinitely |
| cinder-vault | gate-arch (attempt 2, reroll) | `5e285843-a52f-4f41-8e3f-176c1a13595b` | **ACCEPTED** — completed normally (~90s) on retry |
| cinder-vault | wall-fragment | `d34b964b-b4b4-4205-a49f-6c1371c05716` | **ACCEPTED** |
| cinder-vault | platform | `c4818885-294a-45a6-88fb-1021a0aaffb9` | **ACCEPTED** |
| verdant-rift | gate-arch | `6c372498-df6b-41f4-91ff-b8751ac92c75` | **ACCEPTED** |
| verdant-rift | wall-fragment | `164e370b-62ee-4954-8202-f988d0a5d29f` | **ACCEPTED** |
| verdant-rift | platform | `226abf5f-16f3-4181-9e58-a2bd71684002` | **ACCEPTED** |
| black-choir | gate-arch | `3e576eb8-341d-462d-b86c-b1ae86ed6bc2` | **ACCEPTED** |
| black-choir | wall-fragment | `b301839f-8949-4608-8868-b345018cf55d` | **ACCEPTED** |
| black-choir | platform | `356775a0-383d-4bce-84ab-7d54e2d82d7f` | **ACCEPTED** |
| the-maw | gate-arch | `cdcf9197-a1e9-4ecc-a128-288ad79fe62e` | **ACCEPTED** |
| the-maw | wall-fragment | `8d753463-f6b1-41ba-af04-a5e324718858` | **ACCEPTED** |
| the-maw | platform | `e2bb5705-8ce6-4db2-87b2-fff2c19161d2` | **ACCEPTED** |

Note on the stalled job: this is the only asset across chunks 1-8 that hit a
genuine job-level stall (as opposed to a rejected/off-model result). The
timebox rule ("2 rerolls, then fall back") was applied to the *stall*, not a
quality rejection — one reroll with a lightly reworded prompt converged
normally, so no code-drawn fallback was needed for cinder-vault's gate-arch.
The stalled job (`ad79def7-...`) was left running rather than actively
cancelled (no `delete_object` call needed — PixelLab auto-expires unclaimed
objects after 8 hours per the tool's own documentation) and is not wired
into the game.

## Files

- Source (frozen per dungeon): `art/source/battlefields/<dungeon-id>/{gate-arch,wall-fragment,platform}.png`
  for `iron-pass`, `cinder-vault`, `verdant-rift`, `black-choir`, `the-maw`
  (ash-gate's own source untouched, still at `art/source/battlefields/ashgate/`)
- Runtime: `game/public/assets/battlefields/<dungeon-id>/{gate-arch,wall-fragment,platform}.png`
  (identical bytes to source, no crop/resize — PixelLab returned the exact
  art-grid dimensions of the source object for every recolor)
- Wiring: `game/src/ui/battlefield.ts` (generalized `VARIANT_TEXTURES` +
  `battlefieldImageLayouts()` + `battlefieldForEncounter()`; `battlefield.test.ts`
  extended, not forked), `game/src/scenes/BootScene.ts` (preload via the new
  `allBattlefieldTextures()` union helper), `game/src/scenes/CombatScene.ts`
  (`buildBattlefield(this, battlefieldForEncounter(this.sceneData.encounterId), ...)`
  replacing the hardcoded `'ashgate'` literal)

## API changes (chunk 8, on top of chunk 2's frozen `buildBattlefield`/`battlefieldTexturesForVariant`)

- `BattlefieldVariantKey` — was `'ashgate'` only, now a closed union of all 6
  dungeon ids (`'ash-gate' | 'iron-pass' | 'cinder-vault' | 'verdant-rift' |
  'black-choir' | 'the-maw'`). Note the ash-gate key is now the hyphenated
  `'ash-gate'` (matching the dungeon id / `DUNGEON_ORDER`) even though its
  underlying texture keys/folder stay the original unhyphenated
  `battlefield-ashgate-*` / `assets/battlefields/ashgate/` (frozen, chunk-2
  asset paths untouched).
- `ashGateImageLayouts()` → generalized to `battlefieldImageLayouts(textures, params)`,
  taking a `{ gateArch, wallFragment, platform }` texture set instead of
  reading module-scoped Ash-Gate constants. Same math, same output shape.
- `ashGateHazeBandLayout()` → renamed `battlefieldHazeBandLayout()` (geometry
  is identical across variants; only the tone/mote-color passed to the
  drawing function changes per variant, via a new `VARIANT_ATMOSPHERE` map).
- New: `battlefieldForEncounter(encounterId)`, `allBattlefieldTextures()`.
- Unchanged (pinned): `buildBattlefield(scene, variantKey, params)` and
  `battlefieldTexturesForVariant(variantKey)` signatures.

## Visual check

`npm run smoke -- --shots` battlefield screenshots now differ per dungeon —
`iron-pass-combat-entered.png` (frost/icicle gate), `maw-combat-start.png` /
`maw-mid-fight.png` (bone/void gate), `ash-gate-first-run-feedback.png`
(unchanged ember gate) — confirmed visually distinct from each other and
from Ash Gate. No interactive-object regressions; journey stages targeting
`hubDungeon:*`, `combatReturn`, etc. still resolve by name only (battlefield
objects stay unnamed, non-interactive, depth <= -1 as before).
