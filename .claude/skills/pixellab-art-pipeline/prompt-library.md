# Prompt library — allies, enemies, bosses

Status: current · Authority: pinned generation prompts (non-healer-cast) · Last verified: 2026-07-30

Healer **charge/cast** canon lives in
[`../pixellab-unit-art/healer-animation-prompts.md`](../pixellab-unit-art/healer-animation-prompts.md).
This file covers everything else. When a re-roll produces an approved result
from a changed prompt, paste the winning prompt back here.

**Density:** match the armored-paladin healer (`art/STYLE.md`). Party/trash
stills are native **32×32**; do not ship padded ~88–92px canvases.

Rules (both prompt kinds):

- **Base-still prompts** carry identity: role, gear level, palette cues,
  anti-cues. One dense sentence.
- **Motion prompts** carry verbs only: arcs, VFX, recovery. No outfit
  re-description (the start frame carries identity), no camera, no story.
- Every base prompt ends with the standard suffix below.

**Standard suffix (append to every base still):**

> readable side-view silhouette for a dark fantasy auto-battler, grim
> last-stand dread, not cute, not cartoonish, not chibi

---

## Base stills

### Ally pattern (32, east)

Template — swap the bracketed parts:

> Simple early-game mercenary [role] — basic starter gear only: [2–3 gear
> items, plain materials], no fancy plate yet, [silhouette word: stocky /
> lean / wiry] solid silhouette, earnest grit, muted [iron/leather/cloth]
> palette with one [accent color] accent, room to layer better armor later,
> \<suffix\>

Shipped examples (legacy density, prompts still good): starter tank / dps1 /
dps2 in `../pixellab-unit-art/SKILL.md` — reuse their prose, regenerate at
`size=32`.

### Trash enemy pattern (32, west)

> [Dungeon-flavored undead/monster type] from a heavy-metal dark fantasy
> dungeon — [body/material description], [glow/eye detail], [clothing/decay
> detail], [ambient particle detail], \<suffix\>

Shipped exemplar (Ash Husk, tight 32×32 west — 2026-07-30):

> Ash Gate soot-and-ember trash undead — charcoal bone skeleton, cracked
> cinder flesh patches, hollow glowing ember-orange eyes, tattered soot-black
> rags, ash drifting off shoulders, hunched ready stance filling the canvas
> with feet near the bottom edge, \<suffix\>

PixelLab id `70791a0f-4676-4278-9d8b-6f513ad822e5`; prompt saved at
`art/source/ash-husk/PROMPT.md`. Match dungeon palette: Ash Gate = soot+ember,
Iron Pass = rust+iron, Cinder Court = molten orange, Choir = bone+pale gold,
Bramble = thorn-green+bruise.

### Elite pattern (40, west)

Trash pattern + one signature prop that reads in silhouette (the thing its
ability telegraphs with):

> …, wielding [signature prop tied to its ability], more massive and
> deliberate than the trash around it, \<suffix\>

### Boss pattern (48 / colossal 64, west)

> [Name-worthy epithet] boss of [dungeon] — [imposing body description with
> asymmetric silhouette hook], [material/armor], [glow/aura tied to its
> special ability], heavy weight in the stance, mythic metal album-cover
> menace, \<suffix\>

Seed epithets per current boss (derive final prose from the mob + ability
data in `game/src/data/`):

| Boss | Size | Special | Visual hook to bake into the still |
|---|---|---|---|
| Gate Warden | 48 | `bonehowl` | hulking gatekeeper, skull-laden yoke, jaw built for the howl |
| Thorn Matriarch | 48 | `needle-gaze` | crowned bramble queen, too many eyes, thorn mantle |
| Dirge Sovereign | 48 | `soul-toll` | robed bell-bearer, cracked funeral bell as weapon |
| Ember Colossus | 64 | `emberfall` | molten-cored giant, magma seams, sky-reaching arms |
| Hollow King | 64 | `extinction` | dead-crowned final king, void-black regalia, ember-less cold light |

---

## Motion prompts

### Healer idle loop (4f, loop) — NEW

> The armored figure stands at ease in a subtle breathing loop — chest rises
> and falls gently, shoulders lift a pixel and settle, the red cape sways
> faintly at the hem, head steady and watchful; motion so small the pose
> reads as standing still from a distance, returning exactly to the starting
> pose so the loop cycles cleanly.

Exposure intent: slow, even-ish holds (~180–250ms) with a slightly longer
dwell on the exhale frame. This is the one loop allowed to read calm.

### Healer attack zap (6f, one-shot) — NEW (replaces "bonk")

Weak, costless filler attack — small, quick, clearly minor next to the heal
cast. Magic release with **no traveling projectile**; a small impact VFX
plays on the target (see VFX below), FE-style.

> The armored figure snaps one hand forward from his side in a quick, curt
> flick, a small point of pale gold light sparking at his fingertips at the
> moment of release, arm extended for only an instant with a faint short
> trail of light, then he draws the hand back and settles into his ready
> stance; a minor, effortless gesture — quick and casual, nothing like a
> full spell cast.

Exposure intent: short antic (~67ms), 1-frame snap/spark (~33ms), brief
extended hold (~100ms), quick settle. Total well under the cast strip so the
hierarchy stays: zap « cast.

### Ally / enemy attack (6f, one-shot)

> [Weapon/limb] strike — brief anticipation windup drawing the [weapon]
> back, one fast committed [thrust/swing/slash] with a single motion smear,
> a held extended contact pose, then recover back to the ready stance.

Keep starters basic ("simple strike windup and recover"). Ranged/magic trash:
replace the swing with a short lunge or gesture + spark, same shape — no
projectiles leave the canvas.

### Ally / enemy hurt (4f, one-shot)

> Recoils from a hit — head and shoulders snap back and away, one staggering
> half-step with the silhouette crumpling slightly, then pushes back upright
> and resets to the ready stance.

(Alternative: template `taking-punch`, but v3 with the base still keeps
identity better at 32px.)

### Boss idle loop (6–8f, loop)

> Heavy menacing idle — deep slow breathing with the whole torso, weight
> shifting between stances, [ability aura: e.g. ember seams pulsing brighter
> and dimmer / bell swaying a fraction / thorns flexing], loop returns
> exactly to the starting pose.

Bosses must feel alive while the party fights; dwell on the aura-peak frame.

### Boss attack (6f, one-shot)

Ally attack pattern, scaled: longer antic hold, heavier contact, visible
follow-through shaking into recovery.

### Boss special — two strips (windup loop + release one-shot)

Mirror the healer charge/cast split. Windup loops while the ability
telegraphs (merc-driven timing), release fires once when it lands.

Pattern — windup (4–6f, loop):

> Gathers power for [ability]: [aura/energy grows around the signature
> prop/body part], stance coiling tighter each cycle, the glow pulsing in a
> rhythmic loop that intensifies without releasing.

Pattern — release (6–8f, one-shot):

> Releases [ability]: [one committed motion — slam / toll / howl / gaze
> snap] with a 1-frame flash at the moment of release, [energy/debris/light
> reaction on and around the body], then the body sags from the exertion and
> recovers to the ready stance.

Per-boss seeds:

- **bonehowl**: head thrown back, jaw wide, visible shockwave rings from the
  skull yoke.
- **needle-gaze**: all eyes snap open at once, thin light lances flare from
  the mantle.
- **soul-toll**: bell raised and struck once, concentric toll rings, robes
  blown outward.
- **emberfall**: both arms raised, magma seams flare white, arms crash down
  with a molten burst at the fists.
- **extinction**: crown ignites cold light, one slow all-erasing horizontal
  sweep of the arm, light dies to black.

### VFX strips (target-side impacts)

Pattern proven by `heal-vfx.png` (6×32×32 one-shot on the target). For the
healer zap and boss specials that need a target read:

- 32×32, 4–6 frames, transparent bg, one-shot: bloom → peak flash → dissipate.
- Author route: `create_1_direction_object` (view="sidescroller") +
  `animate_object`, or RetroDiffusion / hand-author like heal-vfx.
- Zap impact: small pale-gold spark burst, clearly weaker than the green
  heal sparkle. Keep palette family per STYLE.md.

### VFX — archer stuck-arrow hit

Approved 2026-07-27. Source: `art/source/arrow-hit/`. Runtime sheet:
`game/public/assets/arrow-hit.png` (flight · embed · burst×4). Presentation
helper: `game/src/ui/arrowHitFx.ts`.

Horizontal embed on purpose — vertical stubs read as ground-planted; the
side-impact read needs the shaft still pointing east into the enemy.

#### Flight still (approved)

Tool: `create_image_pixen` · 32×32 · `no_background=true` · `view=side` ·
`direction=east` · `outline=single color black outline` · `detail=low detail`

> Simple dark-fantasy war arrow in side view pointing east, short iron head, plain wooden shaft, small fletching, single-color black outline, chunky 32px Fire Emblem GBA battle-sprite pixels, transparent background, readable silhouette, grim iron and ash wood, not cute, not cartoonish, no character, no hand, no bow

- Job id: `1234ebf7-242a-4cbd-b2c8-02d9fa554c31`
- Shipped file: `art/source/arrow-hit/flight.png` (draft-a-flight)

#### Embed / contact still (approved — H-manual)

Deterministic tip-clip of the approved flight still (not a fresh gen): clear
columns `x ≥ 18`, add 2–3 pale dust pixels at the cut. Keeps exact A palette
and horizontal east orientation.

- Shipped file: `art/source/arrow-hit/embed.png`

#### Burst motion (approved — hand ash chips)

4 frames of sparse pale bone/ash woodchip pixels radiating from center then
fading. Prefer Phaser-layered stills over `animate_image` (animate morphs the
stub). Proposed exposures: **50, 67, 83, 67** ms.

- Shipped files: `art/source/arrow-hit/burst/0.png` … `3.png`
