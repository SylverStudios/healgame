# Healer Vowstrike attack strip

Status: current · Authority: none — exploration provenance · Last verified: 2026-07-19

Method B instant oath-strike for both Vowstrike aspects.

| Artifact | Role |
|---|---|
| `keys/vowstrike-climax-south.png` | Climax key (PixelLab state `d94ad5b6-c9f8-44d5-a03a-b4c08925b410`) |
| `approach-raw/` | Idle → climax interpolate (5f, 60×60) |
| `approach-32/` | Tight crop installed to `vowstrike-south/` |
| `recover-raw/` | Climax → idle interpolate (too wide for 32×32; not shipped) |
| `vowstrike.html` | FE-timed preview |

**Shipped:** approach only — ends on climax hold; Phaser snaps to idle on
complete (same pattern as heal cast-action). Recover strip overflowed (37×31
union); re-roll with tighter arms if a painted recover is needed later.

**Exposure:** `HEALER_VOWSTRIKE_FRAME_DURATIONS_MS` =
`33,40,50,67,167` (~357ms total; impact lead 190ms).
