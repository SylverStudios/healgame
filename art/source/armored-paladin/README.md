# armored-paladin — healer 32×32 source

Status: current · Authority: none — asset provenance · Last verified: 2026-07-19

Native **32×32** party-healer still + cast pipeline. Runtime:
`game/public/assets/units/healer/`.

| File | Role |
|------|------|
| `east.png` | Idle still |
| `charge-sheet.png` | **Charge** — 3×3 of 32×32 (runtime uses cells 1–5 as loop) |
| `cast-action-4x.gif` | **Cast action** — 128×128 (4×) preview; runtime uses frames 1–7 at 32×32 |
| `casting-v1.gif` / `casting-v3.gif` | Earlier charge-loop experiments (superseded) |
| `casting-v2-4x-preview.gif` | Earlier 4× preview |

**Playback split:** charge loops while a cast channels; cast-action plays once on
release (or as the instant-cast flourish). Facing: three-quarter right — no flipX.

**Regenerate / swap base:** prompt library + PixelLab/RetroDiffusion notes live in
[`.claude/skills/pixellab-unit-art/healer-animation-prompts.md`](../../../.claude/skills/pixellab-unit-art/healer-animation-prompts.md).
