# Talent-tree node socket + edge dressing (bible item 7)

Status: current · Last verified: 2026-07-20

Pixel-art node sockets and edge-groove strips for `TreeScene`
(`docs/ui-theme-research.md` §4 item 7; chunk 7 of `docs/ui-theme-handoff.md`).
Wiring: `game/src/ui/treeSockets.ts` (new kit), `scenes/BootScene.ts`
(preload), `scenes/TreeScene.ts` (`renderSpotBox`, `renderEdges`/
`drawEdgeLine`/`drawLockedSegments`/`drawLockedMarks`, `buildEdgeLegend`).

## Generation ledger (2 jobs, 45 generations spent — 1407 → 1362)

| Asset | Mode/size | Prompt gist | Job ID | Verdict |
|---|---|---|---|---|
| Socket ring | `create_ui_asset`, 256×256 | circular iron socket frame, weathered dark-fantasy bronze-iron bezel ring, riveted rim, hollow transparent center | `04d7fc56-f68d-4ec7-8da0-dd2ad2ffa172` | **ACCEPTED** — came back as a rounded-square panel with the ring artwork isolated inside a genuinely transparent interior (not a solid backdrop — see "Isolating the ring" below); cropped to a clean donut, downsampled to 20×20 native |
| Edge strip | `create_ui_asset`, 512×192 | weathered iron rune-groove strip, horizontal carved channel bar with faint glowing rune ticks, dark-fantasy heavy-metal style | `c91e9880-44be-47f6-ac84-bed837507b79` | **ACCEPTED** — came back as a kit sheet (one long toolbar + 4 small pill variants, same auto-scaffold behavior chunks 3/4 hit); the long toolbar's rune-tick row cropped and downsampled to 48×8 native |

Both jobs succeeded on the first try — no rerolls needed, well under the
~40–80 generation estimate and the 150 hard-stop / 800 floor. Balance after
chunk 7: **1362**.

## Isolating the ring: the square "panel" scaffold was a hollow frame, not a solid backdrop

`create_ui_asset` without `pieces`/`elements` defaults to scaffolding a
rounded-rect panel around whatever the description asks for (same behavior
chunk 3/4 saw). Unlike those chunks' panel/button sheets, here the square's
*interior* turned out to be genuinely transparent (alpha 0) everywhere except
where the ring itself was drawn — confirmed by sampling pixel alpha at
several interior points before cropping. So no chroma-keying was needed:
cropping inward from the square's outer border band (`(44,44,212,212)` on
the 256×256 canvas) yielded an already-isolated ring with a fully
transparent background on all sides. `art/source/ui/tree/socket-ring-sheet.png`
(raw generation) and `socket-ring-crop.png` (pre-downsample crop) keep both
stages for the record.

## Legible at 20px native — narrower finding than chunks 3/4's "illegible below ~12px"

Chunks 3/4 established that *fine ornamental detail* (rivet bevels, corner
brackets) reads as mush below ~12px native. This chunk's socket ring is a
**simple donut silhouette + one flat color band**, not a bevel/rivet motif —
tested by downsampling to 20/24/28/32px native and eyeballing each (see
session images, not committed): even at the exact 20×20 native size the
density rule requires (`NODE_SIZE`=40 display ÷ 2), the ring's overall shape
and hue stay clearly legible; only the rivet/bevel micro-detail is lost. The
takeaway for future chunks: the "illegible below 12px" finding is about
*ornamental* generated detail specifically, not generated art in general — a
strong silhouette (ring, blob, bar) can still ship small when the shape
itself, not its surface detail, carries the read. This chunk's socket ring is
therefore **fully generated + tinted**, with no code-drawn fallback needed
for the ring shape itself (unlike chunks 3/4's corners).

## Edge strip: groove detail also reduces, but the banding still reads as texture

The edge-strip sheet's rune ticks (bright ember-orange symbols along the top/
bottom rim of the bar) do **not** survive a full-height (80px→8px) downsample
— an early test crop of the whole bar cross-section reduced to a flat muddy
stripe with no discernible detail, effectively equivalent to a solid color
(see `art/source/ui/tree/edge-strip-sheet.png` for the source at full size).
Cropping a **narrower band around just the rune-tick row** (`(95,52,416,65)`,
13px tall instead of 80px) before downsampling to 48×8 native preserved a
visible alternating light/dark banding pattern that reads as a "carved groove
with ticks" texture once tinted and stretched along an edge — individual rune
glyphs are not legible, but the overall groove impression survives, which is
the actual visual goal (a felt sense of "worked metal channel", not readable
runes). `art/source/ui/tree/edge-strip-crop.png` is the pre-downsample crop.

## One texture per kind, tinted per state — not one texture per state

Both textures ship as a **single generated asset each**, reused across every
state via `Phaser.GameObjects.Image.setTint` (same "generate once, tint many"
pattern as chunk 3's spell-button frame armed/disabled states and chunk 4's
Frame hover/current outline) — not five socket variants or four edge
variants. Verified by eye in journey screenshots (see "Visual check" below)
that every tint stays distinguishable:

- **Socket ring** (`socketRingTint` in `ui/treeSockets.ts`): affordable =
  `PALETTE_NUM.gold` (warm bronze-gold), armed = `PALETTE_NUM.danger`
  (bright red-orange — a real migration of the pre-chunk-7 local `ARM_HEX`,
  same hex), owned = `PALETTE_NUM.health` (olive-green — the natural bronze
  base tints convincingly green), exclusive-locked = `EDGE_LOCKED` (dark
  blood-red, shared with the dead-branch edge color so a permanently-closed
  path reads the same whether you're looking at the node or the feeding
  edge), locked/unaffordable (default) = `PALETTE_NUM.borderDark` (multiplies
  the ring down to near-black, matching the old default near-black stroke).
- **Edge strip** (`edgeTint`): traversed = `EDGE_TRAVERSED` (bright
  cream-gold "lit path"), available = `EDGE_AVAILABLE` (bronze), locked =
  `EDGE_LOCKED` (dark red). `inactive` skips the texture entirely (see next
  section).

## `inactive` edges stay a plain thin line — texture-vs-noise judgment call

The mission brief explicitly allowed "your call" on texture vs. `lineBetween`
per state. `inactive` (unreached, 1px, alpha 0.45 — unchanged from
pre-chunk-7) is the one state that stayed a plain `Graphics.lineBetween`:
stretching the edge-strip texture down to 1px display height loses 100% of
its banding (it's shorter than even one native texture row), so it would
render as a flat dim color indistinguishable from just... drawing a flat dim
color, at the cost of an extra `Image` object per inactive edge (the tree has
many more `inactive` edges than any other state — most of the lattice is
unreached at any given time). `edgeUsesTexturedStrip()` in `ui/treeSockets.ts`
encodes this as one pure, tested boolean so the split is explicit rather than
an inline special case. `traversed`/`available`/`locked` all got a slightly
heavier display weight than their pre-chunk-7 flat-line equivalents (7/4/4px
vs. the old 4/2/2px) specifically so the groove texture has enough vertical
room to read at all — a deliberate visual change from "thin colored line" to
"visible metal channel", within the brief's "at least as readable as today"
bound (confirmed by the journey screenshots below: state contrast — weight,
color, and the locked X decoration — reads at least as clearly as the
pre-chunk-7 flat lines, arguably more so now that traversed/available/locked
also differ in apparent material, not just hue).

## Locked dead-branch X mark: unchanged behavior, redrawn in a final pass

The mission called out the locked-edge break+X as "real gameplay information,
don't lose it". The break (a visible gap between the two half-segments) and
the X glyph at the midpoint are pixel-identical to the pre-chunk-7 version —
same gap math, same X size, same `EDGE_LOCKED` color. What changed is *when*
it's drawn: the two half-segments are now separate `drawEdgeStrip` calls (so
they can carry the groove texture, with a `Graphics.lineBetween` fallback if
the texture didn't load), and every locked edge's X mark is collected and
drawn in **one final pass** (`drawLockedMarks`) after all strips/lines for
every state have been added to `nodesContainer`, instead of on the same
`Graphics` object as the segments immediately after drawing them. This
guarantees the X always renders on top of every strip `Image`, which a
same-object-immediately-after approach could not guarantee once the segments
became separate `Image` game objects interleaved with other edges' draw
calls (Phaser layers by container-child order, not per-shape logical
grouping). Confirmed visually in `journey-shots/18-tree-vigil-oath-armed.png`
(clear red X over the broken R→G edge) and
`journey-shots/24-tree-crown-owned.png` (multiple dead branches, all with a
clearly visible X).

## Why a new module instead of extending `ui/panels.ts`

`panels.ts`'s `Frame` is a resizable rectangular nine-slice (corner Images +
stretched rectangular edge Images + a fill Rectangle) built for panels/
buttons/banners that vary in width and height. A talent-tree socket is a
fixed-size **circle** with a small closed set of tint states, and an edge is
a **rotated line segment of arbitrary length between two arbitrary points** —
neither shape fits `Frame`'s corner+4-rectangular-edge composition without
either forcing a square bounding box around a circular texture (wasteful and
still wouldn't handle per-state tinting the way `Frame`'s hover/current
outline-overlay approach does, since a socket's whole ring re-tints, not just
an outline) or teaching `Frame` a wholly different layout algorithm for
diagonal edges it was never meant to draw. `ui/treeSockets.ts` is
purpose-built for exactly these two shapes and pulls in `PALETTE_NUM` from
the same shared theme module `panels.ts` uses, so it extends the phase's
color vocabulary without forking it.

## Colors migrated to `PALETTE_NUM`/`PALETTE`

Per the handoff's locked decision ("colors migrate to PALETTE_NUM where you
touch them, only where it doesn't change semantics"), every `TreeScene` local
hex constant that already had an exact `ui/theme.ts` equivalent now aliases
it instead of repeating the literal: `BG_COLOR`→`PALETTE_NUM.bg`,
`NODE_BG_LOCKED`→`PALETTE_NUM.panel`, `NODE_BG_AFFORDABLE`→
`PALETTE_NUM.panelLight`, `BORDER_COLOR`→`PALETTE_NUM.borderDark`,
`BUTTON_COLOR`→`PALETTE_NUM.panelLight`, `ACCENT_HEX`→`PALETTE_NUM.gold`,
`ARM_HEX`→`PALETTE_NUM.danger`, `TEXT_COLOR`→`PALETTE.text`,
`DIM_COLOR`→`PALETTE.dim`, `ACCENT_COLOR`→`PALETTE.gold`,
`OWNED_COLOR`/`OWNED_COLOR_HEX`→`PALETTE.health`/`PALETTE_NUM.health`,
`DANGER_COLOR`→`PALETTE.danger`. No rendered color changed — this is a
pure "single source of truth" refactor. `NODE_BG_OWNED` (`0x2a3a2a`, the
node fill for owned/complete spots) has no `PALETTE_NUM` match and stays a
local const, same reasoning as the four-state `EDGE_*` edge palette (moved
into `ui/treeSockets.ts` verbatim — same hex values, just relocated so the
socket/edge module owns the whole state→color story in one place; `TreeScene`
imports `EDGE_TRAVERSED`/`EDGE_LOCKED` where it still references them
directly).

**Gotcha hit and fixed**: `const DIM_COLOR = PALETTE.dim` (etc.) inferred the
*exact literal* type (`'#a89888'`) instead of widening to `string`, because
`PALETTE` is declared `as const` in `theme.ts` — unlike the old raw string
literals, which widened automatically on a bare `const` declaration. This
broke every later `glyphColor = TEXT_COLOR` / `= OWNED_COLOR` reassignment in
`renderSpotBox` with a type error (`Type '"#e8d8c8"' is not assignable to
type '"#a89888"'`). Fixed with explicit `: string` annotations on the five
affected consts (`TEXT_COLOR`, `DIM_COLOR`, `ACCENT_COLOR`, `OWNED_COLOR`,
`DANGER_COLOR`) — worth remembering for any future chunk that aliases a
`PALETTE.*` string into a local const that gets reassigned later.

## Pure helpers + vitest safety

`ui/treeSockets.ts` imports `Phaser` only for type annotations
(`Phaser.Scene`, `Phaser.GameObjects.Container`/`Image`) — never a real
`Phaser.*` value at module scope — so the colocated `treeSockets.test.ts`
(14 tests: `socketVisualState`, `socketRingTint`, `edgeTint`/
`edgeDisplayWeight`/`edgeAlpha`/`edgeUsesTexturedStrip`, `edgeGeometry`) runs
clean under vitest's default (non-jsdom) environment, same pattern as
`ui/battlefield.ts`/`ui/panels.ts`. `edgeGeometry` uses plain `Math.hypot`/
`Math.atan2`, not `Phaser.Math.*`, per the chunk-5 gotcha note.

## Files

- Kit (+ colocated test): `game/src/ui/treeSockets.ts`,
  `game/src/ui/treeSockets.test.ts`
- Source (frozen): `art/source/ui/tree/socket-ring-sheet.png` (raw 256×256
  generation), `art/source/ui/tree/socket-ring-crop.png` (pre-downsample
  isolated ring), `art/source/ui/tree/edge-strip-sheet.png` (raw 512×192
  kit-sheet generation), `art/source/ui/tree/edge-strip-crop.png`
  (pre-downsample rune-row crop)
- Runtime: `game/public/assets/ui/tree/socket-ring.png` (20×20),
  `game/public/assets/ui/tree/edge-strip.png` (48×8)
- Wiring: `game/src/scenes/BootScene.ts` (`treeUiTextures()` preload loop),
  `game/src/scenes/TreeScene.ts` (`renderSpotBox` socket ring,
  `renderEdges`/`drawEdgeLine`/`drawLockedSegments`/`drawLockedMarks` edge
  strips, `buildEdgeLegend` shares the same tint/weight helpers)

## Visual check

`npm run verify` → full gate green (typecheck, lint, test — 510 tests incl.
the 14 new `treeSockets.test.ts` cases —, build, smoke, journey — journey
clicks `treeNode:<spotId>` and `treeBack` by name across stages 17–25, the
real hit-area/name contract test per the mission). Journey screenshots with
every socket/edge state visible: `journey-shots/17-tree-graph-before-buy.png`
(locked near-black rings + thin gray inactive edges + one gold-ring
affordable root), `18-tree-vigil-oath-armed.png` (bright red-orange **armed**
ring + gold "lit path" traversed edge), `23-tree-lattice-vigil-branch.png`
and `24-tree-crown-owned.png` (green **owned** rings on completed nodes,
gold **affordable** rings with corner ticks, dark-red **exclusive-locked**
rings + broken/X dead-branch edges all visible simultaneously),
`25-tree-zealot-steady-hands-rebalance.png` (green owned rings, clean lattice
after a full respec). Nothing overlaps the bottom edge-state legend or the
build-glyph preview box in any shot.

## Budget

Start of chunk: **1407**. End of chunk: **1362** (45 spent — both jobs
accepted on the first try, no rerolls, well under the ~40–80 estimate, the
150 hard-stop, and the 800 floor).

## Proposed CLAUDE.md exception sentence (central agent to add)

Append to the temp-art exception bullet's asset-class list: "talent-tree
node sockets are a PixelLab-generated 20×20 bezel ring tinted per state
(`game/src/ui/treeSockets.ts`, `assets/ui/tree/socket-ring.png`) and edges
are a PixelLab-generated 48×8 groove strip stretched/rotated per edge and
tinted per `EdgeState` (`assets/ui/tree/edge-strip.png`), replacing the
plain circle/line draws in `TreeScene`."
