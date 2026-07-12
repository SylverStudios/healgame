# Semantic click targets — handoff

Status: planning · Authority: this change's scope · Last verified: 2026-07-11

**Audience:** whoever decouples `journey.mjs` from pixel coordinates. Read
after `CLAUDE.md` / `AGENTS.md`. This doc wins on this change's scope;
`poc-spec.md` still wins on gameplay rules. Party hotkeys stay out
(poc-spec §4/§9) — this change removes the test-side pressure to add them.

**Baseline:** side-view layout branch (PR #3) merged. The `UI` coordinate
table at the top of `game/scripts/journey.mjs` duplicates scene layout
constants; every layout change breaks it (CLAUDE.md hard rule "Layout
constants ↔ journey.mjs" exists solely to manage that coupling — this
change deletes the coupling and retires the rule).

## Mission

Give every interactive game object a stable semantic name via Phaser's
built-in `GameObject.setName()`, expose one tiny runtime hook that resolves
name → canvas coordinates, and rewrite `journey.mjs` to click/hover by name.
After this, a layout change requires **zero** `journey.mjs` edits.

## Why

- The `UI` table is the one place where "numbers are data" fails: it's
  layout data hand-copied into a test. The side-view phase proved the cost
  (stale `combatTank`, and the spell-slot entry literally re-derives
  `spellBar.ts`'s centering formula).
- Alternatives evaluated and rejected (analysis 2026-07-11): a headless
  engine-driving CLI re-proves what `balance.test.ts` already proves and
  misses journey's actual job (scene wiring, transitions, save flow); a
  shared layout-constants module needs a Phaser-free module split plus a TS
  loader for `journey.mjs` and still can't cover dynamic positions; a DOM
  test-id overlay is polish creep for a canvas PoC.
- Name lookup keeps **real mouse clicks through real Phaser hit-testing**
  (unlike synthetic `emit('pointerdown')`), so journey still catches
  "rendered but not clickable" bugs. It also fixes journey's blind
  Return-click hack: `locate('combatReturn')` returns `null` until the
  result overlay exists, so the click becomes conditional instead of
  speculative every 2 s.

## Done means (user-observable = journey-observable)

1. `window.__healgame.locate(name)` resolves every name in the table below
   when its object is on an active scene and visible; `null` otherwise.
2. `journey.mjs` contains no hard-coded click/hover coordinates — the `UI`
   table is deleted; every interaction goes through `clickNamed` /
   `hoverNamed` helpers.
3. The blind Return click in `playCombat()` is conditional on
   `locate('combatReturn')`.
4. Gates green: `npm run check`, `npm run smoke`, `node scripts/journey.mjs`.
5. CLAUDE.md's "Layout constants ↔ journey.mjs" hard rule is replaced with
   the new invariant (interactive objects carry `setName`; journey resolves
   at runtime). `poc-qa.md` gets a QA note; this handoff → `historical`.
6. Acceptance probe: change `GROUND_Y` by ±20 locally, journey still passes
   unmodified, revert. (Proves the regression this phase exists to fix.)

## Locked decisions

### A — Hook API (pin exactly)

New module `game/src/debug/testHooks.ts`, installed once from `main.ts`
(`const game = new Phaser.Game({...}); installTestHooks(game);` — capture
the instance, currently discarded).

```ts
declare global {
  interface Window {
    __healgame?: {
      /** Center of the first visible object named `name` on any active
       *  scene, in game-world px (= canvas px; 960×540 fixed). */
      locate(name: string): { x: number; y: number } | null;
      /** All names currently resolvable — for debugging journey failures. */
      list(): string[];
    };
  }
}
export function installTestHooks(game: Phaser.Game): void;
```

- Search `game.scene.getScenes(true)` (active scenes), walking each scene's
  display list and recursing into `Container`s. Match `obj.name === name`
  and `obj.visible !== false`; resolve center via `obj.getBounds()` (already
  applies the full world transform, so `TreeScene`'s `nodesContainer`
  children just work). First match wins — names must be unique among
  simultaneously visible objects; the namespaced scheme below guarantees it.
- Ships in the production build on purpose: journey and smoke drive
  `vite preview`, not dev mode. It is invisible, inert (a read-only lookup),
  and player-inaccessible — test plumbing, not UX, so it does not reopen
  the party-hotkeys scope decision.
- Coordinate mapping: journey keeps its 960×540 page viewport, where
  `Scale.FIT` renders 1:1 and world px == page px (same assumption the old
  `UI` table relied on). Do NOT add ScaleManager math for other viewports —
  out of scope.

### B — Name table (pin exactly; namespaced `scene:` prefixes make
collisions impossible)

| Name | Object | Where |
|---|---|---|
| `tutorialLearn` | learn-button rect | `TutorialScene.ts` create() |
| `hubAshGate` / `hubTree` / `hubMaw` | button rects | `HubScene.ts` — add a `name` parameter to the shared `makeButton()` factory; Maw button is conditional on unlock, that's fine (locate → null until it exists) |
| `hubRestart` | restart text label | `HubScene.ts` `buildRestartControl()` (journey doesn't use it today; tag it anyway — it's the only other hub interactive) |
| `treeNode:<spotId>` | node bg rect | `TreeScene.ts` node render (`spot.id` is in scope; ids are the `SPELL_TREE_POSITIONS` keys, e.g. `treeNode:deep-reserves`) |
| `treeBack` | back-button rect | `TreeScene.ts` `buildBackButton()` |
| `combatAlly:<unitId>` | sprite body image, only when `clickable` | `unitSprite.ts` (e.g. `combatAlly:tank`) |
| `combatSpell:<spellId>` | SpellButton bg rect | `spellBar.ts` (`spell.id` is in scope) |
| `combatReturn` | Return rect in the result overlay | `CombatScene.ts` `showResultOverlay()` |
| `combatLogToggle` | log header text | `ui/combatLog.ts` (unused by journey today; tag for future stages) |

Do NOT name: `TreeScene`'s full-screen disarm backdrop, the result-overlay
blocker rect, decorative text/bars. Named = "a test may aim here."

### C — Journey rewrite (mechanical mapping)

Helpers (top of `journey.mjs`):

```js
const locate = (page, name) =>
  page.evaluate((n) => window.__healgame?.locate(n) ?? null, name);
async function clickNamed(page, name) {
  const pos = await locate(page, name);
  if (!pos) {
    const names = await page.evaluate(() => window.__healgame?.list() ?? []);
    throw new Error(`no visible target "${name}"; visible: ${names.join(', ')}`);
  }
  await page.mouse.click(pos.x, pos.y);
}
// hoverNamed: same, with page.mouse.move
```

| Old `UI` entry | New call |
|---|---|
| `tutorialLearn` | `clickNamed('tutorialLearn')` |
| `combatTank` (380, 308) | `clickNamed('combatAlly:tank')` |
| `combatReturn` blind 2 s click | `if (await locate(page, 'combatReturn')) clickNamed(...)` in the poll loop |
| `combatSpellSlot(i, n)` formula | `hoverNamed('combatSpell:<solemn-vigil id>')` — read the exact id from `data/spells.ts`, stop caring about slot count |
| `hubAshGate` / `hubTree` / `hubMaw` | same names |
| `treeDeepReserves` / `treeVigilOath` / `treeZealotOath` / `treePatientVow` | `treeNode:<spotId>` — read exact spot ids from `SPELL_TREE_POSITIONS` in `TreeScene.ts` |
| `treeBack` | `clickNamed('treeBack')` |

Spell casts stay hotkey-driven; save assertions stay `localStorage`-driven —
neither touches this change.

### D — What this is not

No visible UI change of any kind (pixel-identical screenshots). No waiting/
retry framework — journey's existing pacing stays; `locate` null-vs-position
is the only new signal. No renaming of scenes/spots/units to suit tests.

## Out of scope

- Party/combat hotkeys as player UX (still requires explicit reopen)
- ScaleManager-aware coordinate mapping for arbitrary viewports
- DOM/a11y overlay, Playwright locators, screenshot diffing
- Any change under `src/combat/`, `src/data/`, `src/meta/`, `src/save/`
- Naming non-interactive objects "while we're in there"

## Chunks

| id | what | depends on | owns | who |
|----|------|------------|------|-----|
| 0 | **CENTRAL.** Baseline gates green post-PR-#3 merge; bible = this doc | — | verify only | central |
| 1 | `testHooks.ts` + `installTestHooks` in `main.ts` + every `setName` in table B | 0 | CREATE `src/debug/testHooks.ts` · MAY EDIT `main.ts`, `TutorialScene.ts`, `HubScene.ts`, `TreeScene.ts`, `CombatScene.ts`, `unitSprite.ts`, `spellBar.ts`, `combatLog.ts` · DO NOT TOUCH `journey.mjs`, engine, data, save | subagent |
| 2 | Journey rewrite per table C; delete `UI` table; conditional Return | 1 | `journey.mjs` only | subagent |
| 3 | **CENTRAL.** CLAUDE.md rule swap; poc-qa QA note; this handoff → historical; GROUND_Y ±20 acceptance probe; full gates | 2 | docs + verify | central |

Sequential (chunk 2 consumes chunk 1's names). Pinned contract chunk 1 → 2:
the name table above is exhaustive and exact — chunk 1's report must confirm
each name landed verbatim plus the actual spot/spell/unit ids discovered, so
chunk 2 never guesses an id.

Chunk 1 definition of done: `npm run check` + `npm run smoke`, plus a
throwaway Playwright probe (not committed) asserting `locate('hubAshGate')`,
`locate('treeNode:<first spot id>')`, and `locate('combatAlly:tank')` return
non-null on their scenes and `locate('combatReturn')` is null mid-fight.
Chunk 2 definition of done: full `node scripts/journey.mjs` green and
`grep -n 'x:' scripts/journey.mjs` shows no coordinate table.

## Effort

M overall — chunk 1 is ~40 lines of new module + ~10 one-line `setName`
edits; chunk 2 is a mechanical dozen-call-site rewrite; the risk lives in
name/id typos, which the pinned id-discovery contract and the chunk-1 probe
exist to kill.
