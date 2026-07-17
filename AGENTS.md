# AGENTS.md — healgame documentation system

Status: current · Authority: doc conventions for all agents · Last verified: 2026-07-17


How we keep docs trustworthy. Operating rules for the game itself live in
[`CLAUDE.md`](CLAUDE.md). Module contracts live next to code (e.g.
[`game/src/tree/AGENTS.md`](game/src/tree/AGENTS.md),
[`game/src/combat/README.md`](game/src/combat/README.md), and
[`game/src/data/README.md`](game/src/data/README.md)).

## Frontmatter (required on every doc)

Three fields, one line or a short block at the top:

```markdown
Status: current | historical | planning
Authority: what this doc wins (or "none — research / backlog")
Last verified: YYYY-MM-DD
```

| Status | Meaning |
|--------|---------|
| `current` | Describes shipped reality; update when behavior changes |
| `historical` | True for a past phase; do not use as a live map |
| `planning` | Intended work not yet in code (active handoff only) |

When you edit a living doc, bump `Last verified`. When a phase ships: append
[`docs/poc-qa.md`](docs/poc-qa.md), prepend a short entry to
[`docs/CHANGELOG.md`](docs/CHANGELOG.md), and delete the planning handoff (git
history keeps it). Do not leave `Status: planning` on shipped work.

## Authority (highest wins)

1. Any active phase handoff (`docs/*-handoff.md` with `Status: planning`)
2. [`docs/poc-spec.md`](docs/poc-spec.md) — PoC baseline (phase amendments win)
3. [`docs/poc-qa.md`](docs/poc-qa.md) — decided micro-choices + QA log
4. Colocated module docs — win for that module:
   - [`game/src/tree/AGENTS.md`](game/src/tree/AGENTS.md)
   - [`game/src/combat/README.md`](game/src/combat/README.md)
   - [`game/src/data/README.md`](game/src/data/README.md)
5. [`CLAUDE.md`](CLAUDE.md) — gates, hard rules, working style
6. [`docs/CHANGELOG.md`](docs/CHANGELOG.md) — shipped-history summary
7. [`docs/GDD.md`](docs/GDD.md) — long-term only
8. [`docs/research/`](docs/research/) — never authoritative for implementation

## Quality gate

Run from `game/` before committing:

```bash
npm run verify        # full suite (typecheck, lint, test, build, smoke, journey)
npm run verify:fast   # skip journey (~5 min saved)
```

Implemented by [`game/scripts/verify.mjs`](game/scripts/verify.mjs). Passing
stages emit one line each; only failures print full output. GitHub Actions runs
the same script (see [`.github/workflows/verify.yml`](.github/workflows/verify.yml)).

Individual stages still exist (`npm run check`, `npm run smoke`, etc.) but
agents should prefer `verify`.

## Where things live

| Kind | Location |
|------|----------|
| Living rules | `CLAUDE.md`, `docs/poc-spec.md`, `docs/poc-qa.md` |
| Ship log | [`docs/CHANGELOG.md`](docs/CHANGELOG.md) |
| Active mission | None; check `docs/*-handoff.md` for a future `Status: planning` handoff |
| Module contracts | Colocated `AGENTS.md` / `README.md` |
| Journey names | [`docs/semantic-targets.md`](docs/semantic-targets.md) |
| Idea backlog | [`docs/ideas.md`](docs/ideas.md) (`Status: current`, not a handoff) |
| Research | `docs/research/` |
| Art ops | `docs/unit-art.md` |
| Long-term design | `docs/GDD.md` |

## Doc hygiene

- **No duplicate source of truth.** Tunable numbers live in `game/src/data/`
  (tree: `talentTree.ts`). Docs describe intent and point at files.
- **Implemented contracts → file refs.** Do not paste long TypeScript that
  already exists in the repo; link the file instead.
- **Definition of done (doc touch):**

  | Change | Must update |
  |--------|-------------|
  | Tree service / wiring | `game/src/tree/AGENTS.md` |
  | Combat rules | `game/src/combat/README.md`; balance shape → `poc-qa.md` |
  | Dungeon/mob/ability content pipeline | `game/src/data/README.md` |
  | Save shape | `save.ts` header + `poc-qa.md` note; bump version per CLAUDE.md |
  | Scene layout / interactive targets | `setName` on the object + journey by name ([`docs/semantic-targets.md`](docs/semantic-targets.md)); do not reintroduce a coordinate `UI` table |
  | Phase complete | Append `poc-qa.md`; prepend `CHANGELOG.md`; delete planning handoff |
