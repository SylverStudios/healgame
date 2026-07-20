# Healer cast-style exploration (Solemn vs Zealous)

Review-only artifacts. Nothing wired into the game.

Open the `*.html` files in a browser for timed playback.
Start with `keys/key-compare-4x.png` for the philosophy silhouettes.

## Two pipelines tested

| | Method A — text-only v3 | Method B — key poses + interpolate |
|---|---|---|
| How | `animate_character` + `action_description` from idle south | `create_character_state` climax poses, then `custom_start_frame_url` + `end_frame_url` |
| Cost | **1 gen / strip** | **~20–40 gens / key pose** (full 8-dir state) + **1 gen / strip** |
| Pose control | Soft — model invents climax | Hard — climax is authored first |
| Best for | Cheap exploration / VFX pulse | Holdable charge climax + release contact |

## Folder map

```
keys/                         authored climax stills (create_character_state)
  key-compare-4x.png          4× sheet of the important keys
  solemn-charge-south.png     ★ best Solemn hold pose
  zealous-charge-east.png     ★ best Zealous coil (side view)
  …-south / …-east variants

method-A/                     text-only strips (south)
  solemn-charge/ + .html
  zealous-charge/ + .html
  solemn-release/ + .html
  zealous-release-forward/ + .html

method-B/                     interpolated strips (south, plus east zealous charge)
  solemn-charge/ + .html      idle → solemn prayer key
  zealous-charge/ + .html     idle → zealous south key
  solemn-release/ + .html     prayer key → open-arms key
  zealous-release-forward/    charge key → thrust key (may arrive later)
  zealous-charge-east/        idle east → coil east (may arrive later)

*-climax-AB.png               side-by-side Method A vs B climax frames
```

## PixelLab ids (for re-rolls)

| Role | character_id |
|---|---|
| Base healer | `7ff83bfc-d23f-4270-8970-fa1b593e1384` |
| Solemn charge key | `f3248a61-c0d3-492a-8a47-5b6ab78389ab` |
| Zealous charge key v1 | `50a72e86-e402-4de3-a4b9-085849718ff0` |
| Zealous charge key v2 | `9afb18aa-47f9-48a1-a7de-9dd6e0850c39` |
| Solemn release key | `b95130c6-ae99-42c8-9d70-da992dde2a86` |
| Zealous release key | `be0ee6fb-b5c0-40e2-8cc8-22fbe82fafde` |
