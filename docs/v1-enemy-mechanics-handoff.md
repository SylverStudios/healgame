# Road to 1.0 — Enemy mechanics handoff

Status: planning · Authority: this file wins for v1 enemy stats + abilities
· Last verified: 2026-07-31

Companion to player progression ([`v1-mechanics-handoff.md`](v1-mechanics-handoff.md)).
This slice is **simpler and content-heavy**: enemy stats, 0-or-1 abilities,
cast bars, and trash→boss curriculum. Magnitudes are tuneable stubs that must
pass `balance.test.ts` / content balance bots — expect a retune pass inside
this phase, not a separate Balance phase for enemy numbers.

Remote agent entry prompt:
[`v1-enemy-mechanics-agent-prompt.md`](v1-enemy-mechanics-agent-prompt.md).

Design background (non-authoritative):
[`playtest-2026-07-30.md`](playtest-2026-07-30.md) cluster A (trash as teachers).

Module contracts:
[`game/src/data/README.md`](../game/src/data/README.md),
[`game/src/combat/README.md`](../game/src/combat/README.md).

---

## 1. Mission

Make every dungeon’s trash **teach the boss verb** before the exam:

- Each enemy (trash or boss) has **0 or 1** ability.
- Abilities have **cast time**, a visible **cast bar**, and a **cooldown**
  (today’s start-to-start `intervalMs` / post-cast gap — keep the field, teach
  it as cooldown in UX copy).
- For each dungeon signature mechanic: author a **lesser (trash)** and
  **greater (boss)** intensity of the **same `kind` / verb family**.
- Bosses may present larger / richer (display size, telegraph intensity,
  animation hooks) — do not block the systems work on full art.

**Done means:**

1. Validation allows trash mobs with 0 or 1 ability (remove
   `trash-abilities-unsupported`).
2. Compile attaches at most one cast to trash groups **and** bosses.
3. Combat engine schedules casts for any living enemy with a cast (not
   boss-only). Multiple trash casters may be mid-cast; deterministic order.
4. Combat UI shows a cast bar (and telegraph cue when authored) for the
   casting unit — boss and trash.
5. Every ordered dungeon has a trash lesser + boss greater pair for its
   signature verb (Ash Gate template first, then the rest).
6. Trash packs threaten a bit more via the cast (not HP sponges). Autos may
   be retuned modestly.
7. `npm run content -- validate` / `preview --all` clean; `npm run verify`
   green; balance gates updated if outcomes shift; short CHANGELOG + poc-qa
   note.

---

## 2. Locked product decisions

| # | Decision |
|---|----------|
| E1 | **0 or 1 ability** per mob. Already validated max-1; lift trash ban only. |
| E2 | No new ability `kind`s required for this slice. Reuse `partyAoE`, `tunnelVision`, `partyDoT`, `manaSiphon`. New kinds only if a dungeon verb cannot express — prefer data. |
| E3 | **Cadence fields stay** (`castMs` / `telegraphMs`, `firstCastAtMs`, `intervalMs`). Document `intervalMs` as cooldown cadence in README/UI; do not invent a parallel `cooldownMs` unless it clarifies authoring (if added, it must compile 1:1 to existing gap semantics). |
| E4 | **Trash lesser / boss greater** = same `kind`, separate ability ids, scaled params (roughly 40–60% intensity on trash: less damage, shorter channel/DoT, often **longer** cast so the teach is readable). |
| E5 | Prefer **one trash caster ability per dungeon** (the wave’s signature husk), not every trash mob casting. Other trash in the pack may stay ability-less (autos only). |
| E6 | **Reaction verbs for now:** heal through, kill the caster, swap attention. **No interrupt system** in this slice. **No esuna.** Cling-until-full DoT parked. Boss summon parked. |
| E7 | Boss vs trash **model split is soft**: keep one ability schema; allow bosses larger display / stronger telegraph / more anim hooks in presentation. Do not fork a second ability DSL. |
| E8 | Engine remains pure + deterministic. Multi-caster scheduling must be order-stable (e.g. by unit id). |
| E9 | Floor autoDamage scaling (J26) unchanged; cast damage still authored (not floor-scaled) unless you consciously choose otherwise and document it. |
| E10 | Scope = systems + full dungeon catalog retrofit. Player modifiers/upgrades/CDs are out of this handoff. |

---

## 3. Current reality (baseline)

| Layer | Today |
|-------|-------|
| Authoring | `EnemyAbilityDef` kinds × 4; mobs `abilityIds: readonly string[]` max 1 |
| Validation | **Trash with any ability → error** (`trash-abilities-unsupported`) |
| Compile | Trash waves → stats only; boss → optional `BossDef.cast` from `abilityIds[0]` |
| Engine | Single global boss cast timer / `bossCast` state; trash never casts |
| UI | One boss cast bar + telegraph cue from registry |
| Content | 7 boss abilities, 7 dungeons; **all trash `abilityIds: []`** |

### Live boss verbs (greater — keep / retune)

| Dungeon | Boss | Ability | Kind |
|---------|------|---------|------|
| Ash Gate | gate-warden | bonehowl | partyAoE |
| Iron Pass | spire-lancer | tunnel-vision | tunnelVision |
| Cinder Vault | ember-colossus | emberfall | partyDoT |
| Verdant Rift | thorn-matriarch | needle-gaze | tunnelVision |
| Black Choir | dirge-sovereign | soul-toll | manaSiphon |
| Gloam Sanctum | veil-cantor | null-psalm | manaSiphon |
| The Maw | hollow-king | extinction | partyAoE |

### Structural work (ordered)

1. `validate.ts` — allow trash abilities (still max 1).
2. `compile.ts` + `EnemyGroupDef` — carry optional cast onto trash groups.
3. `combat/types.ts` + `engine.ts` — generalize cast state beyond one boss.
4. `CombatScene` — cast bars / telegraphs for casting unit ids.
5. Author lesser abilities + attach to signature trash mobs; retune stats.
6. Tests, content pins, balance gates, docs (`data/README`, `combat/README`).

---

## 4. Target model

### Authoring

```
enemyAbilities/
  bonehowl.ts              # boss greater (existing)
  bonehowl-lesser.ts       # trash teach (new) — same kind, milder
  ...
mobs/
  ash-husk.ts              # abilityIds: ['bonehowl-lesser']  (example)
  gate-warden.ts           # abilityIds: ['bonehowl']
```

Naming convention (suggested): `<verb>-lesser` for trash, keep existing boss
ids. Pairing is by dungeon design, not a required schema field — optional
`curriculumOf?: string` on lesser defs is nice for preview/validate but **not
required**.

### Compile shape (illustrative)

```ts
// combat/types.ts — evolve toward shared cast def
type EnemyCastDef = BossCastDef; // rename OK if low churn; alias fine

interface EnemyGroupDef {
  mobId: string;
  name: string;
  hp: number;
  count: number;
  autoDamage: number;
  swingIntervalMs: number;
  cast?: EnemyCastDef; // NEW — from abilityIds[0] when present
}

interface BossDef {
  // existing fields…
  cast?: EnemyCastDef;
}
```

### Engine

- Replace “one boss cast pipeline” with **per-caster** state keyed by unit id
  (boss id + trash instance ids).
- Each caster: timer → start cast → cast bar on that unit → complete → apply
  kind effect → reschedule from `intervalMs` rules (same semantics as today).
- Tunnel Vision / focus: if two casters could focus, define priority (boss
  first, else lowest unit id). Prefer **at most one focus channel globally**
  if dual focus is messy — document the rule in `combat/README.md`.
- Party AoE / DoT / mana siphon from trash: same events, `sourceId` = caster.
- Autos continue during cast (current boss behavior).

### UI

- Cast bar anchored to the casting unit (trash or boss).
- Telegraph cue from authoring registry by ability id / mob abilityIds[0]
  (existing boss path generalized).
- If many bars clutter early Ash Gate, show bars only for units with an active
  cast (not idle cooldown chrome).

### Boss presentation (soft)

- Keep bosses visually distinct: existing larger display size OK; may scale by
  art tier later (`art/STYLE.md` boss/colossal).
- Stronger telegraph / shake near complete already exists for boss — reuse for
  trash at lower intensity if easy; not a gate.

---

## 5. Curriculum authoring guide

Per dungeon:

| Piece | Guidance |
|-------|----------|
| Signature verb | Keep current boss `kind` |
| Lesser | New ability id; same kind; ~40–60% damage/duration; often longer castMs / earlier firstCast for readability |
| Who casts | Signature trash mob of that dungeon (e.g. ash-husk); not every add |
| Fail state | Scary but recoverable party chunk — not wipe-on-miss |
| Boss | Existing greater; retune if trash practice makes boss trivial or brutal |
| Autos | Slight threat bump OK; avoid HP sponge |

### Suggested lesser map (implementer may rename ids)

| Dungeon | Trash mob | Lesser (new) | Boss greater (existing) |
|---------|-----------|--------------|-------------------------|
| Ash Gate | ash-husk | bonehowl-lesser | bonehowl |
| Iron Pass | iron-husk | tunnel-vision-lesser | tunnel-vision |
| Cinder Vault | cinder-wraith | emberfall-lesser | emberfall |
| Verdant Rift | thorn-husk | needle-gaze-lesser | needle-gaze |
| Black Choir | choir-shade | soul-toll-lesser | soul-toll |
| Gloam Sanctum | gloam-wretch | null-psalm-lesser | null-psalm |
| The Maw | ash-husk (reuse) | extinction-lesser **or** reuse bonehowl-lesser | extinction |

The Maw may teach with a distinct lesser Extinction (big telegraph, low damage)
or reuse Ash Gate’s AoE lesson — pick one and note in PR.

---

## 6. Work chunks

| id | Owner | What | Depends |
|----|-------|------|---------|
| E0 | central | Read this bible; confirm no product reopen | — |
| E1 | central / sub | Types + validate + compile + content tests for trash casts | E0 |
| E2 | subagent | Engine multi-caster scheduling + kind effects + unit tests | E1 |
| E3 | subagent | CombatScene cast bars / telegraphs for any caster | E2 |
| E4 | subagent | Author all lesser abilities + mob wiring; Ash Gate first then rest | E1 |
| E5 | subagent | Stat / magnitude tune via `npm run content -- balance`; update pins | E2–E4 |
| E6 | central | README updates, poc-qa + CHANGELOG, full `npm run verify`, open PR | E2–E5 |

E4 can start stub magnitudes as soon as E1 lands; E5 retunes after engine+UI
exist so bots feel the casts.

---

## 7. Non-goals

- Player loadout / modifiers / upgrades / CD choice (other handoff)
- Interrupt / esuna / cling DoT / boss summon adds
- New ability scripting language or unbounded ability counts
- Full boss art regeneration (optional polish later)
- Deleting lattice/radial

---

## 8. Definition of done checklist

- [ ] Trash may have 0–1 abilities; validate + compile + engine + UI agree
- [ ] Cast bar + cooldown cadence for trash and boss casters
- [ ] Each dungeon: lesser trash teach + greater boss exam (same kind)
- [ ] Balance gates green (retuned if needed)
- [ ] `data/README.md` + `combat/README.md` updated (trash abilities supported)
- [ ] CHANGELOG + poc-qa note; `npm run verify` green; PR with try-steps
