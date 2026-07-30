# ash-husk — trash enemy still + strips (32×32)

Status: current · Last verified: 2026-07-30

PixelLab character id: `70791a0f-4676-4278-9d8b-6f513ad822e5` (name: ash-husk-v2)
Mode: v3 · size: 32 · view: side · outline: single color black outline · detail: medium detail

## Base still prompt

Ash Gate soot-and-ember trash undead — charcoal bone skeleton, cracked cinder flesh patches, hollow glowing ember-orange eyes, tattered soot-black rags, ash drifting off shoulders, hunched ready stance filling the canvas with feet near the bottom edge, readable side-view silhouette for a dark fantasy auto-battler, grim last-stand dread, not cute, not cartoonish, not chibi

## Attack strip (west, 7f = rest + 6 gen)

`ash-husk-attack-west` · group `334aa6cd-4dfd-4a52-a6d7-c034c6bdfa94`

> Simple claw strike — brief anticipation windup drawing the bony arm back, one fast committed slash with a single motion smear, a held extended contact pose, then recover back to the ready stance

## Hurt strip (west, 5f = rest + 4 gen)

`ash-husk-hurt-west` · group `d882e2a1-a063-4149-be55-6c80f75dd361`

> Recoils from a hit — head and shoulders snap back and away, one staggering half-step with the silhouette crumpling slightly, then pushes back upright and resets to the ready stance

## Post

- Cropped with `npm run art -- crop --size 32` (union window, bottom-center)
- Combat facing: west
- Display: 64 (2×) with tight foot pad (2/32), same grain as armored-paladin healer
- Exposure: `ASH_HUSK_ATTACK_FRAME_DURATIONS_MS` / `ASH_HUSK_HURT_FRAME_DURATIONS_MS` in `sprites.ts`
