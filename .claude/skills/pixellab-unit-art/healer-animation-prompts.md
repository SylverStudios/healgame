# Healer animation prompt library

Status: current · Authority: regenerate armored-paladin / alternate healer strips · Last verified: 2026-07-19

Reusable prompts that produced the shipped 32×32 healer charge + cast-action
strips. Swap the **base still**, re-run these motion prompts, install the new
frames — keep FE exposure timing in `game/src/ui/sprites.ts`.

Ship PNGs (sprite sheets or frame folders). GIFs are preview-only.

Combat facing for the live healer is **south** (see `art/manifest.json`). Older
`charge-east` / `cast-east` paths are legacy naming; new Solemn/Zealous work
targets south.

## Cast-style generation (Solemn / Zealous) — prefer Method B

Explored 2026-07-19 under `artifacts/pixellab-healer-cast-styles/`. **Shipped
Method B south** into `game/public/assets/units/healer/`
(`charge-*-south/`, `cast-*-south/`) — Solemn for `solemn-*` +
`vowstrike-virtue`, Zealous for `zealous-*` + `vowstrike-vengeance`. Charge
loops while channeling; cancel snaps to idle. Zealous release south is
acceptable for now; a more expressive re-roll is backlog. Full cost/facing
rules: [`../pixellab-art-pipeline/SKILL.md`](../pixellab-art-pipeline/SKILL.md)
§ “Cast / holdable-pose generation”.

Short form:

- **Do not** ship philosophy charge/release from text-only v3 (Method A) —
  climax drifts.
- **Do** author climax keys with `create_character_state` (~20–40 gens each —
  only after pose approval), then interpolate with
  `custom_start_frame_url` + `end_frame_url` (1 gen / strip).
- South-readable Zealous: avoid “arms behind body” (occluded); use lean,
  fists cocked high/beside shoulders, cape flare, forward thrust toward camera.
- Review gallery: `open artifacts/pixellab-healer-cast-styles/review-all.html`

| Style | Charge climax (hold) | Release climax |
|---|---|---|
| Solemn | Hands clasped at chest, head bowed, compressed/statuesque, soft chest glow | Head up, arms open wide, chest open — receiving/flowing out |
| Zealous | Forward lean, coiled ready (south-readable), pressure building | Preferred: lunge + both arms thrust toward camera (projection). Overhead alt explored, not preferred |

PixelLab state ids from that exploration (base
`7ff83bfc-d23f-4270-8970-fa1b593e1384`):

| Key | character_id |
|---|---|
| Solemn charge | `f3248a61-c0d3-492a-8a47-5b6ab78389ab` |
| Zealous charge v1 | `50a72e86-e402-4de3-a4b9-085849718ff0` |
| Solemn release | `b95130c6-ae99-42c8-9d70-da992dde2a86` |
| Zealous release | `be0ee6fb-b5c0-40e2-8cc8-22fbe82fafde` |

## Pipeline map

| Role in game | Strip | Generator used | Notes |
|---|---|---|---|
| Idle still | `south.png` (+ `east.png` compat) | Base image create | South combat facing |
| Charge (loop while channeling) | `charge-east/` (legacy) → prefer south Method B | Key pose + interpolate | Must loop / hold cleanly |
| Cast-action (one-shot release) | `cast-east/` (legacy) → prefer south Method B | Charge-key → release-key | Clear contact + recover |

**Always pass the base character image** into the animation step (identity lock).
Do not re-describe the full outfit in motion prompts — describe **motion + VFX
only**, and let the base image carry silhouette / palette.

### PixelLab MCP (preferred when available)

```
# Method B (preferred for Solemn/Zealous charge+release):
create_character_state(...)          # climax key — expensive; approve pose first
→ animate_character(
    character_id,                    # base healer id
    mode="v3",
    directions=["south"],
    animation_name="healer-<strip>",
    action_description="<short motion arc>",
    frame_count=6|8,
    keep_first_frame=true,
    custom_start_frame_url=<idle or charge-key URL>,
    end_frame_url=<charge-key or release-key URL>
  )

# Method A (cheap scout / simple glow only — not for philosophy climaxes):
animate_character(..., custom_start_frame_url=<idle>, action_description=...)
```

`action_description` should stay motion-focused (PixelLab guidance). Our shipped
prompts are slightly prose-heavy but worked — when re-rolling, prefer the
**tight** variants below if the model drifts.

### RetroDiffusion (no MCP in this repo)

Manual / scripted `POST https://api.retrodiffusion.ai/v1/inferences`:

```json
{
  "prompt": "<motion prompt>",
  "width": 32,
  "height": 32,
  "num_images": 1,
  "seed": <pinned seed if replaying>,
  "prompt_style": "rd_advanced_animation__custom_action",
  "tile_x": false,
  "tile_y": false,
  "input_image": "<base64 of 32×32 base still>",
  "remove_bg": false
}
```

Keep seeds in the table below when you want a near-replay; change seed to explore.

---

## Base still

**Shipped intent:** armored paladin healer, 32×32, FE Sacred Stones inspired.

```
A simple armored, male, paladin healer. Not overly well armored, nor ragged,
mild holy aesthetic. The input image is a reference for character size, don't
match the cloak and posture.
```

Notes:

- Native **32×32**, readable at 2× in combat
- Party facing: three-quarter / toward the right (east)
- Mild holy, not full plate, not ragged robes — leave room for later armor tiers
- After approval, freeze as `art/source/armored-paladin/east.png` and the runtime
  copy under `game/public/assets/units/healer/east.png`

---

## Charge (loop)

**Game use:** `setCasting(true)` while `castMs > 0`. Must loop without a hard
pop. Emphasize palm glow pulse + light bob; head steady.

### Shipped / preferred (PixelLab text)

```
The armored figure stands firmly in place, gently bobbing as he channels
energy. His hands, held at his sides, begin to pulse with a soft, rhythmic
glow that flickers and intensifies in brightness. As the arcane power builds,
his arms sway slightly in a circular, flowing motion, with the glowing light
trailing momentarily before resetting. His red cape shifts subtly with his
breathing, and his head remains steady, focused forward as the magical aura
around his palms continuously expands and contracts in a rhythmic, repeating
loop.
```

### Alt (side-to-side sway)

```
The armored figure stands firmly in place, gently bobbing as he channels
energy. His hands, held at his sides, begin to pulse with a soft, rhythmic
glow that intensifies in brightness. As the arcane power builds, his arms sway
slightly in a side-to-side motion, with the glowing light trailing momentarily
before resetting. His red cape shifts subtly with his breathing, and his head
remains steady, focused forward as the magical aura around his palms
continuously expands and contracts in a rhythmic, repeating loop.
```

### RetroDiffusion variant (seed `1966050004`)

```
An armored figure stands rooted, head steady and gaze unwavering, as rhythmic
pulses of radiant energy bloom from his palms, expanding and contracting in
seamless loops, arms drifting in slow, circular arcs that leave trailing
glows, his red cape fluttering with each breath, the ambient magic shimmering
around him like a living halo, synchronized with his steady, meditative stance.
```

**Install:** extract loopable glow frames (skip pure idle / skip release poses)
→ `charge-east/0…n.png`, rebuild `sheet.png`, retune
`HEALER_CHARGE_FRAME_DURATIONS_MS` (dwell on peak glow).

---

## Cast-action (one-shot release)

**Game use:** `playCastRelease` / `finishCast` — orb gather → flash → exertion
slump → recover to ready. Not a loop. FE timing: short flash, long contact hold.

### Shipped / preferred (PixelLab text — snappy hands)

```
The paladin stands firmly, his hands held at his sides as a brilliant, pulsing
light begins to intensify within his palms. He raises his hands above his
shoulders in a steady, deliberate arc toward the sky, channeling the energy
upward until a concentrated burst of power erupts from his hands and surges
above his head. His hands move upward quickly in 1 frame, and slowly return to
where they started. As the light dissipates, the paladin’s body visibly slumps
backward from the strain of the exertion, his shoulders dropping and his
posture loosening. Finally, he recovers his balance, drawing his hands back
down to his sides and resetting his stance to a composed, ready position.
```

### Alt (no explicit 1-frame snap)

```
The paladin stands firmly, his hands held at his sides as a brilliant, pulsing
light begins to intensify within his palms. He raises his hands in a steady,
deliberate arc toward the sky, channeling the energy upward until a
concentrated burst of power erupts from his hands and surges above his head.
As the light dissipates, the paladin’s body visibly slumps backward from the
strain of the exertion, his shoulders dropping and his posture loosening.
Finally, he recovers his balance, drawing his hands back down to his sides and
resetting his stance to a composed, ready position.
```

### RetroDiffusion variant (seed `356179213`)

Same prose as the Alt above (no 1-frame clause), with
`prompt_style: rd_advanced_animation__custom_action`, 32×32, `input_image` =
base still.

**Install:** drop idle duplicate if present → `cast-east/0…n.png`, rebuild
sheet, retune `HEALER_CAST_FRAME_DURATIONS_MS` (flash ≤ ~33ms, contact ≥ ~133ms).

---

## Reprocess checklist (new base character)

1. Approve new 32×32 idle still (east). Save under
   `art/source/<slug>/east.png` + `game/public/assets/units/healer/east.png`
   (or a new slug if replacing the role art path).
2. Run **charge** prompt with base as input → pick best loop → `charge-east/`.
3. Run **cast-action** prompt with same base → pick best release → `cast-east/`.
4. Rebuild combined `sheet.png`: `[idle][charge…][cast…]`.
5. Update frame index constants + exposure sheets in `ui/sprites.ts` if counts
   changed; keep FE hold rules (see SKILL.md Timing section).
6. Eyeball in combat: channel shows charge; heal land shows flash; queued spell
   must not clip the release (UnitSprite defers charge until release ends).
7. `npm run verify:fast` from `game/`.

## Prompt authoring rules (for new strips)

- Lock identity via **base image**, not by re-listing armor in every prompt
- Motion prompts: verbs, arcs, VFX, recovery — avoid camera / location / story
- Charge = seamless loop; cast-action = clear contact + recover to ready
- Prefer PNG sheets; GIF only for human review
- After generate: apply FE exposure sheet in code — never trust equal GIF delays
