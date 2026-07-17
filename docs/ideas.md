# Idea backlog

Status: current · Authority: none — uncommitted ideas for future exploration · Last verified: 2026-07-17

These are prompts to revisit, not approved scope or implementation requirements.
Living specs and active phase handoffs take precedence. This file is **not** a
`Status: planning` handoff.

## Art direction

- Explore *Fire Emblem: The Sacred Stones*–style pixel art and combat
  animations as a visual reference.
- Keep *The Last Spell* in the reference set, especially for its darker,
  apocalyptic tone.

## Progression

- Explore a *Fire Emblem*–style evolution or promotion system as a replacement
  for the current Oath choice.
- Alternative: retain Oaths, but make choosing an Oath one step in a broader
  evolution path.
- Before committing, compare how each option affects build identity, timing,
  player choice, and the existing spell tree.
- Bonuses land too fast — introduce power more slowly.
- Tree felt linear after the first real choice; more meaningful forks.
- Class / multi-tree system later; make the current tree fun first.
- Need a system that improves DPS meaningfully.

## Dungeon structure and combat

- Add a small dungeon map at the top of the combat screen that shows the
  remaining enemy groups and the boss room.
- Frame regular encounters as *pulls*, not waves, to make each dungeon feel
  more like progressing through a *World of Warcraft* dungeon.
- Future extension: let the player eagerly pull the next group into the current
  fight, trading speed for the danger of overlapping encounters.
- Supporting overlapping pulls would require a readable way to display and
  distinguish many mobs on screen at once.
- Better wave / success / failure transitions; consider dropping the landing
  splash and starting on the spell tree (or a diegetic hub walk).

## UX / presentation

- Relic hover affordance (clearer than icon alone).
- Cooldown buttons: hover detail + keybind parity with spells.
- Tunnel Vision: top-of-screen callout + clearer target-style icon.
- Frenzied Liturgy: recovery lockout after the buff expires so it cannot be
  chained forever.
- Spell tree readability (icons + hover already partly shipped; keep iterating).

## Release process

- Produce a representative screenshot of every Scene for each release.
- Keep the screenshots together as a visual release record so regressions and
  presentation changes are easy to review.
