# Shared meta-scene panel/button/banner kit (bible item 4)

Status: current · Last verified: 2026-07-20

Pixel-art framed panel/button/banner kit for Hub, Tutorial, Loadout, Relic,
Settings, and the combat result overlay + wave banner
(`docs/ui-theme-research.md` §4 item 4; chunk 4 of `docs/ui-theme-handoff.md`).
Wiring: `game/src/ui/panels.ts` (new kit), `scenes/BootScene.ts` (preload),
`scenes/HubScene.ts`, `scenes/TutorialScene.ts`, `scenes/LoadoutScene.ts`,
`scenes/RelicScene.ts`, `scenes/SettingsScene.ts`,
`scenes/CombatScene.ts` (`showResultOverlay`/`showWaveBanner` + the
`buildHud()` banner construction that feeds it).

## Generation ledger (2 jobs, 80 generations spent — 1567 → 1487)

| Asset | Mode/size | Prompt gist | Job ID | Verdict |
|---|---|---|---|---|
| Panel frame | `create_ui_asset`, 512×512 | weathered riveted iron dark-fantasy panel frame, ornate corner brackets, ember-glow edge | `8b8eb016-f41e-4ad1-aca1-c17ae19bd6d0` | **REJECTED** — came back a 4-way "kit sheet" (same auto-scaffold behavior chunk 3 hit) in a cool purple/gold "treasure chest" palette that doesn't match soot/ember/iron; its corner art was also illegible mush once downsampled to nine-slice size (see below). Kept for the record at `art/source/ui/panels/panel-frame-sheet-rejected.png`, unused. |
| Button frame | `create_ui_asset`, 512×256 | weathered riveted iron dark-fantasy button frame, pronounced bolted corner rivets, thick beveled edges | `18f3f298-133d-4e22-a31a-1611f44f2bdd` | **ACCEPTED** — clean single rounded-rect frame, on-palette (warm iron/bronze, ember highlight line), no scattering. Its **edge band** is cropped/downsampled and reused for all three kinds (panel/button/banner — see "One shared frame kit" below); its corner art was cropped too but also illegible mush at nine-slice size, so corners are code-drawn instead (see below). |

Total spend 80 (vs. the brief's ~20–60 estimate) — the first job's cost was
effectively wasted on a rejected asset. Balance after chunk 4: **1487**,
comfortably above the 800 floor.

## Corner art: illegible below ~12px, same finding as chunk 3's tooltip corner

Both generated sheets' corner ornamentation (a 3D beveled bolt plate) reads
fine at full generation size but becomes an indistinct diagonal smudge once
cropped and LANCZOS-downsampled to any size small enough to tile as a
nine-slice corner (tried 6, 8, 10, 12 native px — all mush; see
`artifacts/pixellab-3/README.md`'s tooltip-corner precedent for the same
result at 8×8). The generated art in "ui-panel" mode is painterly/gradient
shaded rather than flat-color pixel art, so it doesn't survive a large
downsample the way character sprites do.

**Decision** (mirrors chunk 3's tooltip-corner.png exactly): corners are
**code-drawn**, not PixelLab crops — a small beveled "rivet plate" square
(exact `ui/theme.ts` PALETTE hexes: borderDark outer ring, borderLight
bevel, panelLight body, a 1–4px gold rivet dot) at two sizes (6×6 native /
'sm', 12×12 native / 'lg'), reused via `setFlipX`/`setFlipY` for all four
corners of every frame — one texture pair covers every panel/button/banner
on every surface this chunk touches.

## One shared frame kit, not three

The brief's per-kind budget ("one panel frame, one button frame set, one
banner") assumed three visually distinct kits. Given the panel-frame
generation was rejected (palette drift + corner mush) and a second panel
attempt would cost another ~40 generations for an asset with the same
corner-legibility problem as the accepted button sheet, the pragmatic call
was: **one edge texture (from the accepted button-frame sheet) + one
code-drawn corner, shared by `addPanel`/`addButton`/`addBanner` alike**,
differentiated only by **size** ('sm' 6px-native corner/edge for compact
rows — hub notices, meta buttons, dungeon rows, loadout slots/picker rows,
settings back, combat Return, banners; 'lg' 12px-native for tall content
panels — result overlay, relic cards, tutorial copy panel, hub stats block,
settings panel) and **state** (tint/outline, see below). This still reads as
one consistent "iron-and-ember" language across every surface (the chunk's
actual goal) without three separate generation risks.

## Manual nine-slice, not Phaser NineSlice

Same reasoning as chunk 3's tooltip panel ("Why the tooltip panel is NOT a
true Phaser NineSlice" — `NineSlice` is WebGL-only per its own doc comment,
and this project's `main.ts` uses `Phaser.AUTO`, which can silently fall
back to Canvas): `ui/panels.ts`'s `Frame` class composes 4 corner `Image`s +
4 edge `Image`s (stretched via `setDisplaySize`, not tiled — a small edge
crop stretched to length reads fine at this line thickness, avoiding any
seam-matching requirement a `TileSprite` would need) + a flat-color fill
`Rectangle`, all plain `Image`/`Rectangle`/`Container` — renderer-agnostic.

## Fallback: Frame always draws a complete look, not just "sometimes invisible"

Early draft had the frame's fill `Rectangle` drawn unconditionally, which
would have sat on top of a wrapped `hitRect` and hidden its stroke even when
textures failed to load (defeating the "flat-rect fallback" goal — the
`hitRect` would go dark with no border in that case). Fixed: `Frame.fill`
**always** carries a fallback stroke (`borderColor`/`borderWidth` options,
defaulting to the same `PALETTE_NUM.borderDark` / 2px every meta scene
already used) whenever chrome textures aren't loaded, and the wrapped
`hitRect`'s own fill/stroke are unconditionally hidden (not just when
framed) — `Frame` fully owns the drawn look either way, so there's exactly
one visual source of truth per surface instead of two rects that could
disagree.

## State API replaces direct `pointerover`/`pointerout` rect mutation

Several existing scenes drove hover feedback by calling `bg.setFillStyle(...)
.setStrokeStyle(...)` directly inside `pointerover`/`pointerout` handlers
(LoadoutScene picker rows, RelicScene cards). Since `Frame` now owns the
wrapped rect's visuals (see above), those handlers were rewritten to call
`frame.setState('hover' | 'normal')` instead — mutating the hidden rect
directly would have made it flash back to full opacity on hover, drawn on
top of the frame's own chrome. `Frame.setState('normal' | 'hover' |
'disabled' | 'current')` covers:

- **normal**: base fill color, no outline.
- **hover**: fill swaps to `PALETTE_NUM.panelLight` (one shade lighter,
  the same relationship every scene already used) + an accent-color outline
  overlay (default gold, overridable via `accentColor` — RelicScene passes
  each card's `relicGlyphColor(relic)` so the role-color hover accent
  survives; LoadoutScene/Hub don't override, so they get the same gold
  `ACCENT_BORDER` look their old `pointerover` handlers used).
- **disabled**: whole frame alpha dims (0.4 — a kit-local constant, distinct
  from `spellBar.ts`'s `BUTTON_DISABLED_ALPHA` 0.28, which is tuned for the
  always-visible spell bar). Not currently invoked by any chunk-4 call site
  (none of the wrapped buttons are ever disabled today) — implemented for
  kit completeness per the mission brief.
- **current**: same fill as normal + a **gold** outline overlay, always gold
  regardless of `accentColor` (`outlineColorForState` hard-codes it) — this
  is the pinned "Hub gold-stroke = CURRENT convention must survive
  visually" requirement. Used by Hub's current-dungeon row and by
  LoadoutScene's selected-slot highlight (previously its own separate
  `ACCENT_BORDER` stroke convention — now the same mechanism).

One accepted color-fidelity tradeoff: `fillColorForState('hover', ...)` is a
single fixed `PALETTE_NUM.panelLight`, not configurable per call site.
RelicScene's original hover fill was `CARD_BG_HOVER` (`0x4a3a2e`), very
close to but not identical to `panelLight` (`0x3a2a22`) — the kit trades
that exact per-scene shade for one consistent hover fill everywhere.

## Settings slider track stays unframed (too thin — same finding as chunk 3's micro-bars)

The brief names "slider track frame" as a SettingsScene target. The track is
10px tall; even the kit's smallest ('sm', 12px-display corner) nine-slice
piece would overflow a 10px-tall element top-to-bottom, and chunk 3 already
established the same "too thin for a border to read as anything but noise"
verdict for the GCD/boss-cast micro-bars (4–5px tall) — 10px is in the same
territory as those, not the 20px+ where chunk 3's cast-bar frame worked.
Rather than force a mismatched nine-slice or squash-reuse chunk 3's
already-shipped cast-bar frame texture at an unintended aspect ratio,
**SettingsScene got a `addPanel` background wrapping the whole
label/track/knob/pct-label content block**, and the track itself stays the
original flat `Rectangle` (unchanged). "Panel + back" of the brief's
three-part SettingsScene list is fully covered; "slider track frame" is
covered by the surrounding panel rather than the track itself.

## Journey / LoadoutScene coverage note

`scripts/journey.mjs` exercises `hubTree`/`hubDungeon:*`/`hubSettings`,
`relicCard:*`, `settingsVolumeSlider`/`settingsBack`, and `combatReturn` by
name — all touched by this chunk and covered by the full `npm run verify`
gate. It does **not** click `hubLoadout`/`loadoutSlot:*`/`loadoutPick:*`
(same gap chunk 3's ledger noted) — LoadoutScene's framed slots/picker
rows/back button are verified by typecheck + lint + a manual smoke
screenshot instead, not by journey.

## Files

- Kit (+ colocated test): `game/src/ui/panels.ts`, `game/src/ui/panels.test.ts`
- Source (frozen): `art/source/ui/panels/panel-frame-sheet-rejected.png`
  (unused, kept for the record), `art/source/ui/panels/frame-sheet.png`
  (accepted button-frame sheet), `art/source/ui/panels/frame-edge-crop.png`
  (pre-downsample edge crop)
- Runtime: `game/public/assets/ui/panels/frame-edge-{sm,lg}.png`,
  `game/public/assets/ui/panels/frame-corner-{sm,lg}.png` (code-drawn, not
  PixelLab — see above)
- Wiring: `game/src/scenes/BootScene.ts` (`panelKitTextures()` preload loop),
  `HubScene.ts` (title banner, stats panel, notices, Talent Tree/Spellbook/
  Settings buttons, dungeon rows incl. CURRENT), `TutorialScene.ts` (copy
  panel, learn button), `LoadoutScene.ts` (QWER slots incl. selected/current,
  picker rows incl. hover, back), `RelicScene.ts` (header banner, cards incl.
  role-color hover), `SettingsScene.ts` (settings panel, back — track stays
  unframed, see above), `CombatScene.ts` (wave banner, result panel, Return
  button — `showResultOverlay`/`showWaveBanner`/`buildHud()` only, per file
  ownership).

## Budget

Start of chunk: **1567**. End of chunk: **1487** (80 spent; 40 of that on
the rejected panel-frame sheet). Well under the 800 floor.
