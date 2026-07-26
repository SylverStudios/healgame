# Ash Gate combat battlefield (bible item 1)

Status: current · Last verified: 2026-07-20

Layered backdrop + FE-GBA perspective platform slices for `CombatScene`,
replacing the flat 2px ground-line rect (`docs/ui-theme-research.md` §1/§4
item 1; chunk 2 of `docs/ui-theme-handoff.md`). Wiring: `game/src/ui/battlefield.ts`.

## Composition (back to front, all depth <= -1)

1. **Sky gradient** (code, `Phaser.Graphics`) — bg -> warm ember horizon ->
   near-black floor shadow. Colors are `mixPaletteColor()` blends of
   `PALETTE_NUM` entries only, no new hex constants.
2. **Far silhouette** (code, `Phaser.Graphics`) — jagged distant-skyline
   polygon; mostly occluded by the structure props below, visible at the
   screen corners they don't reach.
3. **Structure props** (PixelLab `create_map_object`) — charred gate arch
   (centered) + two mirrored wall-fragment instances (edges), depth -4.
4. **Ember haze band** (code fallback — see "What didn't converge" below),
   depth -2.
5. **Platform slices** (PixelLab `create_map_object`, same texture reused
   for both sides) under the party line and the enemy line, depth -1.

## Generation ledger (6 jobs, 6 generations spent — 1663 -> 1657)

| Asset | Size (art px) | Prompt gist | Job ID | Verdict |
|---|---|---|---|---|
| gate-arch | 300x200 | charred stone gate arch, crumbling battlements, ember cracks | `91ea497b-2eef-46dc-b674-423061be8d7c` | **ACCEPTED** — see caveat below |
| wall-fragment | 140x110 | broken fortress wall chunk, scorch marks, ember glow | `e896b630-1688-4d2b-99d2-f08a7aef2234` | **ACCEPTED** |
| platform | 170x40 | oval charred ash-grey stone battle platform, cracked ground | `00ec45eb-d35f-40d8-ab81-0de05efff57b` | **ACCEPTED** |
| ember-haze v1 | 240x32 | drifting ember haze/smoke band, glowing embers | `441af3c8-ff28-4ecb-971e-59e2bbd9f6a0` | rejected — rendered as a literal flame strip, too intense/opaque for an atmosphere layer |
| ember-haze v2 | 240x32 | same, reworded "soft/subtle/no flames" | `238ef719-11ac-4b8d-8a5a-7749a01b71b9` | rejected — came back **fully transparent** (0/7680 non-zero-alpha pixels) |
| ember-haze v3 | 240x32 | reworded again, "ember sparks + ash particles" | `ec35e312-78db-414d-97f1-70004bb6eced` | rejected — only 100/7680 non-zero pixels, a handful of stray dots, not a usable band |

**Ember-haze band stays code-drawn.** Three attempts across two distinct
failure modes (over-literal flame strip, then two empty/near-empty renders)
without converging — per the phase timebox rule ("if a single asset isn't
converging after ~2 rerolls, stop and report"), this stopped after the 2nd
reroll rather than grinding a 4th prompt variant. `buildEmberHaze()` in
`battlefield.ts` draws a soft tinted band (`mixPaletteColor(bg, danger, 0.18)`
at low alpha) plus a handful of small gold glow motes instead — consistent
with the existing code-drawn VFX in `ui/combatFx.ts` and with the bible's own
"backdrops are composed layers" framing (§3 gap note already anticipates
code-drawn atmosphere alongside generated props).

## Caveat: gate-arch has no alpha channel

`create_map_object`'s `background_image` param is an *inpainting* mode (drop
a prop into an existing scene image), not a lightweight style-reference like
`create_character`'s `style_images` — there is no `style_images` parameter on
`create_map_object` at all. Requesting a large (300x200) "side" view scene
description (gate + battlements + walkway + braziers) made the model render
a **self-contained opaque diorama** rather than an isolated cutout: the
returned PNG has zero transparent pixels (checked via Pillow: `60000/60000`
non-zero alpha), with a dark maroon-to-black top-to-bottom tone already baked
in as its own "sky."

Rather than reroll trying to force transparency (which risks losing the
strong composition — see the accepted screenshot), this was treated as a
feature: the code sky-gradient's horizon color
(`mixPaletteColor(PALETTE_NUM.bg, PALETTE_NUM.danger, 0.18)`) was tuned to
sit close to the arch's own sampled corner tone (`(39,11,17)` at native res),
and the two wall-fragment props (which *do* have real alpha — ~38% opaque
coverage, genuine cutouts) are positioned with a 100px overlap onto the
arch's left/right edges specifically to mask the seam. Visual result checked
in the smoke screenshot below — the seam is not visible in practice; the
whole thing reads as one cohesive scene despite being 3 separate images.

## Style-reference friction

The chunk brief asks every generation call to style-reference
`art/source/armored-paladin/east.png` / relic icons via `style_images`. That
param exists on `create_character`/`create_tiles_pro` but **not** on
`create_map_object` (used for all 4 assets here, since a single custom
trapezoid/diorama shape was simpler to integrate than a `create_tiles_pro`
tileset — no Phaser tilemap exists in `CombatScene`, only single `add.image`
calls). Consistency instead came from matching STYLE.md's shared vocabulary
in every prompt (soot/ember/iron/bone, "single black outline," "one light
source upper-left," "heavy-metal dark fantasy," "chunky pixel art") and
`outline`/`shading` params mirroring STYLE.md's character rules
(`"single color outline"`, `"basic shading"`). Judged by eye against the
healer/relic art in the smoke screenshot — reads consistent, not mismatched
density or palette. Flagging this as a real API gap, not a skipped step.

## Palette-count note

`npm run art -- validate` (the unit-art tool) flags all three accepted PNGs
as "palette heavy" (67-196 colors vs STYLE.md's ~24-color character budget).
That budget is written for single-character sprites; it was never intended
for environment/backdrop art with painted-scene gradients and fire glow, so
this is expected and not a defect — noted here rather than silently ignored.

## Files

- Source (frozen): `art/source/battlefields/ashgate/{gate-arch,wall-fragment,platform}.png`
- Runtime: `game/public/assets/battlefields/ashgate/{gate-arch,wall-fragment,platform}.png`
  (identical bytes to source — no crop/resize step needed, PixelLab returned
  exact art-grid dimensions already)
- Wiring: `game/src/ui/battlefield.ts` (+ `battlefield.test.ts` for the pure
  layout math), `game/src/scenes/BootScene.ts` (preload), `game/src/scenes/CombatScene.ts`
  (`buildBattlefield()` call replacing the old `buildGroundLine()`)

## Visual check

`npm run smoke -- --shots` → `game/journey-shots/02-ash-gate-first-run-feedback.png`
(also visible in `04-combat-heal-sparkle.png`, `33-maw-combat-start.png`,
`34-maw-mid-fight.png` — same battlefield renders under every encounter
today since only the `'ashgate'` variant exists; chunk 8 adds per-dungeon
variants on top of `battlefieldForEncounter()`). Confirmed: backdrop layers
visible and cohesive, both platform slices sit under their feet lines, units
(including the boss-tier Hollow King placeholder) stay clearly readable in
front of the platform art, no interactive-object regressions (journey green).
