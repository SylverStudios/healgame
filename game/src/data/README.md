# Dungeon content authoring

Status: current · Authority: enemy ability, mob, dungeon, validation, assembly, and preview contracts · Last verified: 2026-07-12

Dungeon content is typed TypeScript data. The game and authoring tools consume
the same validated catalogs; there is no generated file or second JSON/YAML
source of truth.

## Authoring flow

1. Define a supported enemy mechanic in `enemyAbilities/` and register it in
   that directory's `index.ts`. Ability `kind` selects engine behavior; the
   remaining fields are deterministic parameters.
2. Define a reusable enemy in `mobs/` and register it. A mob owns its stable
   ID, display name, boss/trash tag, base stats, visual key, and ability IDs.
3. Define a dungeon in `dungeons/`, register it, and add its ID to the explicit
   `DUNGEON_ORDER`. Dungeons contain ordered mob groups. The final wave must be
   one boss-tagged mob with count 1.
4. Run:

   ```bash
   npm run content -- validate
   npm run content -- preview <dungeon-id>
   npm run content -- preview --all
   npm run verify
   ```

Use `statOverrides` only for encounter tuning that intentionally differs from
a mob's base profile. Preview output always prints effective values and calls
out overrides.

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

## Validation

`validateContent` collects all errors before failing: IDs and references,
integer ranges, ability cadence, visual keys, explicit order and unlock graph,
wave shape, boss placement, runtime ability limits, and unused-content
warnings. TypeScript checks structure; Vitest checks validation, assembly,
legacy-equivalent combat values, deterministic simulations, and preview text.

The CLI is intentionally read-only. Add new content files by hand so reviews
show normal TypeScript diffs; defer source-writing scaffolds until the schema
has survived another expansion.
