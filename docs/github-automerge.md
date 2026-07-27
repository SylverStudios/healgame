# GitHub auto-merge — what the repo setting actually does

Status: current · Authority: none — agent/ops note · Last verified: 2026-07-27

Verified against healgame on 2026-07-27 while landing Playtest Wave 3
([#42](https://github.com/SylverStudios/healgame/pull/42)–[#44](https://github.com/SylverStudios/healgame/pull/44)).

## Short answer

Repo setting **Allow auto-merge** (`allow_auto_merge: true`) only *unlocks*
the feature. It does **not** merge a PR just because you mark it ready and CI
is green.

You still need a **per-PR** auto-merge enable (UI “Enable auto-merge”, or
`gh pr merge --auto …`). Until that flag is set, a ready + green PR sits open.

## What agents should do

Cloud / Cursor PR tools often open PRs as **draft**. Drafts cannot use
auto-merge. Sequence:

```bash
gh pr ready <n>                 # leave draft
gh pr merge <n> --auto --merge  # queue (or merge now if checks already green)
```

Notes:

- If **required** checks are already green, `--auto` usually merges
  **immediately** (you may not see a lingering `autoMergeRequest` afterward).
- If required checks are still running, `--auto` waits until they pass, then
  merges.
- **healgame currently has no branch rulesets / required status checks on
  `main`.** In that configuration, `gh pr merge --auto --merge` can land
  **before** `verify` finishes (observed on the doc PR that added this file).
  Do not treat a successful merge as proof CI was green — check the Actions
  run, or keep merging only after `verify` succeeds locally / on the PR.
- Prefer `--merge` / `--squash` / `--rebase` explicitly so the method is pinned.
- This repo has `delete_branch_on_merge: true`.

## Stacked PRs

Merge **bottom-up** (base of the stack into `main` first).

When the merged branch is deleted, GitHub typically **retargets** the next PR’s
base from the deleted stack branch onto `main`. Confirm with
`gh pr view <n> --json baseRefName` before enabling auto-merge on the next one
— do not auto-merge a PR into a temporary stack branch if the intent is `main`.

## What “ready + CI green” alone does

| Step | Effect |
|------|--------|
| Mark ready (`gh pr ready`) | Leaves draft; still no merge |
| CI green | Satisfies checks; still no merge |
| Repo Allow auto-merge | Lets you *enable* per-PR auto-merge |
| `gh pr merge --auto` / UI enable | Actually queues or merges |

## Related

- Quality gate for the code itself: `npm run verify` from `game/` (see
  [`AGENTS.md`](../AGENTS.md) / [`CLAUDE.md`](../CLAUDE.md)).
- This note is ops hygiene for agents, not a gameplay contract.
