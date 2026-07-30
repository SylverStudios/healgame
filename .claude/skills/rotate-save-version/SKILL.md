---
name: rotate-save-version
description: Rotate the healgame SaveData localStorage key when the save shape changes. Use for any change to SaveData fields, defaults, or serialization — adding a field counts.
---

# rotate-save-version

`SaveData` compatibility is a single integer in
`game/src/save/save-version.json` (`schema`). That drives `SAVE_KEY`
(`healgame-save-vN`), `SaveData.version`, and `game/package.json`
(`0.<schema>.<patch>`). Development policy remains rotate-and-wipe — no soft
migration.

**Do not hand-edit the schema integer.** The bump script is the source of
truth for rotation.

## Flow

1. Change `SaveData` / `validateSaveData` (formerly `isSaveData`) as needed.
2. Run `npm run verify:fast` (or `npm run save:compat`) from `game/`.
   - If the golden fixture still validates → no bump (compatible change).
   - If incompatible → local verify runs `npm run save:bump` once, rewrites
     the fixture from `newSaveData('lattice')`, and continues.
3. Commit the bumped files with the breaking change:
   - `src/save/save-version.json`
   - `src/save/fixtures/golden-save.json`
   - `src/save/save.ts` (`LEGACY_SAVE_KEYS` append)
   - `package.json` / `package-lock.json` (version `0.N.0`)
4. On CI save-compat failure: run `npm run save:bump` locally and commit
   (CI never writes bumps — `CI=true` fails closed).

## Manual bump

```bash
cd game && npm run save:bump
```

## Optional

Note the rotation reason in `docs/poc-qa.md` on ship. Not required for every
infra bump.

## How to prove the loop

Temporarily require a fake field in `validateSaveData`, run
`npm run save:compat` (expect exit 2), then `npm run save:bump` (or
`verify:fast`), confirm schema N→N+1 and fixture refresh, then **revert the
fake validation break** before committing unless the break is intentional.
