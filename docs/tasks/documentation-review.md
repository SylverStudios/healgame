# Repository documentation review

Status: current · Authority: repeatable maintenance task · Last verified: 2026-07-13

## Goal

Audit every canonical documentation file in this repository and explain whether
the documentation system remains trustworthy, current, well organized, and
non-redundant. This is a read-only review: do not edit, move, rename, or delete
repository files unless the user separately asks for remediation.

## Read first

1. `AGENTS.md` — documentation conventions and authority hierarchy.
2. `CLAUDE.md` — operating rules, gates, and codebase map.
3. Any `Status: planning` handoff — the active mission, if one exists.

Do not assume an indexed "active mission" is actually active. Verify its
frontmatter.

## Scope

1. Inventory all tracked Markdown and repository guidance files, including:
   - root entry points and governance (`README.md`, `AGENTS.md`, `CLAUDE.md`);
   - everything under `docs/`;
   - colocated module contracts such as `README.md` or `AGENTS.md`;
   - agent skills or task docs that use their own required format.
2. Exclude dependencies, generated files, and ephemeral worktrees from the
   canonical inventory. Report shadow copies only when they create a realistic
   stale-document risk.
3. Inspect code, tests, package scripts, and data files as needed to verify
   claims in current docs. Documentation status is not evidence by itself.

## Review dimensions

For every canonical document, assess:

- **Convention compliance:** required `Status`, `Authority`, and
  `Last verified` fields; valid status value; frontmatter placement; naming and
  location.
- **Authority safety:** conflicts in the precedence chain, stale active-mission
  pointers, historical documents that still appear executable, and ambiguous
  source-of-truth ownership.
- **Accuracy:** claims that disagree with shipped code, tests, data, commands,
  save versions, layouts, progression, or current product scope.
- **Lifecycle hygiene:** living docs not refreshed after a shipped phase,
  planning docs not closed, and historical docs that need a supersession note.
- **Organization:** misplaced files, flat-directory sprawl, inconsistent
  naming, missing archive/index structure, and broken internal links or assets.
- **Redundancy:** duplicate sources of truth versus intentional layers such as
  planning handoff plus post-ship QA record.
- **Coverage:** important shipped contracts that have no durable living
  documentation or update trigger.

Treat historical documents as era snapshots. Do not call an old claim a defect
merely because code later changed; report it only when status, links, banners,
or surrounding language could cause a reader or agent to mistake it for live
guidance.

## Required evidence

- Build the canonical inventory from tracked files, not only filename globs.
- Cite exact repository paths and line numbers for every actionable finding.
- Pair stale claims with concrete code, test, data, or higher-authority doc
  evidence.
- Verify internal links and referenced assets exist.
- Distinguish confirmed defects from recommendations and uncertainties.
- Preserve unrelated working-tree changes and report the pre-existing state.

## Deliverable

Produce one structured audit containing:

1. **Executive summary** — overall trustworthiness and the highest-risk issue.
2. **Documentation pattern** — explain the authority stack, status lifecycle,
   phase handoffs, cumulative QA/amendment log, colocated module contracts,
   historical/research roles, code-owned numbers, and verification gates.
3. **Complete inventory** — every canonical doc, category, status, authority,
   and compliance result.
4. **Prioritized findings** — critical/high/medium/low, with evidence and
   impact. Cover what is out of date, misplaced, nonconforming, redundant, or
   missing.
5. **Target organization** — a concrete proposed directory and naming scheme;
   identify move, merge, archive, delete, and keep-as-is candidates.
6. **Remediation sequence** — small, reviewable batches ordered to restore
   agent safety first, then accuracy, organization, and cleanup.
7. **Uncertainties** — decisions that require repository-owner input.

End with a short list of documents that are healthy and should remain
unchanged. Do not implement the remediation as part of this task.
