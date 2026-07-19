# art/source — authored sprite-sheet exports

Status: current · Authority: none — asset provenance note · Last verified: 2026-07-19

User-authored exports and cast previews. Runtime copies the game loads live
in `game/public/assets/` and must be updated together when a sheet changes.
PixelLab generation intermediates live in `artifacts/` instead (one directory
per generation batch).

| Path | Role |
|------|------|
| `armored-paladin/` | Live party healer (32×32 still + cast GIF variants) |
| `ragged-healer-sheet.png` | Historical 64×64 healer sheet (superseded) |
| `healer-wind-up.png` | Unused wind-up strip |
| `heal-vfx.png` | Heal sparkle VFX source |
