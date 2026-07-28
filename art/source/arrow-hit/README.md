# arrow-hit — archer stuck-arrow VFX

Status: current · Authority: none — asset provenance · Last verified: 2026-07-27

Presentation-only hit juice for party **dps2** (archer). Not a unit — do not
add a fake party row to `art/manifest.json`.

Native **32×32**, display at 2×. Transparent bg. Density per `art/STYLE.md`.

| Path | Role |
|------|------|
| `flight.png` | Single-frame east-pointing arrow (tweened in Phaser) |
| `embed.png` | Tip-clipped horizontal stub (same pixels as flight, tip cleared) |
| `burst/0.png`…`3.png` | Pale ash/woodchip spark frames |
| `sheet.png` | Packed row: flight · embed · burst×4 → `game/public/assets/arrow-hit.png` |

**Shipped combo (human-approved 2026-07-27):** flight = PixelLab draft A;
embed = H-manual tip-clip of A (horizontal — reads as side impact, not
ground-planted); burst = hand-authored `burst-manual` strip.

**Regenerate:** prompts in
[`.claude/skills/pixellab-art-pipeline/prompt-library.md`](../../../.claude/skills/pixellab-art-pipeline/prompt-library.md)
§ VFX — archer stuck-arrow hit. Session log:
`artifacts/pixellab-arrow-hit/PROMPTS.md`.

**Runtime wiring:** `game/src/ui/arrowHitFx.ts` (`showArrowHit`). Removable by
dropping the CombatScene call + BootScene preload + this helper.
