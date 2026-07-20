# armored-paladin — healer 32×32 source

Status: current · Authority: none — asset provenance · Last verified: 2026-07-19

Native **32×32** party-healer still + Solemn/Zealous cast pipeline + Vowstrike
attack. Runtime: `game/public/assets/units/healer/`. Combat facing: **south**.

| Path | Role |
|------|------|
| `south.png` / `east.png` | Idle still (south combat; east preload compat) |
| `idle-south/` | Breathing loop (5f) |
| `charge-solemn-south/` | Solemn charge climax loop (4f) |
| `charge-zealous-south/` | Zealous charge climax loop (4f) |
| `cast-solemn-south/` | Solemn release one-shot (9f) |
| `cast-zealous-south/` | Zealous forward release one-shot (9f) |
| `vowstrike-south/` | Instant oath-strike (5f, both aspects) |
| `vowstrike-climax-south.png` | Method B climax key (PixelLab state) |
| `attack-south/` | Bonk zap (7f) |
| `zap-vfx/` | Bonk target impact |

**Spell → strip:** `solemn-*` → Solemn charge/cast; `zealous-*` → Zealous;
`vowstrike-*` → vowstrike attack; `bonk` → zap only.

**Playback:** charge loops while channeling (variable cast time); cast-action
plays once on release; Vowstrike/Bonk play one-shot attack strips with hit
presentation delayed to the climax frame; cancel snaps back to idle.

**Regenerate:** Method B (key pose + interpolate) — see
[`.claude/skills/pixellab-unit-art/healer-animation-prompts.md`](../../../.claude/skills/pixellab-unit-art/healer-animation-prompts.md)
and art-pipeline § Cast / holdable-pose generation.
