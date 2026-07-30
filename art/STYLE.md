# healgame art style bible

Status: current · Authority: unit art style — density, canvas tiers, palette, timing · Last verified: 2026-07-30

Single source of truth for how every combat sprite must look. Generation
workflow lives in `.claude/skills/pixellab-art-pipeline/SKILL.md`; the unit
registry is [`art/manifest.json`](manifest.json). If a generated sprite
violates this file, regenerate it — do not ship and patch later.

## Reference

**Fire Emblem: The Sacred Stones (GBA) battle sprites.** Chunky, readable
figures; strong silhouettes; a few held key poses over many in-betweens.
Tone: heavy-metal dark fantasy (`docs/GDD.md` §4) — grim last-stand dread,
mythic metal album-cover menace. Not cute, not cartoonish, not pastel.

### Density exemplar (pin this)

The **armored-paladin healer** is the ideal pixel density for its canvas
size. Judge every new unit, VFX, relic icon, and prop by placing it beside
the healer on screen — if it looks finer- or coarser-grained, reject it.

| | Path |
|---|---|
| Source still | `art/source/armored-paladin/east.png` (also `south.png`) |
| Live combat | `game/public/assets/units/healer/` (native **32×32**, display **64**) |
| Style law | this file · skills must restate the exemplar, not invent a new one |

Everything we author aims at **that same grain**. Size differences come from
**bigger canvases at the same density**, never from finer pixels.

## Density rule (the one law)

> **One art pixel = 2 screen pixels. Always.**

Sprites are authored at native size and displayed at exactly 2× with
nearest-neighbor (`pixelArt: true`). A 64×64 boss has the same chunky
pixel grid as the 32×32 healer — just more of it.

Legacy PixelLab trash (~88px padded canvases displayed undersized) and old
padded mercs (~92px → 112) violate this rule and are queued for regeneration;
do not author anything new at that density.

## Canvas tiers

| Tier | Native | Display (2×) | Used for |
|---|---|---|---|
| party / trash | **32×32** | 64 | healer, tank, dps1, dps2, all trash mobs |
| elite | **40×40** | 80 | named non-boss threats (e.g. Spire Lancer) |
| boss | **48×48** | 96 | dungeon bosses (Gate Warden, Dirge Sovereign, Thorn Matriarch) |
| colossal | **64×64** | 128 | finale-scale bosses (Ember Colossus, Hollow King) |

Canvases are **tight**: the figure fills the canvas, feet within ~2px of the
bottom edge (bottom-center anchored — `npm run art -- crop` enforces this).
No padded dead space; padding is what broke the legacy mercs.

## Facing

- **Party** faces **east** (right). **Enemies** face **west** (left).
- Facing is authored into the pixels — three-quarter view toward the enemy.
  Custom textures never use `flipX`.

## Line, light, palette

- **Outline**: single-color black outline, unbroken around the silhouette.
- **Shading**: basic — one light source, upper-left; 2–3 ramp steps per
  material. No anti-aliasing against transparency, no soft gradients.
- **Palette**: soot / ember / iron / bone families on the dark `#1a1210`
  battlefield. Aim ≤ ~24 colors per sprite (`npm run art -- validate` reports
  the count). One saturated accent per unit max (healer cape red, ember glow
  orange, husk eye ember) so the accent reads as identity.
- **Faction tint**: party leans warm iron + one heraldic accent; trash leans
  desaturated soot/ash; bosses may burn hotter (ember, bone-white) but stay
  inside the same families.

## Silhouette & readability

- Must read at rest **and** in every animation frame at 2× on the dark bg.
- Weapon or key prop visible in the idle silhouette.
- Starter/trash units stay simple (leave visual room for later armor tiers —
  upgrades via PixelLab `create_character_state`, same individual).

## Animation timing (never equal frame times)

Playback uses **FE exposure sheets** — per-frame holds wired in
`game/src/ui/sprites.ts`, never equal GIF timing. Model:
<https://lost-worlds.neocities.org/blog/2024/10/20/fire-emblem-animation/>

- Anticipation and **contact** silhouettes hold long (~133ms+).
- Smears / snap flashes flash short (~16–33ms).
- Loops (idle, charge, boss menace) breathe — dwell on the peak pose.
- Two-strip rule for channeled powers: **charge loop** (while channeling) +
  **cast-action one-shot** (release). Proven by the healer; bosses reuse it
  for specials.

## Never

- Mixed densities on one screen (the current legacy-merc situation — being
  retired, not extended)
- flipX on authored-facing art
- Anti-aliased edges, painterly rendering, AI mush, drop shadows
- Equal frame durations on combat strips
- Cute, chibi, pastel, meme
