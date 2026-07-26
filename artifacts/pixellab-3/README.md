# Spell-bar/HUD framing kit + spell/cooldown icons (bible item 3)

Status: current · Last verified: 2026-07-20

Pixel-art framing for the combat spell/cooldown buttons, hotkey keycaps, the
player cast bar, and the spell/cooldown tooltip panel, plus real 16×16 icons
for the 7 spells and 3 major cooldowns (`docs/ui-theme-research.md` §4 item 3;
chunk 3 of `docs/ui-theme-handoff.md`). Wiring: `game/src/ui/spellSprites.ts`
(registry), `ui/spellBar.ts`, `ui/bar.ts`, `ui/spellTooltip.ts`,
`scenes/BootScene.ts` (preload), `scenes/CombatScene.ts` (cast-bar frame
wiring only).

## Generation ledger (5 jobs, 90 generations spent — 1657 → 1567)

| Asset | Mode/size | Prompt gist | Job ID | Verdict |
|---|---|---|---|---|
| 10 spell/CD icons | `create_1_direction_object`, 64×64 (style-derived from relic icons) | dark-fantasy heavy-metal spell icon, single object, 10 `item_descriptions` (one per spell/CD — mace, gold rune, ember rune, candle, sunburst, holy sword, dark dagger, chalice+droplet, burning book, flaming crown) | `e72bb3b4-6c0c-4e92-92ea-ca0fb6910da7` | **ACCEPTED all 10** (indices 0–9; 6 extra generic candidates at 10–15 dismissed via `select_object_frames`) |
| Player cast-bar frame | `create_ui_asset`, 512×224, `elements:['toolbar']` | riveted iron toolbar frame with a recessed center channel | `fcb73e4b-52b3-49c2-9229-094e193c7970` | **ACCEPTED** — cropped/reassembled into a 160×10 native 3-piece frame (see below) |
| Spell-bar/HUD kit (button+icon_button+panel) | `create_ui_asset`, 512×512, `elements:['button','icon_button','panel']` | iron-and-ember HUD kit, three scaffolded pieces | `a62d4ef1-aca3-40c4-83e6-67c0b436baa9` | **ABANDONED — stuck** (see "Stuck multi-element job" below); **not charged** (balance unaffected) |
| Spell button frame (backup) | `create_ui_asset`, 384×208, no `elements` | iron-and-ember rectangular button frame, corner rivets | `8ffc75c8-7f66-4fc9-a97d-e17b85a67acf` | **ACCEPTED** — one piece of the returned kit-sheet cropped out (see below) |
| Keycap chip (backup) | `create_ui_asset`, 248×192, no `elements` | small beveled iron keycap chip | `3997ba27-0940-4645-b85b-d939bb78e636` | **ACCEPTED** — one piece of the returned kit-sheet cropped out |

Tooltip corner ornament is **code-drawn, not PixelLab** — see below.

## Stuck multi-element job (`a62d4ef1-...`)

The brief's suggested efficient path was one `create_ui_asset` call with
`elements: ['button', 'icon_button', 'panel']` to get three matched pieces in
one generation. That job sat at **"64% ~Ns processing"** for over 10 minutes
with the ETA climbing on every poll (172s → 602s) and the percentage never
moving — a stall, not a slow-but-progressing job. Per the phase timebox rule
("if a single asset isn't converging after ~2 rerolls, stop and report"), I
didn't keep polling indefinitely: I fired two plain single-panel backup calls
(no `elements`) for the button frame and keycap in parallel, which both
completed normally in ~60–90s. The stuck job was left alone (not deleted,
not re-polled) rather than spending time diagnosing the backend; `get_balance`
confirms it was never charged (90 spent this chunk exactly matches the sum of
the 5 completed jobs, none of which is the stuck one). **Takeaway for future
chunks: prefer plain `create_ui_asset` calls (no `elements`) — they returned
promptly; the `elements` scaffold path is unverified as reliable.**

## Every `create_ui_asset` call returned a scattered "kit sheet", not a single clean asset

None of the three `create_ui_asset` calls (cast-bar, button-backup,
keycap-backup) returned "one panel" as the tool's one-line description
implies. Each came back as a **sheet of several unrelated small UI pieces**
(rivet-topped circles, assorted bars, a rounded-rect plaque, small icon
chips) scattered across the requested canvas — i.e. auto-scaffolded
mockup sheets even without an explicit `elements`/`pieces` param. This
worked in our favor (more raw material per generation) but meant every
accepted asset here is a **hand-cropped single piece pulled out of a larger
sheet**, not the sheet itself:

- **Cast-bar frame**: the 512×224 sheet's single toolbar element was already
  a clean, isolated riveted bar — no cropping-from-scatter needed, just a
  tight bbox crop (`(39,83,473,145)`).
- **Button frame**: cropped the one rounded-rect-with-4-corner-rivets piece
  out of the 384×208 sheet (`art/source/ui/spellbar/button-frame-crop.png`,
  152×87 pre-downsample).
- **Keycap chip**: cropped one small bordered-square swatch out of the
  248×192 sheet (`keycap-crop.png`, 25×29 pre-downsample).

All three were then downsampled (LANCZOS) to their exact native art-grid
size — see "Density rule vs `create_ui_asset`'s 192px floor" below.

## Density rule vs `create_ui_asset`'s 192px floor

`create_ui_asset` enforces **width/height ≥ 192px** on both axes. Our native
UI-element sizes are far smaller — button 50×26, keycap 9×7, cast-bar
160×10 — so a native-resolution generation is not possible for any of these
(the same "generate big, author small" friction chunk 2 hit with
`create_map_object`/gate-arch, just from the opposite direction: there it was
forced-large *output*, here it's a forced-large *input floor*). Resolution:
generate at whatever size fits the floor, then crop the relevant piece and
LANCZOS-downsample it to the exact native pixel size before export — same
"compose then reduce" spirit as chunk 2's ember-haze fallback. This is a
deliberate deviation from the literal "author at half display size" density
instruction (there's no way to *author* at 50×26 through this tool), but the
**output** still obeys the 1-art-px=2-screen-px rule: every runtime PNG is
exactly half its display size and is shown via `setDisplaySize` with
`pixelArt: true` nearest-neighbor, so on-screen it reads identically to a
natively-authored asset.

## Icon batching worked exactly as the bible predicted

The bible's tip ("`create_1_direction_object` at size ≤42 can yield many
candidates cheaply") held, with a refinement: passing `style_images` (a few
64×64 relic icons + the 32×32 armored-paladin still) makes the tool derive
`size` from the **largest style image** (64, here) instead of accepting an
explicit `size` param — the two are mutually exclusive. At effective size 64
(≤85 bracket → 16-candidate batch), passing **10 `item_descriptions`**
produced one distinct, on-prompt icon per description in candidate slots
0–9 (plus 6 unrequested generic filler candidates in 10–15, dismissed). This
is a single 20-generation job producing all 10 icons at once, matched to
the relic-icon style family. Verified by eye (see
`preview_16to32.png`-equivalent check during the session): all 10 read
correctly at the actual 16→32px display size before acceptance.

## Tooltip corner ornament: code-drawn, not generated

Two PixelLab-derived candidates were tried for the tooltip's corner accent
(a rivet dot cropped from the button-frame sheet at 6×6 native; the
button-frame's own corner bevel cropped+downsampled to 8×8 native) — both
read as illegible mush at that size (no discernible shape, just a dark
blob). Rather than spend a fresh generation chasing a legible sub-10px motif
(low value for a purely decorative tooltip accent), this follows chunk 2's
ember-haze precedent: a **code-drawn** 8×8 asset (`tooltip-corner.png`, an
L-shaped bracket in `PALETTE_NUM.borderLight` with a `PALETTE_NUM.gold` tip
pixel) ships instead. Visually confirmed legible in the accepted combat
screenshot (small gold-tipped bracket at the tooltip's top-left corner).

## Why the tooltip panel is NOT a true Phaser NineSlice

The mission's suggested approach for the tooltip was a stretchable nine-slice
frame. Investigated `Phaser.GameObjects.NineSlice` (available, Phaser 3.90 —
corners render unscaled at native texture-pixel size, confirmed by reading
`node_modules/phaser/src/gameobjects/nineslice/NineSlice.js`) but its own
doc comment states plainly: **"As of Phaser 3.60 this Game Object is WebGL
only."** `main.ts` uses `type: Phaser.AUTO`, which silently falls back to
the Canvas renderer if WebGL context creation fails (headless CI sandboxes,
older/minimal Chromium builds, some `--use-gl` flag combinations) — and
`NineSliceRender` has no Canvas render path, so that fallback would either
throw or silently not render the tooltip's frame. Given this project's
explicit sensitivity to renderer/environment fragility (the chunk-1 ledger's
async-main journey-flake root-cause), I judged this not worth the risk for a
tooltip panel. **Decision**: the tooltip stays a plain bordered
`Phaser.GameObjects.Rectangle` (unchanged sizing/resize logic) with four
small fixed-size corner-ornament `Image`s (one texture, reused via
`flipX`/`flipY` for all four corners) pinned to its current bounds after
every `fillCard`/`fillLines` resize. This is renderer-agnostic (works
identically on Canvas and WebGL) and needed zero changes to the panel's
existing auto-sizing math.

The player cast-bar and spell/cooldown buttons sidestepped the same question
entirely: their sizes are **compile-time constants** (100×52, 320×20, 18×14
— never resized at runtime), so a single fixed-size `Image` at the exact
target size does the whole job with no stretching, no NineSlice, and no
renderer risk.

## Button/keycap architecture: frame Image + invisible hit-rect, not a texture swap

`SpellButton`/`CooldownButton` still create the original interactive
`Rectangle` (`bg`) for the `combatSpell:<id>` / `combatCooldown:<id>` hit
area, hover, and click handlers — **unchanged 100×52 hit box, unchanged
name**. When the frame texture loaded, `bg` goes fill/stroke-invisible
(`setFillStyle(color, 0)`, `setStrokeStyle(0)`) and a new `Image` using the
frame texture is added *before* it in the same visual stack; when the
texture is missing (e.g. a hypothetical future headless test env with no
assets loaded), `bg` keeps its original flat-rect look — full graceful
fallback, matching `runModsBar.ts`'s existing `scene.textures.exists(key)`
convention.

### Normal / armed / disabled — tint & overlay, not baked variants

Decision recorded per the brief's "your call": no second/third PixelLab
variant was generated for armed or disabled states.

- **Disabled** (no target / OOM / on personal cooldown): existing alpha-dim
  behavior (`BUTTON_DISABLED_ALPHA`), now applied to the frame `Image` too.
- **Armed** (synergy buff active on this spell/cooldown): the *same*
  `bg` rectangle's `setStrokeStyle` call that always drove this (gold vs.
  default border) is kept exactly as-is — its "default" width is just `0`
  now when a frame is loaded (frame art supplies the normal-state border), so
  only the gold armed accent shows through on top of the frame art.
- **OOM** (can't afford, spell buttons only): previously a flat bg-fill color
  swap. Since `bg`'s fill is now invisible when framed, this became a
  `frame.setTint(PALETTE_NUM.danger)` multiply-tint (cleared to `0xffffff`
  when affordable) — a genuine "tint, not variant" per the brief's own
  suggested option.

### Icon vs. glyph fallback

`glyphChar()` (`ui/glyph.ts`) is unchanged and untouched. Both
`SpellButton`/`CooldownButton` still always create the glyph `Text` first;
a real icon `Image` is added on top only when
`scene.textures.exists(spellIconTextureKey(id))` /
`cooldownIconTextureKey(id)` is true, and only then is the glyph hidden
(`setVisible(false)`, not destroyed). Any spell/cooldown id absent from
`SPELL_ICON_IDS`/`COOLDOWN_ICON_IDS` in `spellSprites.ts` (e.g. a
future spell shipped without art) automatically keeps the original glyph
look with zero code changes — `spellSprites.test.ts` pins the id lists
against the live `SPELLS`/`COOLDOWNS` catalogs so this can't silently drift.

## Micro-bars: left unframed (judgment call, as the brief allowed)

- **GCD sliver** (320×4) and **boss cast sliver** (70×5): too thin for any
  border to read as anything but noise at that height — left exactly as
  before (flat rect, no `frameTextureKey` passed to their `Bar`s).
- **Unit HP/mana bars** (`unitSprite.ts`, 8px/6px tall): same call, untouched
  — `unitSprite.ts` wasn't touched at all this chunk.
- **Player cast bar** (320×20): framed — tall enough for a riveted-end frame
  to read clearly (confirmed in a manual mid-cast screenshot, see Files).

## `Bar` additive API

`ui/bar.ts` gained one new optional constructor parameter,
`frameTextureKey?: string`, after the existing `bgColor` parameter — every
existing call site (`unitSprite.ts` HP/mana bars, `CombatScene`'s GCD bar and
boss cast sliver) compiles unchanged and passes nothing for it. When
provided *and* the texture is loaded, a centered `Image` is added, sized via
`setDisplaySize(width, height)` to exactly match the `Bar`'s own
width/height (the frame texture must be authored at half that size — see
`CAST_BAR_FRAME_NATIVE_SIZE` in `spellSprites.ts`); `setPosition` /
`setDepth` (+1, so the frame draws above the fill) / `setVisible` / `destroy`
all propagate to it. Only `CombatScene.buildCastBars()`'s `playerCastBar`
passes a `frameTextureKey` this chunk.

## LoadoutScene

**Not touched.** It builds its own QWER slot rects and reuses `glyphChar()`
directly for its picker icons — it does not import or reuse any piece of
`SpellButton`/`CooldownButton`/`SpellBar`, so nothing in this chunk could
have broken it (confirmed: `npx tsc --noEmit` clean, full `npm run verify`
green, and `LoadoutScene.ts` has zero diff).

## Files

- Registry (+ colocated test): `game/src/ui/spellSprites.ts`,
  `game/src/ui/spellSprites.test.ts`
- Source (frozen):
  - `art/source/ui/spell-icons/{bonk,solemn-mend,zealous-mending,solemn-vigil,zealous-flare,vowstrike-virtue,vowstrike-vengeance,cd-still-waters,cd-frenzied-liturgy,cd-wrath-ascendant}.png`
    (64×64, pre-downsample PixelLab accepts)
  - `art/source/ui/spellbar/{button-frame-sheet,keycap-sheet,cast-bar-sheet}.png`
    (full generated sheets) + `{button-frame-crop,keycap-crop,cast-bar-crop}.png`
    (the single piece cropped from each sheet, pre-downsample) +
    `tooltip-corner-drawn.png` (code-drawn, native size already)
- Runtime: `game/public/assets/ui/spell-icons/*.png` (16×16, 10 files),
  `game/public/assets/ui/frame/{button-frame.png (50×26), keycap-frame.png (9×7),
  cast-bar-frame.png (160×10), tooltip-corner.png (8×8)}`
- Wiring: `game/src/ui/spellBar.ts` (frame/keycap/icon integration on both
  `SpellButton` and `CooldownButton`), `game/src/ui/bar.ts` (additive frame
  param), `game/src/ui/spellTooltip.ts` (corner ornaments), `game/src/scenes/BootScene.ts`
  (`spellBarTextures()` preload loop), `game/src/scenes/CombatScene.ts`
  (`CAST_BAR_FRAME_TEXTURE_KEY` passed to `playerCastBar` only)

## Visual check

`npm run verify` → full gate green (typecheck, lint, test, build, smoke,
journey — journey exercises every `combatSpell:<id>`/`combatCooldown:<id>`
hit target by name, so this is the real proof the 100×52/CD-button hit-area
contract held). Journey screenshots with the framed bar + real icons + gold
armed accent + tooltip corner ornament all visible:
`game/journey-shots/03-combat-healer-cast-pose.png`,
`26-combat-pace-15x.png`, `30-combat-feedback-midfight.png`. The cast-bar
frame doesn't happen to land visible-and-unobscured in any journey shot (the
journey's screenshot moments didn't line up with an in-progress cast); a
one-off manual Playwright check (script not committed) confirmed it renders
correctly mid-cast — riveted end caps flanking the gold fill, transparent
center window showing the `Bar` fill through cleanly.

## Budget

Start of chunk: **1657**. End of chunk: **1567** (90 spent — well under the
~80–150 estimate and the 800 floor). `get_balance` re-checked after the
stuck job to confirm it wasn't silently charged.
