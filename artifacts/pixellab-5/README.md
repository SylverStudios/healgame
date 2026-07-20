# Party bust portraits (bible item 5)

Status: current · Last verified: 2026-07-20

FE-style bust portraits for banter bubbles, the tutorial screen, and the
combat result panel (`docs/ui-theme-research.md` §4 item 5; chunk 5 of
`docs/ui-theme-handoff.md`). Wiring: `game/src/ui/portraitSprites.ts`.

Note on process: this chunk's subagent hit three consecutive stream/session
interruptions (unrelated infra errors, not task failures) and was resumed
from transcript each time. This ledger was reconstructed by the central
agent from the subagent's tool-call transcript after its final interruption
(it died one step before writing this file, immediately before running
`npm run verify`) — job IDs and verdicts below are read directly from the
transcript's `create_portrait_character`/`get_portrait_character` calls, not
recollected from memory.

## Generation ledger (4 accepted jobs, 80 generations spent — 1487 → 1407)

All calls: `create_portrait_character` (`character_to_portrait` mode), `view:
side`, output `48×48px`, `~20 generations` each.

| Unit | Source still | Job ID | Verdict |
|---|---|---|---|
| healer | `art/source/armored-paladin/east.png` | `735499e8-a467-4132-94b0-36c99bd53ddb` | **ACCEPTED** — first try |
| tank | `game/public/assets/units/tank/east.png` | `0a00e0de-3f6c-4fcb-8595-f15e6154209d` | **ACCEPTED** — after 1 free failed attempt (see below) |
| dps1 | `game/public/assets/units/dps1/east.png` | `adcb90b8-9fc4-4a1e-8785-d9d3cb39e53e` | **ACCEPTED** — first try |
| dps2 | `game/public/assets/units/dps2/east.png` | `34745ecb-2c6e-4e64-90ae-3654d2d9f662` | **ACCEPTED** — after 1 uncharged timeout (`cf5c1bf6-e9fb-4369-a76e-f2ed10ab0ebb`, "Generation timed out" at ~62% after several minutes; not billed — balance math below confirms) |

Two additional tank-portrait submissions errored before any generation ran
(`Could not decode image: broken data stream` / `unrecognized data stream
contents` — a base64 re-encoding glitch on resubmission, not a PixelLab
content issue) and cost 0 generations; the third submission (job
`0a00e0de-...` above) succeeded.

**Balance**: 1487 (chunk-4 end) → 1407 (chunk-5 end) = 80 spent = exactly
4 × 20 (healer + tank + dps1 + dps2), confirming the failed tank submissions
and the timed-out dps2 job were genuinely uncharged.

## Shipped: all 4 portraits

No fallback needed — every party unit (healer, tank, dps1, dps2) has a live
portrait. `banter.ts`'s `BanterSpeaker` currently only fires `healer`/`tank`
in practice, but the registry (`PORTRAIT_UNIT_IDS` in `ui/portraitSprites.ts`)
covers all four so a future banter speaker needs no second art pass.

## Files

- Source (frozen): `art/source/portraits/{healer,tank,dps1,dps2}.png` (48×48,
  as returned by PixelLab — no crop/resize step needed)
- Runtime: `game/public/assets/units/portraits/{healer,tank,dps1,dps2}.png`
  (identical bytes to source)
- Wiring: `game/src/ui/portraitSprites.ts` (+ `portraitSprites.test.ts`) —
  registry (`portraitTextureKey`/`portraitTextureUrl`/`portraitTextures`,
  relicSprites.ts pattern) plus `drawFramedPortrait`/`revealFramedPortrait`/
  `revealResultPortrait`/`resultPortraitPosition` (Scene-consuming helpers
  that reuse `ui/panels.ts`'s 'sm' `Frame` for the inset border — no new
  panel chrome invented for this chunk)
- `game/src/ui/speechBubble.ts` (+ `speechBubble.test.ts`): additive
  `portraitTextureKey` option on `SpeechBubbleOptions`; bust renders to the
  box's left, bottom-anchored to the box's bottom edge; pure
  `bubbleHorizontalExtents`/`bubbleTotalHeight` helpers size the screen-clamp
  math around the wider/taller assembly. Silently reproduces the exact
  pre-chunk-5 text-only layout when no key is passed or the texture never
  loaded (`scene.textures.exists()` check) — never a broken image.
- `game/src/scenes/CombatScene.ts`: `fireBanterBubble` passes
  `portraitTextureKey(speaker)`; `showResultOverlay` calls
  `revealResultPortrait` (victory → healer bust, wipe → tank bust — the
  already-locked banter triggers).
- `game/src/scenes/TutorialScene.ts`: healer bust beside the copy panel via
  `drawFramedPortrait`.
- `game/src/scenes/BootScene.ts`: preloads `portraitTextures()`.

## A pre-existing bug this chunk's test surfaced (fixed by the central agent)

`speechBubble.ts` already called `Phaser.Math.Clamp(...)` at runtime before
this chunk (not something chunk 5 introduced). No test file had ever
imported that module before — `speechBubble.test.ts` (new this chunk, tests
only the two pure layout helpers) was the first, and importing the module at
all forces Node to load Phaser's browser device-detection code, which
crashes with `ReferenceError: navigator is not defined` under vitest's
default (non-jsdom) environment. `ui/battlefield.ts` avoids this because it
only ever uses `Phaser` in type positions (`scene: Phaser.Scene`), which
esbuild's TS transform elides per-file when the binding is never referenced
as a value — so its module body never actually touches the real `Phaser`
import. Fix: replaced the two `Phaser.Math.Clamp` calls in `speechBubble.ts`
with a tiny local `clamp()` helper (same spirit as `music.ts`'s
`clampMusicPct`), which restores the type-only-usage property and lets the
import get elided again. No vitest config was touched. **Any future module
that both (a) gets a colocated test for its pure helpers and (b) calls a
real Phaser namespace function (`Phaser.Math.*`, `Phaser.Geom.*`, etc.) at
module scope will hit this same crash — prefer a local helper over
`Phaser.Math.Clamp`/similar when the module is going to be unit-tested.**

## Visual check

`npm run smoke -- --shots` → `01-tutorial.png` (healer bust beside the copy
panel), `05-combat-wipe-banter.png` (tank bust beside the banter bubble),
`06-combat-wipe-summary.png` (tank bust in the framed result-panel inset).
Confirmed by eye (central agent): busts render at the correct 2× density,
don't overlap the copy panel text, the bubble tail, or the `Return` button;
CURRENT chunk-4 panel chrome frames the result-panel inset with no new
styling invented.
