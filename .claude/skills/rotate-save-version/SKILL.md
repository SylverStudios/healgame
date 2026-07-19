---
name: rotate-save-version
description: Rotate the healgame SaveData localStorage key when the save shape changes. Use for any change to SaveData fields, defaults, or serialization — adding a field counts.
---

# rotate-save-version

`SaveData` is versioned by localStorage key (`healgame-save-vN`). Development
policy is rotate-and-delete, never migrate.

1. Bump the key in `game/src/save/save.ts` (vN → vN+1) and update the header
   comment that documents the shape.
2. Confirm `loadSave` deletes stale or unrecognized keys, including the one
   you just retired.
3. `game/scripts/journey.mjs` hardcodes `SAVE_KEY` and seeds save objects —
   update them in the **same commit**. Known footgun: forgetting this fails
   journey with a silently-deleted stale save, not an obvious error.
4. Sweep: `grep -rn "healgame-save-v" game/src game/scripts` — only the new
   version may appear.
5. Note the rotation and its reason in `docs/poc-qa.md`.
6. Run full `npm run verify` — journey is the only stage that exercises the
   real save path in a browser.
