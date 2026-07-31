#!/usr/bin/env bash
# Install GitHub stacked-PR tooling for local and Cursor Cloud agents.
# Safe to re-run. Does not touch game/ npm deps (see .cursor/environment.json).
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "error: GitHub CLI (gh) is required. Install from https://cli.github.com/" >&2
  exit 1
fi

# Prefer install; fall back to upgrade if already present.
if gh extension list 2>/dev/null | grep -q $'\tgithub/gh-stack\t\|^gh stack\t'; then
  gh extension upgrade gh-stack >/dev/null
  echo "gh-stack: upgraded"
else
  gh extension install github/gh-stack
  echo "gh-stack: installed"
fi

# Avoid interactive prompts from gh stack / git during agent workflows.
git config rerere.enabled true
# Only set pushDefault when origin exists (skips remote picker with multiple remotes).
if git remote get-url origin >/dev/null 2>&1; then
  git config remote.pushDefault origin
fi

# Optional: refresh the committed agent skill from upstream.
# Pass --skills to also install/update into .agents/skills and .claude/skills.
if [[ "${1:-}" == "--skills" ]]; then
  root="$(cd "$(dirname "$0")/.." && pwd)"
  cd "$root"
  gh skill install github/gh-stack gh-stack --agent cursor --scope project -f
  gh skill install github/gh-stack gh-stack --agent claude-code --scope project -f
  echo "gh-stack skill: installed/updated (project scope)"
fi

echo "Stacked PRs ready. Try: gh stack --help"
echo "Docs: https://gh.io/stacks · skill: .claude/skills/gh-stack (and .agents/skills/gh-stack)"
