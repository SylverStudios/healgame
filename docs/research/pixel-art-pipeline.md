# Pixel-Art Pipeline Research (Phase 2, Chunk R)

Status: historical · Authority: none — research only · Last verified: 2026-07-17

Era snapshot from before Kenney Tiny Dungeon shipped. Live unit art:
[`../unit-art.md`](../unit-art.md).

## Question and constraints

Can we get 8-bit-style unit sprites for healgame **without an image model**?

- Game is Phaser 3 + TypeScript + Vite, currently temp-art rects
  (`game/src/scenes/CombatScene.ts`): party 64×64, trash 48×48, boss 110×110.
- No AI/image-model art generation — out of scope for this whole project.
- Two candidate paths per the Phase 2 handoff:
  (a) programmatic generation (number matrix → runtime texture, sprite-gen
  libraries, Aseprite/Piskel CLI export)
  (b) user-drawn art, downscaled with a nearest-neighbor script.

All experiments below were run in scratch space
(`/private/tmp/.../scratchpad/pixelart-poc`), not in the repo. `git status`
after this chunk shows only this new file.

## Path (a): programmatic generation

### Number matrix → texture, tried for real

The technique the handoff describes (palette-indexed number matrix →
`Graphics.fillRect` per cell → `generateTexture()`) is a real, standard
Phaser pattern. To prove the core idea without booting a browser, I
reproduced it with a Node script and `pngjs`, which does pixel-for-pixel
what `generateTexture` would do:

```js
// gen.mjs — 16x16 matrix, palette-indexed (0=transparent,1=outline,
// 2=robe,3=skin,4=cross-icon), rasterized straight to PNG.
```

Ran `node gen.mjs` → produced a 16×16 PNG of a simple robed-healer silhouette
with a white cross, purple robe (matches game's dark palette), from a matrix
like:

```
"0000011111100000"
"0000133333310000"
...
"0012224444221100"   <- the cross
...
```

This confirms the technique works. The problem isn't feasibility, it's
**authoring ergonomics**: hand-writing a 16×16 (256-cell) grid of digits in a
TS file, with no live visual feedback, no undo, no color picker, is
materially slower and more error-prone than drawing in any paint tool. It's
a fine technique for *procedural variation* (e.g. randomizing palette swaps
on a fixed silhouette) but a poor primary authoring path for "draw N distinct
hero/monster sprites."

### Sprite-generation libraries — evaluated on npm, not viable

Checked what actually exists and whether it's maintained (`npm view <pkg>`,
`npm view <pkg> time.modified`, weekly download counts):

| Package | Version | Last published | Weekly DL | Verdict |
|---|---|---|---|---|
| `pixel-sprite-generator` | 0.0.1 | 2022, single release ever | 17 | Installed and read it. It's the classic Dave Bollinger-algorithm generator: a random bitmask, mirrored for symmetry, rendered to canvas. Produces abstract symmetric "space invader" blobs, not directed art — no way to say "draw a robed healer." Fine for filler loot icons, wrong tool for identifiable party/boss units. Unmaintained (0.0.1, no updates). |
| `aseprite-cli` | 1.1.2 | 2022 | 35 | Not a generator — a thin subprocess wrapper around the real **Aseprite** app (a $20 paid editor you'd have to install separately). Only useful once art already exists in `.aseprite` files, for scripted export. Out of scope: costs money, and still needs a human to draw in Aseprite anyway. |
| `piskel-cli` | 1.0.41 | 2022 | 16 | Wraps the Piskel editor's export. Depends on `phantomjs` (`^2.1.7`) — PhantomJS was discontinued in 2018 and its npm installer frequently fails today since binary hosting has rotted. Verified this is a listed dependency via `npm view piskel-cli`; did not attempt install given the known-broken PhantomJS binary fetch. Rejected. |
| `spritesheet-js`, `spritesmith`, `sprity` | — | mixed | — | These are **packers** (combine existing frames into a texture atlas), not art generators. Relevant later for atlasing finished sprites, not for creating them. |

Conclusion for path (a): the runtime-texture technique is real and cheap,
but every actual "generate art for me" library on npm is either
abstract/undirected, unmaintained, or a wrapper around a paid app. Nothing
here beats a human drawing the sprite once.

## Path (b): user-drawn + nearest-neighbor downscale

### sips: tried it, and it does NOT do nearest-neighbor

The handoff assumed `sips` could do the nearest-neighbor downscale. I tested
this directly rather than assuming:

1. Generated a clean 16×16 native PNG (`native-16x16.png`, the same
   healer-silhouette matrix above), confirmed `sips -g pixelWidth -g
   pixelHeight` reports 16×16.
2. Upscaled it 4× to 64×64 with `sips -z 64 64` (an exact integer ratio —
   the best case for detecting whether an algorithm is nearest-neighbor,
   since a true nearest-neighbor 4× scale produces perfect flat 4×4 blocks
   of identical color, zero blending).
3. Wrote a small checker script that inspects each output 4×4 block for
   internal color variance. Result: **177 of 256 blocks (69%) had internal
   variance** — i.e. `sips` blended/interpolated instead of repeating
   pixels. `sips --help` confirms there is no resampling-mode flag at all
   (`-z/-Z/--resampleWidth` etc., no kernel/filter option) — it always uses
   some smoothing filter.
4. Tested the realistic downscale direction too: simulated a "user drew this
   big" source two ways — (i) a sloppy case (sips-upscaled, already fuzzy)
   and (ii) the **best case**, a perfectly-aligned, hard-edged 256×256
   image (16× nearest-neighbor scale of the original, i.e. no anti-aliasing
   at all, as if the user only ever used bucket-fill/rectangle tools).
   Downscaling *even the best-case perfect image* back to 16×16 with
   `sips -z 16 16` and diffing against the original: **131/256 pixels (51%)
   differed** from the source truth. So `sips` cannot cleanly round-trip
   pixel art even under ideal conditions — it's the wrong tool for this job.

### sharp: tried it, does real nearest-neighbor, pixel-perfect

Installed `sharp` in scratch space (`npm install sharp`, all scratch-local,
nothing global). It's mainstream and actively maintained: v0.35.3, published
this month, Apache-2.0, **67.5M weekly downloads** (`npm view sharp`,
`api.npmjs.org/downloads`).

`sharp(...).resize(16, 16, { kernel: "nearest" })` on the same best-case
256×256 hard-edged source reproduced the original 16×16 matrix **exactly —
0/256 pixels differed** from the source truth. Also confirmed the analogous
upscale case is bit-exact (0/256 blocks with internal variance, vs. 177/256
for `sips`).

### Full pipeline PoC including transparency

A real paint app export usually can't produce a transparent background
easily (e.g. macOS Preview flattens to an opaque canvas). Tested the
practical fix — **draw on a solid chroma-key color, strip it after
downscaling**:

1. Generated the same matrix with an opaque magenta (`#FF00FF`) background
   instead of alpha=0, simulating a flattened paint-app export.
2. Nearest-neighbor-scaled it up 16× to simulate "user's big drawing."
3. Ran it through `sharp` nearest-kernel downscale to 16×16.
4. Ran a ~15-line chroma-key script (swap exact `#FF00FF` pixels to
   alpha=0) *after* the downscale (key color stays pure through a
   nearest-neighbor resize, unlike a smoothing resize where it would bleed
   into neighboring colors).
5. Diffed the result against the true original, ignoring RGB-under-zero-alpha
   noise: **0/256 visually-meaningful pixels differed.** Bit-for-bit
   reproduction of the intended art, transparency included.

Viewed the final image (nearest-neighbor-upscaled back to 64×64 for
inspection only) — crisp flat-color blocky robe/skin/cross, hard edges, no
fringing. Confirmed visually via the Read tool against the sips-processed
version, which showed visible edge blur/color bleed and a "smudged" outline
by comparison.

## Concrete dimensions

Recommend **one native pixel size for all unit categories: 16×16.** Single
canvas template for whoever draws the art, and it maps cleanly onto two of
the three current rects:

| Unit type | Current rect | Native px | Scale factor | Integer? |
|---|---|---|---|---|
| Party | 64×64 | 16×16 | 4× | yes — clean |
| Trash | 48×48 | 16×16 | 3× | yes — clean |
| Boss | 110×110 | 16×16 | 6.875× | **no** |

The boss rect is not a multiple of 16, so scaling a 16×16 source to 110×110
will have Phaser round pixel widths unevenly (some source pixels render 6px
wide, others 7px) — a minor softening, not a broken look, and still miles
crisper than free-form smoothing. If a future art slice wants pixel-perfect
boss scaling, the cheap fix is nudging the boss rect to a multiple of 16
(96 or 112) in `CombatScene.ts` — **not done here**, out of scope for this
research-only chunk, just flagged for whoever picks up the art slice.

### Phaser config needed (for the future art slice, not applied now)

```ts
// game config
new Phaser.Game({
  ...,
  pixelArt: true, // sets antialias:false + roundPixels:true — NEAREST
                   // texture filtering game-wide, no per-texture config needed
});

// preload
this.load.image('party-healer', 'assets/sprites/party-healer.png'); // 16x16 source

// render — let Phaser scale at runtime rather than baking pre-scaled PNGs,
// so the same 16x16 source serves party/trash/boss at different sizes
this.add.image(x, y, 'party-healer').setDisplaySize(64, 64);
```

Loading the native 16×16 source and letting Phaser's GPU-side nearest-
neighbor filter do the upscale (via `pixelArt: true` + `setDisplaySize`)
means we never need to ship pre-upscaled PNGs at all — one 16×16 file per
sprite covers party/trash/boss uses.

## Recommendation

**Path (b): user draws, we downscale with `sharp`, not `sips`.**

Rationale: path (a)'s only working technique (hand-authored number matrices)
is strictly slower to author than drawing, and every actual "generate sprite
art" library on npm is unmaintained, undirected, or gated behind a paid app.
Path (b) is proven end-to-end above, including the exact tool substitution
(`sharp` over `sips`) needed to actually hit a crisp 8-bit look — the
handoff's assumption that `sips` alone would do nearest-neighbor is false in
practice, confirmed with two separate empirical tests.

### How we'd do it (step by step)

1. **Draw big, flat, hard-edged.** User draws each unit at 256×256 (16×
   the native 16×16 target) in any paint tool (MS-Paint-style, Preview
   markup, Pixelmator, GIMP, Krita — anything with bucket-fill/rectangle
   tools). Rule: no soft/anti-aliased brushes, no gradients — flat color
   blocks only, roughly aligned to a 16×16 grid (a faint reference grid
   overlay helps). If the tool can't export alpha transparency, draw the
   background as solid `#FF00FF` (or any color that won't appear in the
   art) instead of fighting with alpha channels.
2. **Install `sharp` as a dev-only asset-pipeline tool** (not a game
   runtime dependency — it only runs during art authoring):
   ```
   npm install --save-dev sharp
   ```
3. **Downscale with the nearest kernel:**
   ```js
   import sharp from "sharp";
   await sharp("party-healer-big.png")
     .resize(16, 16, { kernel: "nearest" })
     .toFile("party-healer.png");
   ```
4. **Strip the chroma key if used** (skip if the source already had real
   alpha): swap exact `#FF00FF` pixels to alpha=0 in the 16×16 output
   (~15-line script, or any tool with an exact-color-to-alpha feature).
5. **Set `pixelArt: true`** in the Phaser game config (one line, future art
   slice) and load the 16×16 PNGs directly — no pre-scaling needed, Phaser's
   nearest-neighbor texture filter handles party (4×), trash (3×), and boss
   (6.875×, slightly soft) scaling at render time.
6. Repeat per unit (4 party classes/subclasses, trash types, bosses). Same
   256×256 canvas size for every sprite keeps the authoring loop identical
   regardless of final display size.

This is fully compatible with the project's temp-art ethos — it's still
extremely cheap (one dev-dependency, a five-line script, no ongoing cost)
and stays entirely outside `game/src/combat` and `game/src/data` purity
rules since it's an asset-prep step, not engine code.

## Rejected alternatives

- **`sips` for downscaling** — built-in, but has no nearest-neighbor mode
  and no way to request one (`sips --help` confirms no kernel/filter flag).
  Empirically blurs 51-69% of pixels vs. ground truth even in the best case.
  Good for format conversion and non-pixel-art resizing; wrong tool here.
- **`pixel-sprite-generator`** (npm) — real and installable, but produces
  undirected symmetric noise-blob sprites (invader-style), not
  class-identifiable party/boss art; last published 2022, single version,
  effectively abandoned.
- **`aseprite-cli`** — just a subprocess wrapper around the paid Aseprite
  app; doesn't generate anything itself and still requires buying/installing
  Aseprite and drawing by hand there, no advantage over any free paint tool.
- **`piskel-cli`** — depends on `phantomjs`, discontinued since 2018 with a
  commonly-broken npm binary installer; rejected without even attempting
  install.
- **Hand-authored number matrices as the primary art path** — proven to
  work technically (see path (a) PoC) but strictly worse authoring ergonomics
  than drawing in a paint tool: no live preview, no undo, no palette tool,
  error-prone at 256 cells per sprite. Kept as a future option only for
  cheap procedural palette-swap variants of an already-drawn base sprite.
- **ImageMagick (`convert`/`magick`)** — a real alternative to `sharp` for
  nearest-neighbor scaling (`-scale` / `-filter point`), but not installed
  on this machine and would require a global `brew install imagemagick`,
  which this chunk's constraints disallow testing. `sharp` was already
  provable in scratch space via plain `npm install` with no global
  footprint, so it's the tested recommendation; ImageMagick remains a
  reasonable substitute if a scratch-local npm install of `sharp` is ever
  undesirable.
