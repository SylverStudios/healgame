---
name: pixellab-unit-art
description: >-
  Generate healgame combat unit sprites and attack animations via the PixelLab
  MCP (user-pixellab), or reprocess healer charge/cast strips from the prompt
  library when swapping a base still. Use when creating or iterating character
  art, idle/attack/cast animations, enemy/party placeholders, RetroDiffusion
  motion prompts with a base image, or replacing Kenney temp art.
---

# PixelLab unit art (healgame)

> **New units go through the successor skill:**
> [`pixellab-art-pipeline`](../pixellab-art-pipeline/SKILL.md) — archetype
> contracts (healer/ally/enemy/boss), canvas tiers, `npm run art` frame
> tooling, and `art/manifest.json`. This file remains the canon for the
> shipped healer charge/cast strips and the wiring contract.

Produce **art only** unless the user explicitly asks to wire sprites into code.
Ship exports under `artifacts/`; do not invent gameplay numbers or change
`game/src/` by default.

Tone bible: [`docs/GDD.md`](../../../docs/GDD.md) §4 — heavy-metal dark fantasy
(*The Last Spell* dread + mythic swagger). Grim, readable silhouettes. Not cute,
not meme, not pastel.

## Before you generate

1. Confirm MCP: `GetMcpTools` on `user-pixellab`, then `get_balance`.
2. Identify the unit from `game/src/data/mobs/` or party role (`tank`, `dps1`,
   `dps2`, `healer`).
3. Pick combat facing:
   - **Party** → east (faces right)
   - **Enemies** → west (faces left)
4. Default size: `32` character (`view: "side"`, `mode: "v3"`). Prefer tight
   32×32 readable figures (party + trash). Larger padded canvases (~88–92px
   from older `size=48` gens) are legacy — do not target them for new units.
   Bosses may use the same density on a larger canvas later.

## Prompt recipe

Write one dense appearance sentence. Include:

- role + dungeon vibe (ashen trash, starter merc, boss, …)
- silhouette / gear level (starter = simple leather; leave room for later armor)
- palette cues (soot, ember, iron, bone)
- anti-cues: `not cute, not cartoonish, readable side-view silhouette`
- metal tone: `grim last-stand dread`, `mythic metal album-cover menace`

**Good (shipped Ash Husk):**

> Ashen undead husk from a heavy-metal dark fantasy dungeon — burned-out
> humanoid shell of charcoal bone and cracked cinder flesh, hollow glowing
> ember eyes, tattered soot-black rags, ash drifting off shoulders, grim
> last-stand apocalyptic dread, readable silhouette for a side-view
> auto-battler trash enemy, not cute, not cartoonish

**Good (shipped starter tank):**

> Simple early-game mercenary tank — basic starter gear only: plain dark
> leather jerkin, small round wooden shield, short iron sword, no fancy plate
> yet, stocky solid silhouette, earnest grit, not over-armored so later armor
> layers can upgrade him

## Workflow — character

```
create_character(
  name, description,
  body_type="humanoid",
  mode="v3",
  size=32,
  view="side",
  outline="single color black outline",
  detail="medium detail"
)
→ poll get_character until status=completed
→ download combat-facing PNG + full zip
```

Download into:

```
artifacts/pixellab-<slug>/
  east.png | west.png | south.png | …   # rotations you need
  <slug>.zip                            # PixelLab download URL
```

Always keep the combat-facing still (`east` party / `west` enemy) as the
primary still the implementer will preload.

## Workflow — attack animation

Wait until character `status=completed`. Prefer **v3 custom** for weapon
strikes (templates are punches/kicks).

```
animate_character(
  character_id,
  mode="v3",
  animation_name="<unit>-attack",
  directions=["east"] | ["west"],   # match combat facing
  action_description="<motion only: thrusting short sword / claw swipe / …>",
  frame_count=6,                    # even, 4–16
  keep_first_frame=true,            # frame 0 ≈ rest pose
  custom_start_frame_url=...        # optional: lock start pose to base still
)
→ poll get_character until animation frames listed
→ download frames to artifacts/pixellab-<slug>/attack-<facing>/0.png …
```

Action description rules:

- Motion only — no locations, no camera, no story.
- Name the weapon/body part and the strike type.
- Keep it basic for starters (`simple strike windup and recover`).
- For healer charge/cast, prefer the pinned library prompts (below) over inventing
  new prose — identity comes from the **base still**, not the motion text.

Idle (optional): `template_animation_id="breathing-idle"`, one direction.
Template idles can drift from the static pose — re-roll or delete+retry if bad.

Cost control: call `get_balance` first. Never set `confirm_cost=true` on pro
anims until the user explicitly approves the quoted cost.

## Healer charge / cast — prompt library + reprocess

Canonical prompts, seeds, Solemn/Zealous Method B notes, and install steps:

→ [`healer-animation-prompts.md`](healer-animation-prompts.md)

For holdable charge/release philosophy poses, prefer **key pose +
`end_frame` interpolate** over text-only v3. Cost, facing, and scout-vs-lock
rules: [`../pixellab-art-pipeline/SKILL.md`](../pixellab-art-pipeline/SKILL.md)
§ “Cast / holdable-pose generation”.

When the user wants a **different base character** with the same kit:

1. Generate/approve a new 32×32 east still (base prompt in that file).
2. Re-run **charge** then **cast-action** with that still as the image input
   (PixelLab: `custom_start_frame_url` / character still; RetroDiffusion:
   `input_image` + `rd_advanced_animation__custom_action` — no MCP, manual).
3. Install PNG frames (not GIF) under `units/healer/`, rebuild sheet, retune
   exposure sheets if frame counts change.
4. Do not invent new motion prompts unless the user asks — reuse the library.

Prefer PNG sheets for shipping; GIFs only for eyeballing.

## Timing — Fire Emblem exposure sheets (required)

Equal-duration GIFs read floaty. Healgame playback uses **per-frame holds**
(an exposure sheet), inspired by GBA Fire Emblem battle anims:

https://lost-worlds.neocities.org/blog/2024/10/20/fire-emblem-animation/

Internalize these when authoring or reviewing strips (attack, charge, cast):

1. **Keys over spam.** A few clear key poses (idle → antic → contact → recover)
   beat many equally-timed in-betweens. Draw keys first; fill gaps second.
2. **Hold significance.** Important silhouettes stay on screen longer:
   anticipation / readied pose and **contact** (hit / spell release) get long
   holds; in-betweens and smears get short ones.
3. **Typical GBA FE holds (@60Hz intuition):**
   - smear / snap flash → **1–2 frames** (~16–33ms)
   - contact / impact pose → **8+ frames** (~133ms+), often longer
   - anticipation before a fast action → linger (build, then snap)
4. **Spacing = speed.** Wide pose-to-pose spacing + short holds = fast/light;
   close spacing + longer holds = heavy/weighty. Ease slow arcs; snap fast ones.
5. **Smears sparingly.** One readable smear into contact is enough; overusing
   them dilutes impact. Recovery usually needs **no** smear.
6. **Secondary motion last.** Cape / cloth / pauldrons trail the body — add
   after the primary arc reads.
7. **Never ship equal frame times** for combat strips. Wire durations in
   `game/src/ui/sprites.ts` (`MERC_ATTACK_FRAME_DURATIONS_MS`,
   `HEALER_CHARGE_FRAME_DURATIONS_MS`, `HEALER_CAST_FRAME_DURATIONS_MS`).

**Healer split:** charge is one looping strip (channel); cast-action is a
separate one-shot release (flash/contact). Do not mush them into one equal-timed
loop.

## Quality bar (eyeball before handing off)

- Readable at ~48–64px on-screen (32×32 native → typically 2× display).
- Matches metal tone; no soft/cute drift.
- Combat-facing silhouette clear; feet roughly grounded in the canvas.
- Attack / cast-action: clear windup → hit/release → recover; frame 0 usable
  as rest when present.
- Prefer a readable **contact silhouette** (held long in-game) and at least
  one stretchy **smear** candidate — playback uses the FE exposure sheets
  above, not equal frame times.
- If wrong: `delete_animation` / `delete_character` and regenerate — do not
  “fix” with code.

## Handoff to a wiring agent

When art is done, report:

1. Paths under `artifacts/pixellab-<slug>/`
2. Which file is the combat still
3. Attack folder + frame count + facing
4. PixelLab `character_id`
5. Suggested public install (if they will wire next):

```
game/public/assets/units/<slug>/
  <facing>.png
  attack-<facing>/0.png …
```

Point them at current render path: `docs/unit-art.md`, `game/src/ui/sprites.ts`,
`game/src/ui/unitSprite.ts` (today: Kenney 16×16 `Image`, `flipX` facing).
Custom PixelLab textures must **not** use Kenney frame indices; native-facing
sprites should **not** get `flipX`.

See [wiring.md](wiring.md) for the static-first / anim-second contract.

## Out of scope unless asked

- Editing `game/src/` or BootScene preload
- Armor layer systems, full party/boss replacement, Kenney removal
- Balance, save, journey coordinate edits
