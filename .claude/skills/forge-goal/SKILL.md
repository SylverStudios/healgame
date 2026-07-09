---
name: forge-goal
description: Compile a project brief into a central-agent goal statement ready for /goal in a fresh session. Use when the user hands over phase/project content (spec, chunk layout, mission) and wants an orchestration prompt with delegation protocol and deterministic quality gates built in.
---

# forge-goal — compile a brief into a /goal statement

Your job: take the content the user gives you (task description, spec pointers,
and optionally a chunk layout), understand it, and produce **one excellent goal
statement** the user pastes into `/goal` in a new session. The agent receiving
that goal becomes the central delegator; your output determines whether it
succeeds. This playbook is distilled from the Phase 1 PoC run (see
`docs/phase-1-poc-outcome.md` if in the healgame repo), which shipped 6/6
chunks with all gates green.

## Step 1 — Understand before writing

1. Read the content passed as arguments (or in the conversation). If none was
   given, ask for it and stop.
2. Read the repo's `CLAUDE.md` and any spec docs the content references. Note
   the doc authority order if one exists.
3. Extract, or derive, these five things. If any is genuinely undecidable from
   the content and repo, ask the user **now** — a vague goal wastes an entire
   session:
   - **Mission** — one sentence, plus "done means": numbered, user-observable
     outcomes ("the player can X", "running Y produces Z"). Never internal
     milestones ("engine works") — only things the user can see/do.
   - **Bible** — which doc wins conflicts. If none exists and decisions are
     scattered in the content, write one (Step 3).
   - **Chunks** — the decomposition (Step 2). If the user supplied a layout,
     keep their intent but tighten ownership/dependencies.
   - **Gates** — the deterministic verification commands. Reuse the repo's if
     they exist; otherwise mandate creating them in chunk 0.
   - **Non-goals** — explicit scope exclusions. Mine the spec for "later" /
     "out of scope" items; list them so the central agent can reject creep.

## Step 2 — Decomposition rules (what makes chunks succeed)

- **Chunk 0 is foundations, final chunk is QA/integration — both belong to the
  central agent.** Foundations = project scaffold + the gates themselves
  (types, linter, tests, build, smoke script behind one `check`-style
  command). Middle chunks get delegated.
- A good delegated chunk: one subagent can finish it in one sitting, owns a
  disjoint set of files, and its consumers depend only on a **pinned public
  API contract**, not its internals.
- Pure logic (engine, rules, progression math) is its own chunk *before* any
  UI chunk — it's unit-testable and becomes the contract the UI codes against.
- Strict dependency chains are fine; do not force parallelism. Sequential
  delegation with per-chunk verification beat parallel risk in practice.
  Parallel only when file ownership is provably disjoint.
- Size for a Sonnet-class subagent: one scene/module/system per chunk, with
  every ambiguity pre-decided in the prompt ("locked micro-choices"), not
  left open.

## Step 3 — Write files when the content is big

If the brief contains material that won't fit a readable goal statement
(chunk tables with contracts, draft numbers, decided micro-choices), write a
handoff doc — `docs/<phase>-handoff.md` — holding: mission + done-means, the
chunk table (id, what, depends-on, owns-files, deliverable), pinned API
contracts, locked decisions, and non-goals. Then the goal statement references
it by path. Keep the goal statement itself under ~80 lines either way; a repo
doc the central agent is *ordered to read* beats a 300-line goal. Commit the
doc if the repo convention is to commit.

## Step 4 — Emit the goal statement

Output it in a fenced block, ready to paste. Fill this template — the
delegation protocol and quality bar sections are the hard-won parts; keep them
even when trimming:

````
You are the central agent for {PROJECT/PHASE}: {one-line mission}. You
delegate, you decide, you own the outcome. Work autonomously to the end.

## Done means (verify every one yourself before declaring victory)
{numbered user-observable outcomes}

## Read first
{docs in authority order; the bible wins conflicts}

## Chunks
{table: id | what | depends on | owns (files/dirs)}
Chunk 0 (foundations+gates) and the final QA/integration chunk are YOURS.
Delegate the middle chunks to subagents in dependency order.

## Delegation protocol (non-negotiable)
- One Sonnet subagent per chunk, run synchronously; if one fails after a
  retry, take over or escalate the model — you are responsible either way.
- Every subagent prompt includes: exact docs to read; file ownership as
  CREATE / MAY EDIT / DO NOT TOUCH lists; pinned public API contracts for
  anything a later chunk consumes (write the signatures out); locked
  micro-decisions (decide them yourself first — never leave a subagent an
  open design question); definition of done = the runnable gate commands;
  and "report cross-boundary friction, do not fix outside your scope."
- Sequential when chunks share files; parallel only with disjoint ownership.
- After every chunk: run the gates YOURSELF (trust but verify), read the
  diff, do cross-boundary integration fixes yourself, then commit one
  checkpoint per chunk so any subagent damage is revertable.

## Quality bar (built in chunk 0, enforced always)
- Strict static analysis + linter + unit tests + build behind ONE command
  (`{check command}`); a headless smoke script that boots the real artifact
  and fails on any runtime error; an end-to-end journey script that drives
  the real user flow and asserts on persisted state, not screenshots.
- Anything tunable gets behavior-shape tests (scripted bots / property
  gates) so a bad tune fails deterministically. When tuning, add a
  telemetry diagnostic, read the numbers, tune the data, delete the
  diagnostic — never hand-derive.
- Scripts over manual verification, always. Never commit red.

## Scope
Non-goals: {list}. Reject scope creep, including your own.

When done: run the full journey end-to-end yourself, write a short QA note
(how to run + checklist results + decisions you made), and summarize what
was built and how to run it.
````

## Calibration notes (why the template says what it says)

- Pinned contracts in prompts are what let 4/4 subagents land first-try; the
  single integration bug in Phase 1 was the one value *not* named in a
  contract (a scene-data field). Anything crossing a chunk boundary must be
  spelled out as a signature.
- Subagents told "report, don't fix" surface gaps cleanly instead of making
  unauthorized cross-boundary edits — but that means the goal must assign
  integration to the central agent explicitly, or gaps ship.
- "Verify the gates yourself" is not paranoia: it also catches environment
  drift (e.g. browser binaries) before the next chunk builds on sand.
- User-observable "done means" gives the final QA chunk a checklist that
  can't be gamed by green unit tests alone — pair it with a journey script
  that asserts on real persisted state.
