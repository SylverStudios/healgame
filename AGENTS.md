# AGENTS.md — healgame documentation system

Status: current · Authority: doc conventions for all agents · Last verified: 2026-07-12

How we keep docs trustworthy. Operating rules for the game itself live in
[`CLAUDE.md`](CLAUDE.md). Module contracts live next to code (e.g.
[`game/src/tree/AGENTS.md`](game/src/tree/AGENTS.md),
[`game/src/combat/README.md`](game/src/combat/README.md)).

## Frontmatter (required on every doc)

Three fields, one line or a short block at the top:

```markdown
Status: current | historical | planning
Authority: what this doc wins (or "none — archive / research")
Last verified: YYYY-MM-DD
```

| Status | Meaning |
|--------|---------|
| `current` | Describes shipped reality; update when behavior changes |
| `historical` | True for a past phase; do not use as a live map |
| `planning` | Intended work not yet in code (active handoff) |

When you edit a living doc, bump `Last verified`. When a phase ships, set its
handoff to `historical` (or move under `docs/archive/`) and append a section
to [`docs/poc-qa.md`](docs/poc-qa.md).

## Authority (highest wins)

1. Active phase handoff (`docs/phase-*-handoff.md` with `Status: planning`)
2. [`docs/poc-spec.md`](docs/poc-spec.md) — PoC baseline (phase amendments win)
3. [`docs/poc-qa.md`](docs/poc-qa.md) — decided micro-choices + QA log
4. Colocated module docs — win for that module:
   - [`game/src/tree/AGENTS.md`](game/src/tree/AGENTS.md)
   - [`game/src/combat/README.md`](game/src/combat/README.md)
5. [`CLAUDE.md`](CLAUDE.md) — gates, hard rules, working style
6. Historical handoffs / outcomes — lessons only
7. [`docs/tech-options.md`](docs/tech-options.md) — stack rationale
8. [`docs/GDD.md`](docs/GDD.md) — long-term only
9. [`docs/research/`](docs/research/) — never authoritative for implementation

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
| Active mission | `docs/<phase>-handoff.md` (`Status: planning`) |
| Module contracts | Colocated `AGENTS.md` / `README.md` |
| Historical | Bannered handoffs / outcomes (or `docs/archive/`) |
| Research | `docs/research/` |
| Art ops | `docs/unit-art.md` |

## Doc hygiene

- **No duplicate source of truth.** Tunable numbers live in `game/src/data/`
  (tree: `spellTree.ts`). Docs describe intent and point at files.
- **Implemented contracts → file refs.** Do not paste long TypeScript that
  already exists in the repo; link the file instead.
- **Definition of done (doc touch):**

  | Change | Must update |
  |--------|-------------|
  | Tree service / wiring | `game/src/tree/AGENTS.md` |
  | Combat rules | `game/src/combat/README.md`; balance shape → `poc-qa.md` |
  | Save shape | `save.ts` header + `poc-qa.md` note; bump version per CLAUDE.md |
  | Scene layout | `scripts/journey.mjs` `UI` table |
  | Phase complete | Append `poc-qa.md`; mark handoff `historical` |
