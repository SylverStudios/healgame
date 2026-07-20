# Pixel UI font (HealgameIron)

Status: current · Last verified: 2026-07-20

Game-wide replacement for the system `monospace` font (`docs/ui-theme-research.md`
item 2), generated via PixelLab's `create_font`. Two weights, both **16px-native**
glyphs. 8px glyphs were attempted first and are a dead end — see the ledger.

## Generation ledger (what was tried, ~120 gens total)

| Attempt | glyph_px | Prompt gist | Job ID | Verdict |
|---|---|---|---|---|
| v1 Regular | 8 | weathered iron dark-fantasy | `178248f3-f993-4308-9723-644934f063d6` | illegible ("Hub"→"Muh", broken 'v') |
| v1 Bold | 8 | weathered iron dark-fantasy | `8a0b1e02-2019-4d85-91e4-d435b20ad2ae` | illegible |
| v2 Regular | 8 | clean retro RPG, high legibility | `8df7cf98-b74f-4afe-8abc-9220963413e4` | worse than v1 |
| v3 Regular | 8 | FE GBA style, plain readable | `81522618-bf7b-4c35-898f-6f11c401a477` | illegible |
| **v16 Regular** | **16** | clean retro RPG / SNES menu text | `0ff1769f-9482-42af-985e-377ac241e3c7` | **SHIPPED** |
| **v16 Bold** | **16** | same, Bold | `973e6809-8d9f-40be-8785-a8a74f84f526` | **SHIPPED** |

Lesson (locked in docs/ui-theme-handoff.md): PixelLab cannot hold 8px glyph
letterforms together at either prompt style — do not retry 8px. The 16px
reference layout is clean but **contains no digit glyphs**: digits fall back
to the `monospace` chain entry in-game. Accepted gap; revisit only as a
deliberate later pass.

## Family names

Both weights register under a single CSS family, `HealgameIron`,
distinguished by `font-weight` (400 regular / 700 bold) so Phaser's
`fontStyle: 'bold'` text styles pick the bold weight automatically. (The
ttf-internal names are "HealgameIron16" / "HealgameIron16Bold"; CSS matching
uses the declared family, so the filenames and @font-face block did not
change when v16 replaced v1.)

## Where files live

- Installed: `game/public/assets/fonts/healgame-iron-regular.ttf`,
  `game/public/assets/fonts/healgame-iron-bold.ttf`
- Source copies + glyph atlases: `art/source/fonts/`
- `@font-face` registration: `game/index.html` (`font-display: block`)
- Load gate: `game/src/ui/theme.ts` (`fontsReady`, kicked off at module-eval
  time), awaited by `game/src/scenes/BootScene.ts` before starting the first
  text-rendering scene. `main.ts` game construction stays synchronous — an
  async main caused an intermittent journey settle-timing flake.
- Usage: `game/src/ui/theme.ts` (`FONT`, `FONT_SIZE_XS/SM/MD/LG`) — every
  scene/widget font-family and font-size constant traces back here except
  `game/src/ui/combatLog.ts`, which is the intentional debug exception and
  stays on `DEBUG_FONT = 'monospace'`.

## Sizing

Glyphs are 16px-native: SM=16px is a 1:1 read, LG=32px a clean 2×, MD=24px a
1.5× (slightly uneven, visually fine), XS=12px a downscale for tight HUD
spots (HP numbers, spell-bar cost/hotkey/timer, tree micro-labels, loadout
slot stack) whose layouts budget ~10px lines. Documented deviations live as
inline comments at each call site in `game/src/scenes/*.ts` /
`game/src/ui/*.ts`.
