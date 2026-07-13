# Dungeon content authoring

Status: current · Authority: enemy ability, mob, dungeon, validation, assembly, and preview contracts · Last verified: 2026-07-13

Dungeon content is typed TypeScript data. The game and authoring tools consume
the same validated catalogs; there is no generated file or second JSON/YAML
source of truth.

## Authoring flow

1. Define a supported enemy mechanic in `enemyAbilities/<id>.ts`, then import
   and append it to `ENEMY_ABILITIES` in that directory's `index.ts`. Ability
   `kind` selects engine behavior; the remaining fields are deterministic
   parameters.
2. Define a reusable enemy in `mobs/<id>.ts`, then import and append it to
   `MOBS`. A mob owns its stable ID, display name, boss/trash tag, base stats,
   visual key, and ability IDs.
3. Define a dungeon in `dungeons/<id>.ts`, import and append it to `DUNGEONS`,
   and add its ID to the explicit `DUNGEON_ORDER`. Its `order` is the 1-based
   position in that tuple. Dungeons contain ordered mob groups. The final wave
   must be one boss-tagged mob with count 1.
4. Run:

   ```bash
   npm run content -- validate
   npm run content -- preview <dungeon-id>
   npm run content -- preview --all
   npm run verify:fast
   # Run full `npm run verify` when progression, scenes, or journey targets change.
   ```

Use `statOverrides` only for encounter tuning that intentionally differs from
a mob's base profile. Preview output always prints effective values and calls
out overrides.

## Integration checklist

- Register every ability, mob, and dungeon `visualKey` in
  `content/catalogs.ts` `VISUAL_KEYS`. Ability and dungeon visual keys are
  validation/preview metadata today; boss VFX are driven by engine events for
  the ability `kind`.
- For a new mob art key, extend `MOB_VISUAL_KEYS` in `content/types.ts` and
  `MOB_VISUAL_FRAMES` in `ui/sprites.ts`; see `docs/unit-art.md`. Reusing an
  existing visual key needs no sprite change.
- Set `unlock: { kind: 'dungeonClear', dungeonId }` to an earlier dungeon.
  When inserting into the middle of the chain, update the downstream
  dungeon's prerequisite too. Normal appends auto-wire Hub buttons,
  first-clear rewards, and unlock checks from the ordered catalog.
- Update `content/content.test.ts` pinned compiled values when shipped content
  changes. Update `content/cli.test.ts` counts and output strings whenever the
  catalog size/order changes. `ui/sprites.test.ts` enforces mob art coverage.
- Add deterministic cases to `combat/balance.test.ts` for content that defines
  a new difficulty gate, then record the result in `docs/poc-qa.md`.
- If a journey stage must click a new or reflowed button, update the `UI`
  coordinates in `scripts/journey.mjs` per the repository layout rule.

## Runtime boundary

`content/compile.ts` resolves authoring references into `EncounterDef`. Only
the resolved form reaches `CombatEngine`; the engine never performs catalog
lookups. `data/encounters.ts` is the live registry and fails during module
loading when catalog validation fails.

The current runtime supports at most one scheduled ability on a boss
(`partyAoE` or `tunnelVision`) and no active trash abilities. Add a
discriminated `EnemyAbilityDef` member together with its engine behavior
before authoring content that uses another mechanic. Do not turn ability data
into an arbitrary scripting language.

Reusing `partyAoE` or `tunnelVision` requires data changes only. A new `kind`
also requires coordinated changes in `content/types.ts`, `validate.ts`,
`compile.ts`, `preview.ts`, `combat/types.ts` (`BossCastDef`),
`combat/engine.ts`, `combat/README.md`, mechanic tests, and any new event/VFX
handling in `scenes/CombatScene.ts`.

## Validation

`validateContent` collects all errors before failing: IDs and references,
integer ranges, ability cadence, visual keys, explicit order and unlock graph,
wave shape, boss placement, runtime ability limits, and unused-content
warnings. TypeScript checks structure; Vitest checks validation, assembly,
legacy-equivalent combat values, deterministic simulations, and preview text.

The CLI is intentionally read-only. Add new content files by hand so reviews
show normal TypeScript diffs; defer source-writing scaffolds until the schema
has survived another expansion.
