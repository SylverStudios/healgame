---
name: ship-phase
description: Close out a shipped healgame phase — doc lifecycle, changelog, handoff retirement, worktree cleanup. Use when a phase/release PR has merged, or the user asks to close out / wrap up a phase or release.
---

# ship-phase — close out a shipped phase

Run from the repo root after the phase's PR merges. Every step is required —
the v0.3 ship skipped several, which left a `Status: planning` handoff acting
as the repo's highest-authority doc for months of agent sessions.

1. **Gate**: confirm CI's `npm run verify` was green on the merged PR.
2. **QA log**: append the phase's decided micro-choices and tuning notes to
   `docs/poc-qa.md`; bump its `Last verified`.
3. **Changelog**: prepend a short entry to `docs/CHANGELOG.md` (newest first).
4. **Retire the handoff** (`docs/*-handoff.md`): first make sure it is
   *committed* — an untracked handoff has no git history to preserve it —
   then delete it in a follow-up commit. Never leave `Status: planning` on
   shipped work.
5. **Module docs**: update any touched contracts (`game/src/tree/AGENTS.md`,
   `game/src/combat/README.md`, `game/src/data/README.md`) and bump their
   `Last verified`.
6. **Save shape changed this phase?** Confirm the version rotation shipped —
   see the `rotate-save-version` skill.
7. **Worktree cleanup**: `git worktree list`; remove the phase's worktree and
   delete its merged branch.
8. **Sweep**: `grep -rn "Status: planning" docs/` must return nothing.
9. Commit the doc closeout as one commit ("Close out <phase>.").
