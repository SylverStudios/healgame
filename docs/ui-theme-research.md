# UI & environment theming research — beyond character sprites

Status: research · Authority: informational (adopting any item is a scope
decision — see "Scope note") · Written: 2026-07-19

Character art is landing at the FE-GBA 32×32 density (`art/STYLE.md`), but
everything *around* the characters is still the PoC temp-art plan: flat rects,
1–2px strokes, monospace system text, bare `#1a1210` background. This doc
catalogues every UI surface, documents the Fire Emblem GBA battle-screen
composition we're referencing, maps each opportunity to a PixelLab MCP
capability, and ranks the work by impact vs effort so items can be handed to
subagents one at a time.

PixelLab budget at time of writing: **1,789 / 2,000 subscription generations
remaining** (UI panels and tilesets cost ~20–40 each; fonts and portraits are
"pro" priced; v3 character work is 2–9).

## Scope note (read first)

CLAUDE.md's hard rule is *"Temp art only, few exceptions … everything else
stays rects, bars, monospace text — reject polish creep."* Every item below is
therefore **an amendment to that rule**, not routine work. When an item is
approved, its subagent's chunk must include updating the CLAUDE.md exception
list (the way relic icons and the healer sheet already earned exceptions).
Nothing here touches `src/combat/`, `src/data/`, or engine behavior — it is
all presentation in `scenes/` + `ui/` + `public/assets/`.

Hard constraints that bind every item:

- **Density rule**: 1 art pixel = 2 screen pixels, nearest-neighbor. A 960×540
  canvas is a 480×270 art grid. UI panels are authored at half display size.
- **Palette**: soot / ember / iron / bone on `#1a1210` (see `art/STYLE.md`).
  Current UI hexes to match: bg `#1a1210`, panel `#241a15` / `#3a2a22`, border
  `#0a0605` / `#8a7868`, text `#e8d8c8`, dim `#a89888`, gold accent `#f2c14e`,
  danger `#e05a4e`, mana-blue `#a8c8f0`, health-green `#7ad67a`.
- **Journey names**: every interactive object keeps its stable `setName(...)`
  (`docs/semantic-targets.md`). Re-skinning a button must not rename it.
  Layout changes must not require journey coordinate edits.
- **Gate**: `npm run verify:fast` minimum; full `npm run verify` for anything
  touching scenes (all of this touches scenes).
- **Registration**: new textures load in `BootScene`, sheets live under
  `game/public/assets/`, generated units/props register in
  `art/manifest.json`; source PNGs under `art/source/`.

---

## 1. The reference: FE GBA battle-screen composition

What Sacred Stones actually does in its battle scene (the thing we remember as
"slices of platform at an angle with a background image"):

- **Canvas**: 240×160. The battle screen is a *side view*, like ours.
- **Battle background**: a full-screen painted backdrop (castle interior,
  plains, ruins…) chosen by the *map terrain the defender stands on* — up to
  ~12 per map. Sacred Stones' set is ripped at Spriters Resource ("Battle
  Backgrounds", asset 53752).
- **Battle platforms**: each combatant stands on a **terrain slice drawn in
  shallow perspective** — a trapezoid/oval "plinth" of plains grass, forest
  floor, fort stone, etc., layered *over* the backdrop. This is the
  "isometric-ish platform" memory: the ground is not a flat line but a
  perspective slice under each side's feet. (They're a distinct rip category —
  "battle platforms" — separate from backgrounds.)
- **Positioning specs** (from the GBA battle-animation tutorial): combatant
  centered ~150px from its screen edge, feet ~102px from the top of the 160px
  frame — i.e. **feet sit at ~64% of screen height**, leaving the upper ~2/3
  for backdrop and the bottom ~1/3 for platform + HUD.
- **HUD framing**: HP blocks, name plates, and weapon boxes are *drawn
  pixel-art frames* (beveled boxes with a consistent border language), not
  flat rects. The whole HUD shares one 8-ish-px border vocabulary.
- **Screen transitions**: map → battle uses a short swirl/wipe; the battle
  screen itself pans/shakes over the parallax backdrop.

Reference links (some block automated fetching but open fine in a browser):

- Sacred Stones sheet index, incl. Battle Backgrounds:
  <https://www.spriters-resource.com/game_boy_advance/fireemblemthesacredstones/>
  (backgrounds: <https://www.spriters-resource.com/game_boy_advance/fireemblemthesacredstones/asset/53752/>)
- Battle platforms discussion (what they are, where ripped):
  <https://forums.serenesforest.net/topic/94523-gba-fire-emblem-battle-platforms/>
- GBA battle-anim screen spec (240×160, platform zone, feet line):
  <https://fe-battle-animations.neocities.org/>
- Serenes Forest sprite-works resources (FE8 backgrounds + platforms):
  <https://serenesforest.net/general/sprite-works/resources/>
- Already pinned in repo: FE exposure-sheet timing writeup
  <https://lost-worlds.neocities.org/blog/2024/10/20/fire-emblem-animation/>

Mapping to our combat scene (960×540 display / 480×270 art grid): our ground
line is `GROUND_Y = 340` → feet at ~63% of screen height — **almost exactly
the FE proportion already**. The composition transplant is therefore: backdrop
painting above, platform slices under the party line and under the enemy line,
HUD band below. No layout math needs to move.

## 2. Catalogue of UI surfaces (current state)

### CombatScene (`scenes/CombatScene.ts`) — where players spend ~90% of time

| Element | Today | Source |
|---|---|---|
| Background | none — bare `#1a1210` camera color | `CombatScene` (no bg object at all) |
| Ground | single 2px rect line, `0x3a2a22` | `buildGroundLine()` |
| Spell buttons (QWER row) | 100×52 flat rects; **spell "icon" is a single monospace character** (`glyphChar`); keycap = 18×14 rect | `ui/spellBar.ts`, `ui/glyph.ts` |
| Cooldown row (Shift+QWER) | same flat-rect language | `ui/spellBar.ts` |
| Player cast bar + GCD sliver | two stacked flat rects (`ui/bar.ts`) | `buildCastBars()` |
| Boss cast sliver | 70×5 flat rect over boss | `syncBossCastBar()` |
| HP/mana bars over units | flat rects | `ui/unitSprite.ts` + `ui/bar.ts` |
| Wave banner ("WAVE 2") | 280×42 rect + stroke + text | `showWaveBanner()` |
| Result panel (wipe/victory) | 420×260 rect + stroke, text, rect Return button | `showResultOverlay()` |
| Combat log | text header + flat rect panel | `ui/combatLog.ts` |
| Speech bubbles (banter) | rounded rect + tail, monospace | `ui/speechBubble.ts` |
| Toast / focus callout / rewards / wave text | raw monospace text | various |
| Pace toggle | 56×32 rect | `ui/paceToggle.ts` |
| RunModsBar | relics: PixelLab 32px stills ✓; oaths: temp diamonds | `ui/runModsBar.ts` |
| Tooltips (spell/CD) | flat rect panel, monospace | `ui/spellTooltip.ts` |
| VFX | custom heal/zap sheets ✓; beams/particles/aura are geometric | `ui/combatFx.ts` |

### Hub / meta scenes

| Element | Today | Source |
|---|---|---|
| Hub: title, stats, XP line | raw monospace text | `HubScene.buildStats` |
| Hub: Talent Tree / Spellbook / Settings / dungeon buttons | flat rects + stroke (gold stroke = CURRENT) | `HubScene.makeButton` / `makeDungeonButton` |
| Hub: notices, wipe chooser, feedback/restart | rects + text links | `HubScene` |
| Hub: background | bare color | — |
| TreeScene: talent nodes | plain circles r=20; colored 3px line edges; rect tooltip; legend swatches | `TreeScene` |
| LoadoutScene: 4 QWER slots + picker | flat rects; spell glyph chars again | `LoadoutScene` |
| RelicScene: 3 pick cards | 240×320 flat rects (icon inside is PixelLab ✓) | `RelicScene` |
| SettingsScene: volume slider | 3 rects (track/fill/knob) | `SettingsScene` |
| TutorialScene: title + copy + one button | raw text + rect — this is the game's first impression | `TutorialScene` |
| Scene transitions | **none** — hard `scene.start()` cuts everywhere | all scenes |
| Typography | monospace system font everywhere (rendering differs per-OS) | every file |

## 3. PixelLab MCP capability map

| Capability | Tool(s) | Fit for |
|---|---|---|
| Pixel-art UI panels/buttons/bars/tabs, auto-scaffolded elements, 192–688px | `create_ui_asset` (+`get_ui_asset`) | Panel kit: spell buttons, cast-bar frame, wave banner, result panel, hub buttons, cards, tooltips, keycaps, slider |
| Pixel font → real .ttf (8/16px glyphs) | `create_font` (+`get_font`) | Replace system monospace game-wide |
| Terrain slabs in perspective (isometric/square-topdown, view-angle control, depth ratio) | `create_tiles_pro`, `create_isometric_tile` | **FE battle platforms** under party/enemy lines |
| Side-view ground strips w/ surface transition | `create_sidescroller_tileset` | Ground band replacing the 2px line |
| Autotiling top-down terrain + example map render | `create_topdown_tileset` | (less relevant — we're side-view) |
| Props/set-dressing up to 400px, style-matched via bg inpainting | `create_map_object`, `create_1_direction_object` | Backdrop layers: gate arch, ruined walls, braziers, mountain silhouettes; boss-arena dressing |
| Sprite → FE-style bust portrait | `create_portrait_character` (`character_to_portrait`) | Banter bubbles, tutorial, result panel, hub identity |
| Object/character variants preserving identity | `create_object_state`, `create_character_state` | Per-dungeon platform/panel recolors; armor tiers |
| Style-locking to existing art | `style_images` / `style_image_base64` params | Feed armored-paladin frames + relic icons so UI matches unit art |
| Cost control | `get_balance`; v3 modes cheap, `pro` 20–40/gen | Budget: 1,789 gens available |

Gap to know about: PixelLab has **no dedicated full-screen background
painter**. Backdrops must be *composed*: code-drawn sky gradient + generated
silhouette/prop layers (`create_map_object`) + tileset ground band. That's
actually FE-authentic — GBA backgrounds are layered strips, not one painting.

## 4. Prioritized proposal

Ranked by (impact on perceived quality) ÷ (effort + risk). Each item is
sized for one subagent chunk with the gates above as definition-of-done.

### 1. Combat battlefield: backdrop + FE battle platforms — **highest impact, medium effort**
- **Problem**: combat plays in a black void; a 2px line is the only ground.
  It's the screen players stare at all session, and it's the frame the
  finished 32×32 sprites are judged in.
- **Opportunity**: transplant the FE composition at our existing metrics
  (feet at `GROUND_Y=340` ≈ FE's 64% line): (a) layered backdrop — dark sky
  gradient (code), far silhouette layer + 2–3 `create_map_object` props (Ash
  Gate: charred gate arch, ember haze band); (b) one **platform slice** under
  the party line and one under the enemy line via `create_tiles_pro`
  (square_topdown, low top-down view, ~30% depth) or a wide `create_map_object`
  trapezoid; (c) keep everything behind units (`setDepth(-2)`), muted so
  sprites still pop.
- **How**: start with **one** dungeon (Ash Gate) to prove the look; template
  it as `assets/battlefields/<dungeonId>/`; later dungeons are
  `create_object_state` recolors (item 8). Presentation-only; no engine or
  layout-constant changes. ~60–120 gens with rerolls.

### 2. Pixel UI font — **global impact, low effort**
- **Problem**: system `monospace` renders differently per-OS, has no pixel
  identity, and anti-aliases at some sizes — it reads "developer placeholder"
  on every screen at once.
- **Opportunity**: one `create_font` run (8px glyphs, Regular + Bold weights,
  "weathered iron dark-fantasy" prompt) → bundled .ttf via `@font-face` +
  Phaser `fontFamily`. Sizes snap to multiples of 8/16 to keep the density
  rule. Fallback chain keeps monospace for the debug combat log.
- **How**: swap the `FONT`/`HUD_FONT` constants (they're already centralized
  per file — consider hoisting to `ui/theme.ts` while there). Verify journey
  is text-independent (it locates by name, so yes). ~2 font gens + rerolls.

### 3. Spell-bar & HUD framing kit — **high impact, medium effort**
- **Problem**: the always-on-screen combat controls are flat rects, and spell
  "icons" are single monospace characters.
- **Opportunity**: `create_ui_asset` kit (iron-and-ember panel language,
  style-referenced to relic icons): button frame (normal/armed/disabled
  treatments via tint or variants), keycap chip, cast-bar frame, tooltip
  panel. Optionally real 16×16 spell icons (`create_1_direction_object`
  batch — one call at size ≤42 yields 64 candidates) replacing glyph chars;
  keep the glyph char as the fallback for unmapped spells (relic-sprites
  pattern in `ui/relicSprites.ts` is the template).
- **How**: 9-slice or fixed-size frames authored at half display size;
  `Bar` gains an optional frame texture; button `setName`s unchanged.
  ~80–150 gens.

### 4. Shared panel/button kit for meta scenes + result panel — **medium-high impact, low-medium effort once #3 exists**
- **Problem**: Hub/Tutorial/Loadout/Relic/Settings are flat rects; the
  wipe/victory result panel — the emotional beat of every run — is a gray
  box.
- **Opportunity**: reuse item 3's panel language: large panel (result
  overlay, relic cards, tooltip), button (hub/dungeon rows, Return, slots),
  banner (wave banner, "Choose a Relic" header). One `ui/panels.ts` helper
  that swaps `add.rectangle` for a nine-sliced `add.nineslice`.
- **How**: mostly integration code; few new gens beyond #3 (~20–60).

### 5. Party portraits for banter + tutorial — **medium impact, low effort, high charm**
- **Problem**: banter bubbles are anonymous text; tutorial/hub have no faces.
  FE's identity lives in its dialogue busts.
- **Opportunity**: `create_portrait_character` (character_to_portrait) from
  the existing healer/tank/dps south stills → 32px busts; show the speaker's
  bust beside the speech bubble, on the tutorial screen, and on the result
  panel (victory = healer, wipe = tank — triggers already exist in
  `fireBanterBubble`).
- **How**: 4 portraits (~4 pro-priced gens + rerolls); `speechBubble.ts`
  gains an optional portrait param. Register in manifest.

### 6. Scene transitions — **medium impact, near-zero art cost (code only)**
- **Problem**: every scene change is a hard cut; hub → combat especially
  deserves the FE "into battle" beat.
- **Opportunity**: Phaser camera `fadeOut/fadeIn` (~150–250ms) on all
  `scene.start` seams + a chunky pixelated iris/wipe into CombatScene (shader
  or scaled-rect mosaic — must look chunky, not smooth, per style bible).
  Wave banner slide+hold gets the same easing language.
- **How**: small `ui/transitions.ts`; journey unaffected (objects exist at
  create-time; keep total transition <400ms to stay inside its 2s poll).
  Zero gens.

### 7. Talent-tree node & edge dressing — **medium impact, medium effort**
- **Problem**: the build-identity screen is circles and colored lines.
- **Opportunity**: node frames from `create_ui_asset` (circle pieces):
  socket states locked/affordable/owned; edges become chain/rune-groove
  textures (tileable strip, tinted per `EdgeState` — palette already
  four-state); keep layout + `layoutFromGrid` untouched.
- **How**: ~40–80 gens; `TreeScene` swaps circle/line draws for sprites.

### 8. Per-dungeon battlefield variants — **medium impact, low marginal effort after #1**
- **Problem**: once Ash Gate has a battlefield, other dungeons will feel
  wrong in the void.
- **Opportunity**: `create_object_state` recolors of item 1's platform +
  props per dungeon family (iron pass = cold iron/snow, maw = bone/void…),
  keyed off `encounterId` the way music/mobs already resolve.
- **How**: ~30–60 gens per dungeon; data-driven lookup table
  (`assets/battlefields/` + a `battlefieldForEncounter()` in ui/).

### 9. Title / tutorial dress-up — **lower impact (seen once), low effort**
- Wordmark via `create_ui_asset` or the new font at display size, healer
  portrait (from #5), panel kit (from #4). Do last; it inherits everything.

**Suggested order**: 2 → 1 → 3 → 4 → 5 → 6 → 7 → 8 → 9. (Font first only
because it's a one-day global win and de-risks text metrics before panels are
sized; 1 is the flagship.) 6 can slot in anywhere as a code-only chunk.

## 5. Subagent handoff notes

For any approved item, the chunk brief should pin:

1. **File ownership**: which scene/ui files + `public/assets/` subfolder the
   chunk owns; no combat/data/tree edits.
2. **Contracts**: interactive `setName`s frozen; layout constants
   (`GROUND_Y`, slot Xs, `SPELL_BAR_Y`…) frozen unless the item says
   otherwise; `Bar`/widget public APIs additive-only.
3. **Art process**: prompts + accepted asset IDs recorded in
   `artifacts/pixellab-<item>/README.md` (existing convention); source PNGs
   in `art/source/`; `art/manifest.json` updated; density + palette rules
   from `art/STYLE.md`; style-reference the armored-paladin/relic art in
   every generation call.
4. **Gates**: `npm run verify` green (scenes touched ⇒ full gate, includes
   journey); screenshot via `npm run smoke -- --shots` for visual review.
5. **CLAUDE.md**: extend the temp-art exception list to name the new asset
   class, same sentence style as the relic-icons exception.
