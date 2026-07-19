---
name: pixellab-unit-art
description: >-
  Generate healgame combat unit sprites and attack animations via the PixelLab
  MCP (user-pixellab). Use when creating or iterating character art, idle/attack
  animations, enemy/party placeholders, or when the user mentions PixelLab,
  unit sprites, sprite sheets, or replacing Kenney temp art.
---

# PixelLab unit art (healgame)

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
4. Default size: `48` character (`view: "side"`, `mode: "v3"`). Canvas comes
   back larger (~88–92px) with padding — that is expected.

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
  size=48,
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
  keep_first_frame=true             # frame 0 ≈ rest pose
)
→ poll get_character until animation frames listed
→ download frames to artifacts/pixellab-<slug>/attack-<facing>/0.png …
```

Action description rules:

- Motion only — no locations, no camera, no story.
- Name the weapon/body part and the strike type.
- Keep it basic for starters (`simple strike windup and recover`).

Idle (optional): `template_animation_id="breathing-idle"`, one direction.
Template idles can drift from the static pose — re-roll or delete+retry if bad.

Cost control: call `get_balance` first. Never set `confirm_cost=true` on pro
anims until the user explicitly approves the quoted cost.

## Quality bar (eyeball before handing off)

- Readable at ~48–64px on-screen (trash 48, party 64).
- Matches metal tone; no soft/cute drift.
- Combat-facing silhouette clear; feet roughly grounded in the canvas.
- Attack: clear windup → hit → recover; frame 0 usable as rest.
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
