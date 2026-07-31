# GitHub stacked pull requests

Status: current · Authority: none — agent/ops note · Last verified: 2026-07-31

GitHub stacked PRs ([public preview](https://github.blog/changelog/2026-07-30-stacked-pull-requests-are-now-in-public-preview/))
break a large change into an ordered chain of small PRs. Each PR targets the
branch below it; reviewers see only that layer's diff. Merge bottom-up, or
merge the top ready PR to land the whole stack.

Docs: [about stacked PRs](https://docs.github.com/en/pull-requests/get-started/about-stacked-prs) ·
CLI: [github/gh-stack](https://github.com/github/gh-stack) · https://gh.io/stacks

## Install (local)

Requires GitHub CLI (`gh`) ≥ 2.90 and an authenticated `gh auth login`.

```bash
bash scripts/setup-gh-stack.sh
# optional: refresh the committed agent skill from upstream
bash scripts/setup-gh-stack.sh --skills
```

That installs/upgrades the `gh stack` extension and sets `rerere` /
`remote.pushDefault` so agent workflows stay non-interactive.

## Install (Cursor Cloud)

[`.cursor/environment.json`](../.cursor/environment.json) runs the same
bootstrap on VM startup (before `game/` npm + Playwright). Cloud agents
already have `gh`; the install script only needs network access to
`github.com` (this environment allows it).

The agent skill is committed under:

- [`.claude/skills/gh-stack/`](../.claude/skills/gh-stack/) — Claude / existing healgame skills
- [`.agents/skills/gh-stack/`](../.agents/skills/gh-stack/) — Cursor / Copilot shared path

Read that skill before driving `gh stack` as an agent.

## Everyday workflow

```bash
# From main (or your trunk)
gh stack init cursor/my-feature-bottom-efa9
# ... edit, git add, git commit ...

gh stack add cursor/my-feature-top-efa9
# ... edit, git add, git commit ...

gh stack push
gh stack submit --auto          # agents: always --auto
gh stack view --json            # agents: always --json (never bare view)
```

Non-interactive rules (from the skill): always pass branch names to
`init` / `add` / `checkout`; always use `submit --auto` and `view --json`.

## Cloud agents and PR creation

Cursor Cloud's built-in `ManagePullRequest` tool creates/updates PRs for this
repo. The cloud `gh` token is often **read-only** for PR writes, so prefer:

1. `gh stack init` / `add` / `push` for local branch tracking and remotes
2. `ManagePullRequest` with `base_branch` set to the layer below (bottom →
   `main`, next → previous branch name)
3. If `gh stack submit` works in your session, use `gh stack submit --auto`
   instead — it creates the GitHub Stack object that links the PRs

To link already-open PRs into a stack without local tracking:

```bash
gh stack link <bottom-branch-or-pr> <next-branch-or-pr> [...]
```

## Merging

- **Do not** use `gh pr merge` on stacked PRs.
- Prefer `gh stack merge --yes` (optionally `--squash` / `--merge` /
  `--rebase`), or merge from the GitHub UI stack map.
- Merge bottom-up, or merge a mid/top PR to land everything below it.
- This repo has `delete_branch_on_merge: true`; remaining open layers
  retarget automatically after a lower layer lands.

See also [`github-automerge.md`](github-automerge.md) for the separate
auto-merge enable quirk (`Allow auto-merge` ≠ merge on ready).

## Quality gate reminder

Stacked or not, code changes still need `npm run verify` / `verify:fast`
from `game/` before merge ([`AGENTS.md`](../AGENTS.md)).
