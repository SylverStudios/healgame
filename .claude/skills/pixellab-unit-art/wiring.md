# Wiring PixelLab units into combat (reference)

Art skill stops at `artifacts/`. This file is for a follow-up agent that mounts
sprites in Phaser. Authority for live Kenney mapping: [`docs/unit-art.md`](../../../docs/unit-art.md).

## Proven example exports

| Unit | Artifacts | Combat still | Attack |
|---|---|---|---|
| Ash Husk | `artifacts/pixellab-ash-husk/` | `west.png` (88×88) | `idle-west/0–3.png` (idle, not attack) |
| Starter tank | `artifacts/pixellab-starter-tank/` | `east.png` (92×92) | `attack-east/0–6.png` |
| Starter DPS1 | `artifacts/pixellab-starter-dps1/` | `east.png` (92×92) | `attack-east/0–6.png` |
| Starter DPS2 | `artifacts/pixellab-starter-dps2/` | `east.png` (92×92) | `attack-east/0–6.png` |

PixelLab ids (regenerate via MCP if missing locally):

- Ash Husk: `da0196d5-84ee-4a6c-a0a2-39bc5d4de869`
- Starter tank: `806703ff-4ea0-4eb5-b04f-7823fa62897a`
- Starter DPS1: `c1af3f15-9e76-41e7-8245-ed787386e145`
- Starter DPS2: `d0055c04-5cff-4070-9e1d-9a16866d32b5`

## Display sizes (CombatScene)

| Role | Display |
|---|---|
| PixelLab mercs (legacy padded ~92px) | 112×112 |
| Healer (native 32×32 armored-paladin) | 64×64 |
| Kenney party | 48×48 |
| PixelLab trash | 72×72 |
| Kenney trash | 32×32 |
| Boss | 80×80 |

Scale with `setDisplaySize` and `pixelArt: true` (nearest neighbor). Legacy
PixelLab canvases are padded; 32×32 healer frames are tight — use the smaller
`HEALER_FOOT_PAD_RATIO` so feet meet the ground line.

## Static + attack contract (shipped)

1. Copy combat stills + attack frames into `game/public/assets/units/<slug>/`.
2. Preload stills + per-frame attack images in `BootScene`; register Phaser
   anims from `UNIT_ATTACK_ANIMS` in `sprites.ts`.
3. `presentationForUnit` → `{ kind: 'texture', key }` for tank / dps1 / dps2 /
   ash-husk.
4. `UnitSprite` body is a `Sprite`. Custom texture → no frame, **no flipX**.
5. On tank shove / DPS jab, `playAttack()` runs the strip, then restores the
   rest still.

## Healer charge / cast-action (shipped)

1. Sheet layout: `[idle][charge…][cast-action…]` at
   `assets/units/healer/sheet.png` (also split folders `charge-east/`,
   `cast-east/`).
2. Exposure sheets in `sprites.ts`: `HEALER_CHARGE_FRAME_DURATIONS_MS` (loop),
   `HEALER_CAST_FRAME_DURATIONS_MS` (one-shot) — FE holds, not equal GIF times.
3. `CombatScene`: channel → `setCasting(true)` (charge loop); near end →
   `beginEarlyCastRelease()` (lead = `HEALER_CAST_RELEASE_LEAD_MS` so flash
   meets heal); finish → `finishCast()` (no-op if early release already
   playing); instant → `playCastRelease()`; cancel → `setCasting(false)`.
4. Queued next cast must **not** clip release: `setCasting(true)` while
   release is active sets `pendingCharge` and starts charge only after the
   cast-action strip completes.

Touch: `BootScene.ts`, `sprites.ts` (+ tests), `unitSprite.ts`,
`CombatScene.ts` (sizes + `attackAnimKey` / healer casterAnim), `docs/unit-art.md`.

## Verify

- `npm run verify:fast` minimum; full `verify` if scene wiring moved.
- Journey names on interactive bodies (`combatAlly:<id>`) must remain.
