---
name: add-interactive-control
description: Add or rename a clickable/hoverable GameObject so the journey test can drive it by name. Use whenever a scene gains an interactive control, or an existing one is renamed or removed.
---

# add-interactive-control

Journey drives the game through semantic names resolved by
`window.__healgame.locate(name)` — never coordinates. A new control is not
done until journey can click it by name.

1. Call `setName('<stable-name>')` on the GameObject. Names are kebab-case,
   describe the control's role (not its position), and stay stable across
   layout changes.
2. Add a row to the table in `docs/semantic-targets.md` (remove rows for
   deleted controls; bump `Last verified`).
3. If a journey stage should exercise the control, drive it with
   `clickNamed` / `hoverNamed` in `game/scripts/journey.mjs` — by name only.
   A layout change must never require a journey coordinate edit; if it does,
   the control is missing a name.
4. Verify with full `npm run verify` (journey is the stage that proves it).
