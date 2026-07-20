# UI-theming phase — orchestrator handoff & live state

Status: planning · Authority: active phase handoff (wins this phase's scope)
· Updated: 2026-07-20 by the central agent

This file is the durable state of the UI-theming phase so a fresh
orchestrator session (or any subagent) can resume without prior context.
Spec bible: [`docs/ui-theme-research.md`](ui-theme-research.md) (per-item
specs, palette hexes, FE metrics, §5 handoff-note template). Gates:
CLAUDE.md. Update THIS file's chunk table + ledger after every chunk.

## Mission (unchanged)

Replace the PoC temp-art UI (flat rects, monospace, black void) with the
FE-GBA-styled presentation from the bible. Presentation only — engine
behavior, layout constants, and gameplay data do not change.

## Done-means checklist (verify each before declaring the phase done)

1. All in-game text in a bundled PixelLab .ttf pixel font (monospace only
   for the debug combat log). ← shipped, chunk 1 (digits caveat below)
2. Ash Gate combat: layered backdrop + perspective platform slices under
   party/enemy lines; units in front; feet at GROUND_Y=340.
3. Spell buttons/keycaps/cast bars/tooltips in pixel-art frames; real 16×16
   spell icons, glyph char fallback (relicSprites.ts pattern).
4. Hub/Tutorial/Loadout/Relic/Settings + combat result panel share one
   nine-slice panel/button kit (ui/panels.ts).
5. Banter bubbles, tutorial, result panel show bust portraits
   (victory=healer, wipe=tank).
6. Every scene change fades (~150–250ms); hub→combat chunky pixel wipe;
   total <400ms.
7. Talent-tree nodes = framed sockets (locked/affordable/owned); edges =
   textured strips tinted per EdgeState; layout untouched.
8. Every shipped dungeon resolves a battlefield variant via data-driven
   battlefieldForEncounter().
9. Tutorial/title dressed with wordmark, portrait, panel kit.
10. Full `npm run verify` green; journey zero coordinate/name edits;
    CLAUDE.md temp-art exception list names each new asset class.

## Chunk table (sequential; most touch shared scenes)

| id | what | depends | status |
|---|---|---|---|
| 0 | Baseline; ui/theme.ts; balance recorded | — | **done** (commit 02a9d03) |
| 1 | Pixel font game-wide | 0 | **done** (commit 4c60513; full verify green on the code path, verify:fast + smoke-shot green after the v16 ttf swap) |
| 2 | Ash Gate battlefield: backdrop + platforms → ui/battlefield.ts, assets/battlefields/ashgate/ | 0 | **done** (2026-07-20; full verify green, central-agent re-verified; screenshot 02-ash-gate-first-run-feedback.png; ledger artifacts/pixellab-1/README.md) |
| 3 | Spell-bar/HUD framing kit + 16×16 spell icons → ui/spellBar.ts, glyph.ts, bar.ts (additive), spellTooltip.ts, assets/ui/ | 1 | **done** (2026-07-20; full verify green, central-agent re-verified; icons for all 7 spells + 3 CDs, glyph fallback kept; ledger artifacts/pixellab-3/README.md) |
| 4 | Meta-scene panel kit + result panel → NEW ui/panels.ts; Hub/Tutorial/Loadout/Relic/Settings; result overlay | 3 | **done** (2026-07-20; full verify green, central-agent re-verified; hub/result screenshots checked; ledger artifacts/pixellab-4/README.md) |
| 5 | Portraits in bubbles/tutorial/result → ui/speechBubble.ts, assets/units/portraits/ | 4 | **done** (2026-07-20; subagent hit 3 stream/session interruptions, resumed each time — central agent finished the last step (verify + ledger) directly; full verify green; all 4 party portraits shipped; ledger artifacts/pixellab-5/README.md) |
| 6 | Scene transitions, code-only → NEW ui/transitions.ts, scene.start seams | 0 | **done** (2026-07-20; full verify green, central-agent re-verified; zero PixelLab spend; every scene.start seam covered — plain fade or the hub/tutorial→combat chunky wipe) |
| 7 | Talent-tree sockets + edge textures → TreeScene, assets/ui/tree/ | 3 | todo |
| 8 | Per-dungeon battlefield variants → assets/battlefields/*, battlefieldForEncounter() | 2 | todo |
| 9 | Title/tutorial dress-up → TutorialScene, hub title | 4,5 | todo |
| 10 | Final QA: full verify + journey, smoke --shots visual pass, CLAUDE.md exception list + CHANGELOG, QA note, draft PR | all | todo (central agent) |

Chunks 0 and 10 belong to the central agent. CLAUDE.md and
art/manifest.json are central-agent-only files at every checkpoint —
subagents report entries; they never edit either.

## Locked decisions (do not relitigate)

- **Font**: "HealgameIron" = PixelLab 16px-glyph fonts (8px-glyph attempts
  are illegible mush — do not retry 8px). Files
  `game/public/assets/fonts/healgame-iron-{regular,bold}.ttf`, registered in
  game/index.html @font-face (family HealgameIron, 400/700), loaded via
  `fontsReady` in ui/theme.ts (BootScene awaits it; 2s safety timeout; game
  construction in main.ts must stay synchronous — an async main caused a
  ~40% journey flake, root-caused, do not reintroduce).
- **Known gap**: PixelLab's 16px-glyph reference layout has NO digit glyphs
  — digits fall back to monospace. Accepted for now; a future pass may
  regenerate. Do not "fix" by rendering digits at 8px glyphs.
- **Font sizes** (ui/theme.ts): XS=12px (tight HUD spots), SM=16px (1:1
  native), MD=24px (1.5×), LG=32px (2×). Deviations documented at call
  sites; combat log stays DEBUG_FONT monospace.
- **Palette/theme**: all new work imports FONT/PALETTE/PALETTE_NUM from
  ui/theme.ts instead of local hex consts.
- **Journey**: resolves by setName only (docs/semantic-targets.md is
  frozen). Re-skins must never rename or require coordinate edits.
- **Layout constants frozen**: GROUND_Y=340, PARTY_SLOT 80–380,
  ENEMY_SLOT 580–880, SPELL_BAR_Y=508, spell button 100×52, keycap 18×14.
- **Backdrops are composed layers** (code gradient + map_object props +
  platform slices), never one full-screen painting (bible §3 gap note).
- **Battlefield API (chunk 2, for chunk 8)**: `ui/battlefield.ts` exposes
  `buildBattlefield(scene, variantKey, params)` +
  `battlefieldTexturesForVariant(variantKey)`; chunk 8 extends the variant
  map and adds `battlefieldForEncounter()` on top — do not reshape these.
  `create_map_object` has NO `style_images` param (style-match via prompt
  vocabulary instead); the ember-haze band is code-drawn after 3 failed
  generations — do not retry it as a map_object. Gate-arch is an opaque
  diorama whose seam is masked by overlapping wall fragments; manifest has
  a `battlefields` array (audit tool ignores it).
- **Spell-UI chrome (chunk 3)**: icon/frame registry is `ui/spellSprites.ts`
  (relicSprites pattern; `glyphChar` stays the fallback for unmapped ids —
  never remove it). `Bar` gained optional `frameTextureKey` (frame texture
  authored at half bar size with transparent center). Tooltip panel is a
  plain rect + 4 code-drawn corner ornaments, NOT Phaser NineSlice
  (WebGL-only — don't switch). Micro-bars (GCD/boss slivers, unit HP/mana)
  stay unframed by decision. UI chrome does NOT get manifest rows — the
  registry module + artifacts/pixellab-3/README.md are its traceability.
  Prefer single-element `create_ui_asset` jobs (multi-element stalled).
- **Panel kit (chunk 4)**: `ui/panels.ts` `addPanel`/`addButton`/`addBanner`
  + `Frame` class — chunks 5/7/9 build on it, don't fork a second kit.
  Manual nine-slice (corner Images + stretched edge Images + Rectangle
  fill); corners are code-drawn (PixelLab illegible below ~12px). A `Frame`
  wrapping a named hitRect hides that rect's own fill/stroke and owns all
  state styling (`setState('hover'|...)`); hover handlers must go through
  the Frame, never un-hide the rect. CURRENT/selected = gold outline
  overlay; per-relic hover accent via `accentColor` option. Settings
  volume track stays unframed (too thin), panel behind it instead.
- **Portraits (chunk 5)**: `ui/portraitSprites.ts` registry (4/4 units
  shipped: healer/tank/dps1/dps2) + `drawFramedPortrait`/
  `revealFramedPortrait`/`revealResultPortrait` helpers built on top of
  `ui/panels.ts`'s 'sm' `Frame` — reuse these, don't invent new portrait
  chrome. **Gotcha for any future module with both a colocated pure-logic
  test AND a real (non-type) `Phaser.Math.*`/similar call at module scope**:
  importing it under vitest (no jsdom) crashes with "navigator is not
  defined" the first time anything actually imports that module, because
  the real `Phaser` value import can't be elided the way `ui/battlefield.ts`
  (type-only `Phaser` usage) can. Prefer a tiny local helper (see
  `speechBubble.ts`'s `clamp()`, `music.ts`'s `clampMusicPct()`) over
  `Phaser.Math.Clamp` in any module you're about to unit-test.
- **Transitions (chunk 6)**: `ui/transitions.ts` — `fadeToScene(scene, key,
  data?, durationMs?)` wraps every `scene.start()`; `fadeInOnCreate(scene)`
  goes at the top of each target scene's `create()` (after any early-return
  redirect, e.g. RelicScene's empty-offers case, so it never fires on a
  scene that's about to bounce again); `chunkyWipeIn(scene, w, h)` is
  CombatScene-only, called as the last line of `create()` — a blocky
  Rectangle-grid reveal, not a shader (postFX pixelate is WebGL-only, same
  class of issue as NineSlice). Combat entry uses the shorter
  `COMBAT_ENTRY_FADE_OUT_MS` fade-out paired with the wipe so the total
  stays under the 400ms budget. Zero PixelLab spend, no ledger/manifest
  entries for this chunk.
- **Art process**: style-reference armored-paladin/relic art in every
  generation; prompts + accepted IDs in artifacts/pixellab-<item>/README.md;
  source PNGs in art/source/; subagents report manifest/CLAUDE.md entries
  up, never edit those files.

## PixelLab budget ledger

- Phase start balance: **1787** subscription generations.
- Chunk 1 font spend: 6 jobs = **124** → balance **1663** after chunk 1
  (v1 reg+bold 8px weathered — illegible; v2, v3 8px rerolls — illegible;
  v16 reg+bold 16px — SHIPPED). Job IDs in artifacts/pixellab-2/README.md.
- Chunk 2 battlefield spend: 6 jobs = **6** → balance **1657** after chunk 2
  (gate-arch, wall-fragment, platform accepted first-try; 3 ember-haze
  attempts all rejected — band stays code-drawn, do not retry it as a
  map_object). Job IDs in artifacts/pixellab-1/README.md.
- Chunk 3 spell-UI spend: **90** → balance **1567** after chunk 3 (10-icon
  batch + cast-bar/button/keycap frames; a multi-element `create_ui_asset`
  job stalled at 64% and was abandoned uncharged — prefer single-element
  jobs). Job IDs in artifacts/pixellab-3/README.md.
- Chunk 4 panel-kit spend: 2 jobs = **80** → balance **1487** after chunk 4
  (panel-frame job rejected — off-palette kit sheet; button-frame job
  accepted, its edge band reused everywhere; corners are code-drawn —
  PixelLab art is illegible below ~12px, third confirmation). Job IDs in
  artifacts/pixellab-4/README.md.
- Chunk 5 portrait spend: 4 accepted jobs = **80** → balance **1407** after
  chunk 5 (healer/tank/dps1/dps2 all accepted; 2 free failed tank
  submissions — base64 re-encoding glitch, not a content issue — and 1
  uncharged dps2 timeout, balance math confirms neither billed). Job IDs in
  artifacts/pixellab-5/README.md.
- Floor: stop art spend if a chunk would drop balance below **800**; check
  `get_balance` before each art chunk.

## Delegation protocol (per subagent chunk)

One Sonnet subagent per chunk, synchronous, dependency order. Every brief
includes: bible item + §5; CREATE / MAY EDIT / DO NOT TOUCH lists (DO NOT
TOUCH always: src/combat/, src/data/, src/tree/, src/meta/, src/save/,
CLAUDE.md, art/manifest.json, journey.mjs, semantic-targets.md); pinned
contracts above; locked micro-decisions; DoD = full `npm run verify` from
game/ + smoke-shot visual check; "report cross-boundary friction, don't fix
outside scope". **Timebox**: if a subagent isn't converging after ~2 retries
of a failing step, it must stop and report rather than grind (the chunk-1
font hunt burned an hour; don't repeat).

After every chunk the central agent: runs `npm run verify` itself, reads the
diff, looks at a smoke/journey screenshot, does cross-boundary integration,
updates CLAUDE.md exception list + art/manifest.json + THIS FILE, commits
one checkpoint.

## CLAUDE.md exception sentences queued (add at chunk 10 or per-chunk)

- (none queued — font (chunk 1) and battlefield (chunk 2) sentences were
  added to CLAUDE.md's temp-art bullet at the chunk-2 checkpoint.)

## Resuming in a fresh session

Read, in order: this file → docs/ui-theme-research.md → CLAUDE.md →
docs/semantic-targets.md → art/STYLE.md. Worktree:
`.claude/worktrees/ui-theme-research`, branch `worktree-ui-theme-research`
(npm deps installed; run commands from `game/`). Then continue at the first
non-done chunk in the table, following the delegation protocol.
