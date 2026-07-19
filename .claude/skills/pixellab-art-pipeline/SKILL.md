---
name: pixellab-art-pipeline
description: >-
  End-to-end pipeline for generating healgame combat-unit art at the 32×32
  FE-GBA density via the PixelLab MCP: archetype animation contracts (healer /
  ally / enemy / boss), pinned prompt recipes, deterministic frame tooling
  (`npm run art`), and the unit manifest. Use when creating or regenerating
  any ally, enemy, or boss sprite or animation, replacing legacy padded
  PixelLab mercs or Kenney tiles, or auditing art consistency.
---

# PixelLab art pipeline (healgame)

Produces **art only** — exports land in `artifacts/` and (after approval)
`art/source/` + `game/public/assets/units/`. Wiring into Phaser is a separate
step (see Handoff). Do not invent gameplay numbers.

Authority chain:

1. [`art/STYLE.md`](../../../art/STYLE.md) — density law, canvas tiers,
   palette, timing. Read it before generating anything.
2. [`art/manifest.json`](../../../art/manifest.json) — unit registry: sizes,
   facings, PixelLab character ids, strip contracts. Update it whenever art
   ships or a character id is minted.
3. [`prompt-library.md`](prompt-library.md) — pinned prompt recipes per
   archetype. Reuse before inventing; add newly-approved prompts back.
4. Healer charge/cast canon:
   [`../pixellab-unit-art/healer-animation-prompts.md`](../pixellab-unit-art/healer-animation-prompts.md).

## Animation contracts (what each archetype needs)

| Archetype | Native | Facing | Required strips | Optional |
|---|---|---|---|---|
| **healer** | 32 | east | idle still · idle loop (4f) · charge loop (5f) · cast one-shot (7f) · attack zap one-shot (6f) | per-spell releases (reuse cast strip + distinct target VFX first; new strips only if a spell needs its own read) |
| **ally** (tank/dps) | 32 | east | idle still · attack one-shot (6f gen) · hurt (4f gen) | idle loop |
| **enemy** (trash) | 32 (elite 40) | west | idle still · attack one-shot (6f gen) · hurt (4f gen) | idle loop |
| **boss** | 48 (colossal 64) | west | idle **loop** (6–8f, menace) · attack one-shot (6f) · special windup loop + special release one-shot (from its `abilityIds`) · hurt (4f) | death |

Notes:

- Frame counts are generated-frame targets (`frame_count`, even, 4–16);
  `keep_first_frame=true` adds the rest pose as frame 0.
- Boss specials reuse the proven healer **two-strip split**: windup loops
  while the ability telegraphs, release plays once when it fires. Derive the
  motion from the ability's data in `game/src/data/` (emberfall, bonehowl,
  soul-toll, needle-gaze, extinction, tunnel-vision — see prompt library).
- Healer zap ("bonk"): magic release read — hand flick + spark, **no
  traveling projectile**; the impact VFX lands on the target like `heal-vfx`
  does (FE-style: caster anim + target flash carry the hit).

## Pipeline (per unit)

**0. Prep.** `get_balance` (v3 char = 2–9 gens, v3 anim = 1 gen/direction;
never set `confirm_cost=true` on pro without the user approving the quote).
Look the unit up in `manifest.json` (or add a planned entry) for size/facing.

**1. Base still.**

```
create_character(name=<slug>, description=<prompt-library recipe>,
  body_type="humanoid", mode="v3", size=<tier native>, view="side",
  outline="single color black outline", detail="medium detail")
→ poll get_character → download the combat-facing rotation
  (east = party, west = enemy) into artifacts/pixellab-<slug>/
```

v3 canvases are ~40% larger than `size` — normalize before judging:

```
npm run art -- crop --size <native> --out artifacts/pixellab-<slug>/tight artifacts/pixellab-<slug>/<facing>.png
npm run art -- validate --size <native> artifacts/pixellab-<slug>/tight
```

**2. Review gate (human).** Show the tight still (and a 4× preview if asked).
The user approves the base **before any animation spend** — stills are cheap,
strips multiply. On approval:

- freeze source: `art/source/<slug>/<facing>.png`
- record `pixellabCharacterId` + still in `manifest.json`

Wrong? `delete_character`, adjust prompt per STYLE.md, re-roll. Never fix a
bad base with animation.

**3. Animate.** One strip at a time, against the character:

```
animate_character(character_id, mode="v3", directions=[<facing>],
  animation_name="<slug>-<strip>", action_description=<library motion prompt>,
  frame_count=<contract>, keep_first_frame=true,
  custom_start_frame_base64=<approved UNCROPPED rotation frame>)
```

- Identity comes from the start frame + character, **not** the motion text —
  motion prompts describe verbs, arcs, VFX, recovery only.
- At ≤64px, inline base64 start frames are small and safe; use
  `custom_start_frame_url` for anything larger.
- Pass the **uncropped** canvas as start frame; crop the whole strip
  afterward in one batch so every frame shares the same window:

```
npm run art -- crop --size <native> --out artifacts/pixellab-<slug>/<strip>-<facing> <downloaded frames...>
```

(`crop` uses the union bbox across all inputs, bottom-center anchored — if
the motion overflows the tier size it errors; prefer tightening the motion
prompt over jumping a tier.)

**4. Review gate (human), with real timing.** Equal-time GIFs read floaty —
preview with the exposure sheet you intend to ship:

```
npm run art -- preview --scale 4 --durations 150,33,33,183,50,67 --out artifacts/pixellab-<slug>/<strip>.html artifacts/pixellab-<slug>/<strip>-<facing>
```

Judge against STYLE.md timing rules (hold antic/contact, flash smears, loops
breathe). Bad strip → `delete_animation`, re-roll v3 (1 gen — cheap).

**5. Install.** Frames → `game/public/assets/units/<slug>/` (frame dirs
and/or `sheet` via `npm run art -- sheet`). Update `manifest.json` strips +
status, then:

```
npm run art -- audit
```

**6. Handoff to wiring.** Report artifact paths, combat still, strip
folders + frame counts, character id, suggested exposure sheet (ms per
frame). Wiring contract: [`../pixellab-unit-art/wiring.md`](../pixellab-unit-art/wiring.md)
+ `docs/unit-art.md`. New strips need duration constants in
`game/src/ui/sprites.ts` — never equal times.

## Determinism rules

- **The manifest is memory.** Character ids, sizes, facings, strip contracts
  live in `manifest.json` — a fresh agent must be able to regenerate any unit
  from manifest + prompt library + frozen source stills alone.
- **Frozen stills are identity.** `create_character`/`animate_character`
  have no seed param; determinism comes from re-feeding the approved still
  (`custom_start_frame_*`, or `create_character` v3 `reference_image_base64`
  to rebuild a full character from a still). Never regenerate a shipped
  unit's base from text alone.
- **Variants of an existing unit** (armor tiers, wounded, empowered): use
  `create_character_state(character_id, edit_description,
  use_color_palette_from_reference=true)` — it preserves the same individual.
  Only new units go through `create_character`.
- **Key poses on demand:** v3 `end_frame_base64` interpolates toward a target
  pose — author/select the contact silhouette once, then generate the
  in-betweens toward it, instead of re-rolling and hoping.
- **Scripts over eyeballs** for everything mechanical: `validate` (dims,
  color count), `crop` (density/anchor), `sheet`, `diff` (pixel-compare two
  PNGs), `audit` (whole manifest). Eyeballs are only for style and motion.

## Quality bar (before handoff)

- Passes `validate --size <native>`: exact tier canvas, transparent bg.
- Reads at 2× on `#1a1210`; silhouette + accent color match STYLE.md; no
  cute/soft drift; feet grounded (crop anchors them).
- Strips: clear windup → contact/release → recover; frame 0 usable as rest;
  at least one held contact silhouette and at most one smear.
- Loops (idle, charge, boss windup) cycle without a pop.

## Out of scope unless asked

Editing `game/src/` or BootScene, balance/save/journey changes, tilesets,
UI panels, fonts. Cost escalation to pro mode without an explicit quote+OK.
