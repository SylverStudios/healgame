# Alpha 0.1 — mid dungeon, tree layer 2, cooldowns, relics

Status: planning · Authority: this phase's scope · Last verified: 2026-07-12

**Audience:** a **central agent in a fresh session** who reads this doc end-to-end,
then **delegates chunks to Sonnet-class subagents** sequentially (parallel only
where file ownership is disjoint). Read first: [`CLAUDE.md`](../CLAUDE.md),
[`AGENTS.md`](../AGENTS.md), [`game/src/combat/README.md`](../game/src/combat/README.md),
[`game/src/tree/AGENTS.md`](../game/src/tree/AGENTS.md).

**This doc wins on Alpha 0.1 scope.** [`poc-spec.md`](./poc-spec.md) wins on
baseline combat rules unless this doc explicitly amends them. PoC retrospective
(frozen): [`poc-changelog.md`](./poc-changelog.md).

**Baseline:** main (or branch) after combat-juice phase ships. All PoC gates
green before chunk 0.

---

## Mission

Ship **Alpha 0.1** — the first slice past PoC that gives players a **reason to
grow power** and **reason to replay differently**:

1. **New dungeon** between Ash Gate and The Maw (4 trash waves + boss with a
   new single-target pressure mechanic).
2. **Spell tree layer 2** on both oath branches, focused on **mana pool
   maintenance**, plus a **branch rebalance** (move missing-health scaling to
   big heals on Vigil; redesign Zealot fast-heal identity).
3. **Two major cooldowns** (one per branch) — first CDs in the game; off-GCD
   activations with long timers.
4. **Minimal relics** — one-time pick of **1 of 3** StS-style run modifiers
   after **first Ash Gate boss clear**; locked for the save; icon + hover.

**Explicitly not in 0.1:** spellbook UI, crit/armor secondary stats, full relic
shop/system, second archetype, hub buff buildings, respec, proc/FCT framework.

---

## Why these four (product intent)

| Item | Role |
|------|------|
| Mid dungeon | Environment to **stress a stronger kit** without jumping straight to the unwinnable Maw sandbox |
| Tree layer 2 | **Design space** for mana identity per branch; required before CDs feel earned |
| Cooldowns | **Mana panic button** (Vigil) vs **tempo window** (Zealot); need fights long enough to matter |
| Relics | **Run-to-run variance** Kale lacked — same tree, different relic → different play |

---

## Done means (whole phase — central agent verifies)

1. **Dungeon chain:** Ash Gate → **Iron Pass** (working name) → The Maw.
   Iron Pass unlocks on Ash Gate first clear; Maw unlocks on Iron Pass first
   clear (amends PoC “Maw after Ash Gate”).
2. **Iron Pass:** 4 trash waves + 1 boss; trash is “normal” with higher HP/damage
   than Ash Gate; boss uses **Tunnel Vision** (see §Boss mechanic).
3. **Tunnel Vision UX:** distinct visual on the **boss-marked ally** (separate
   from player heal-target halo/chevron).
4. **Tree layer 2:** at least **3 purchasable nodes per branch** behind existing
   oath follow-ups: **2 passive mana/resource nodes + 1 CD-granting node** per
   side. Forsaken tempo nodes stay as-is.
5. **Rebalance shipped:** `Desperate Zeal` missing-health bonus **removed** from
   Zealot; **percent-based missing-health** on Vigil big heal (`Solemn Vigil`);
   Zealot gets a **new fast-heal identity node** (see §Tree rebalance).
6. **Two CDs:** Vigil **Still Waters** (~60s); Zealot **Frenzied Liturgy**
   (~30s). Engine + UI + tree grant; effects match §Cooldowns.
7. **Relics:** after **first-ever** Ash Gate victory, player sees **pick 1 of 3**
   before hub; choice persists in save; **restart wipes** relic; hub (or combat)
   shows relic **icon + hover tooltip**; relic effects apply in combat.
8. **Balance gates updated:** Ash Gate shape preserved; **maxed either branch**
   can clear Iron Pass with disciplined play; **The Maw still unwinnable** with
   maxed kit + relic. Document retunes in `poc-qa.md`.
9. Gates green: `npm run check`, `npm run smoke`, `node scripts/journey.mjs`.
10. `poc-qa.md` Alpha 0.1 section; this handoff → `historical`.

---

## Locked design decisions (do not re-litigate without user)

### D1 — Dungeon order & unlocks

```
Ash Gate (D1)  →  Iron Pass (D2, new)  →  The Maw (D3, still unwinnable)
```

| Unlock | Condition |
|--------|-----------|
| Iron Pass button on hub | `clearedDungeons` includes `'ash-gate'` |
| The Maw button on hub | `clearedDungeons` includes `'iron-pass'` |

Replace `isDungeon2Unlocked` semantics: rename or split into
`isIronPassUnlocked` / `isMawUnlocked`. Ruby **still only on first Ash Gate
clear** (no new ruby sink in 0.1).

### D2 — Iron Pass trash

Four waves before boss. Same enemy template as Ash Gate (`Ash Husk` or reskin
name in data only). Draft tuning starting point (QA-owned, tune with bots):

| Wave | Count | HP each | Notes |
|------|-------|---------|-------|
| 1 | 2 | 14 | |
| 2 | 3 | 14 | |
| 3 | 3 | 16 | |
| 4 | 4 | 16 | |

Trash `autoDamage` / swing: use `TRASH` constants; bump damage +1 vs Ash Gate
feel if fights are too forgiving.

### D3 — Boss: Tunnel Vision

**Working boss name:** `Spire Lancer` (data-only; rename freely).

**Mechanic:** While active, boss **focuses one party member** (never tank) and
strikes them every **1s for 10s**. Damage per tick is **low** but total ≈ **2×
that unit's max HP** if unhealed — forces fast triage, not Bonehowl-style party
AOE.

**Telegraph:** Named cast bar **~3s** before the 10s channel begins (readable
like Bonehowl). Boss **continues auto-attacking tank** during telegraph and
during channel (same as Bonehowl rule: cast is not a full interrupt).

**Target selection:** User asked for “random (not tank).” Engine stays
**deterministic**: eligible = living party members with `role !== 'tank'`, sorted
by stable unit id; pick `eligible[focusIndex % eligible.length]`; increment
`focusIndex` each activation. **No `Math.random` in combat/.**

**Engine surface (pinned):**

- Extend `BossDef` with optional **`abilities`** array OR a discriminated
  `cast` union — prefer **union** so existing Bonehowl encounters stay typed:

```ts
// types.ts — illustrative; implementer owns exact names
type BossCastDef =
  | { kind: 'partyAoE'; name: string; castMs: number; firstCastAtMs: number; intervalMs: number; partyDamage: number }
  | { kind: 'tunnelVision'; name: string; telegraphMs: number; firstCastAtMs: number; intervalMs: number; channelMs: number; tickMs: number; damagePerTick: number };
```

- New events (scene subscribes for VFX + log):

  - `bossFocusStarted { targetId, name, totalMs }`
  - `bossFocusTick { targetId, amount }`
  - `bossFocusEnded { targetId, name }`

- Draft numbers (tune): telegraph **3000ms**, channel **10000ms**, tick **1000ms**,
  `damagePerTick` **3** on DPS (maxHp 10 → 30 damage ≈ 3× if needed adjust to ~2×).

**Cadence:** `firstCastAtMs` / `intervalMs` use same **start-to-start** semantics
as Bonehowl (document in `combat/README.md`).

### D4 — Tree rebalance (move missing-health to big heals)

**Remove** `zealot-desperate-zeal` missing-health on `Zealous Flare`.

**Add to Vigil** (replace or augment `vigil-measured-devotion` spot — prefer
**new node** behind Patient Vow so existing saves stay valid):

**Graven Scale** (name locked for QA): `Solemn Vigil` bonus heal from missing
health uses **percent of base heal**, not flat +1 per 10%:

```
bands = floor((maxHp - hp) * 10 / maxHp)   // full 10% chunks, same as today
bonus = ceil(spell.heal * 0.05 * bands)    // 5% of base per band, round up
rawHeal = spell.heal + bonus + synergies…
```

Implement as new effect kind `missingHealthPctBonus` (spellId, pctPer10PctMissing)
resolved in `resolveCombatMods` → new engine option; **do not overload**
`healPer10PctMissing` integer field (tests depend on old semantics).

**Zealot replacement** for removed missing-health node:

**Steady Hands** (locked): `Zealous Mending` heals **+1** when target is at
**≥ 80% HP** (reward keeping people topped — opposite of Vigil “heal them low”).
Engine: new `fullHealthBonus` rule or one-off check in heal resolution; keep
pure/deterministic.

### D5 — Tree layer 2 (mana focus)

Nodes require owning **at least one** existing branch node (Patient Vow rank 1
**or** Measured Devotion for Vigil; Fervent Chain rank 1 **or** old Zealot node
slot for Zealot). Layout: **below** current branch nodes in `TreeScene`
(`NODE_POSITIONS` overrides + journey table).

**Vigil branch (draft content — tunable in data):**

| Node id | Type | Effect (draft) |
|---------|------|----------------|
| `vigil-deep-well` | passive | +4 max mana |
| `vigil-thrift` | passive | `Solemn Mend` mana cost −1 (min 1) |
| `vigil-still-waters` | **CD grant** | Grants CD **Still Waters** (tree description explains) |

**Zealot branch:**

| Node id | Type | Effect (draft) |
|---------|------|----------------|
| `zealot-quick-breath` | passive | `Zealous Flare` castMs −200ms (min 300ms) |
| `zealot-spendthrift-grace` | passive | +3 max mana |
| `zealot-frenzied-liturgy` | **CD grant** | Grants CD **Frenzied Liturgy** |

Costs: gold **5–6** per node; CD nodes **8g**; ranks = 1. Update
`ownedIdsFromLegacyRanks` / `legacyRanksFromOwned` / migration lists.

### D6 — Cooldowns (first major CDs)

**Rules (amend poc-spec “no major CDs” for Alpha 0.1 only):**

- CDs are **off-GCD** — activating does not consume GCD; cannot cast a heal
  and CD in the same tick if that violates busy rules (CD activate is instant).
- **One shared busy lock:** cannot start a player cast while a cast is already
  active (unchanged); CD can fire during cast unless playtest says otherwise
  → **locked: CD can activate anytime except wipe/victory**.
- CD buttons on spell bar row (right side) or second row — temp rects OK.
- Show **remaining cooldown** as seconds text on button; inert when on CD.

**Still Waters (Vigil):** 60s CD. On activate: next completed player heal
**refunds its mana cost** and **does not consume mana** on cast start (reserve
0 for that cast). If cast cancelled, consume buff without refund. One charge,
consumed on first **completed** heal.

**Frenzied Liturgy (Zealot):** 30s CD. On activate: for **30s wall-clock in
sim** (paced `dt`), all heals have **mana cost −1** (min 0). Flat reduction —
strong with cheap spells.

Data lives in `game/src/data/cooldowns.ts` + tree effect `grantCooldown`.
`CombatMods` gains `cooldowns: CooldownDef[]`; engine tracks `cooldownRemainingMs`
and active buff windows.

### D7 — Relics (minimal)

**Trigger:** first time `applyCombatResult` records `'ash-gate'` in
`clearedDungeons` → set flag `relicPickPending: true` → after combat overlay,
route to **`RelicScene`** (pick 1 of 3) → then Hub. Never offer again on that
save.

**Save v4 fields:**

```ts
relicId: string | null;       // chosen relic
relicPickPending: boolean;    // transient, cleared after pick
```

**Three relics (locked implementations — data in `game/src/data/relics.ts`):**

| id | Name | Effect |
|----|------|--------|
| `ember-ledger` | Ember Ledger | First **overheal** each combat restores **3 mana** to healer (once per fight) |
| `triage-bell` | Triage Bell | Heals on targets **below 50% HP** heal **+2**; heals on targets **≥ 50%** heal **−1** (min 1) |
| `still-reservoir` | Still Reservoir | Start each combat at **−5 max mana**, but **every 15s** restore **2 mana** (combat regen tick — new engine hook) |

Relics are **not** tree nodes — separate `relicMod` passed into engine at fight
start alongside `CombatMods`. Restart clears `relicId`.

**UI:** Hub top-right relic icon (24px temp glyph); hover shows name +
description (reuse tree tooltip pattern). Optional: small icon in combat HUD.

### D8 — Determinism & purity

- No Phaser in `combat/`, `data/`, `meta/`, `tree/`, `save/`.
- No wall clock in engine; relic regen and CD timers use **`advance(dtMs)`**.
- Boss focus target rotation is deterministic (D3).

### D9 — Art

Temp only: rects, monospace, ember palette. Tunnel Vision marker ≠ heal target
halo (suggest **vertical beam** or **skull marker** above unit). Relic icons:
simple colored diamond / circle per relic id.

---

## Chunk plan (delegation map)

Central agent runs **chunk 0** and **chunk 9**; delegates **1–8** to subagents
with the prompt template in §Subagent prompt template. **Do not parallelize**
two chunks that both edit `engine.ts`, `save.ts`, or `CombatScene.ts`.

| Chunk | Owner | Depends | Creates / edits (primary) |
|-------|-------|---------|---------------------------|
| **0** | Central | — | Verify baseline gates; confirm this doc; pin draft numbers |
| **1** | Subagent | 0 | **Engine:** boss cast union + Tunnel Vision events + tests. Files: `combat/types.ts`, `engine.ts`, `engine.boss.test.ts`, `combat/README.md` |
| **2** | Subagent | 0 | **Data + progression:** `encounters.ts` Iron Pass, constants, `isIronPassUnlocked` / `isMawUnlocked`, hub buttons, `progression.test.ts` |
| **3** | Subagent | 1, 2 | **Scene:** boss focus VFX, combat log lines, screenshake policy (focus tick: no shake; channel start: optional small shake). `CombatScene.ts`, `unitSprite.ts` |
| **4** | Subagent | 0 | **Engine:** percent missing-health + full-health bonus rules; remove flat missing from Zealot path in tests. `engine.ts`, `engine.effects.test.ts`, `types.ts` |
| **5** | Subagent | 4 | **Tree rebalance data:** remove `desperate-zeal`, add `graven-scale`, `steady-hands`; `spellTree.ts`, `TreeScene.ts` positions, tooltip lines |
| **6** | Subagent | 4 | **Engine + data:** cooldown system + `cooldowns.ts`; `grantCooldown` tree effect; CD UI stub in `spellBar.ts`. `engine.cooldown.test.ts` |
| **7** | Subagent | 5, 6 | **Tree layer 2:** all passive + CD nodes, `resolveCombatMods`, bridge ranks, `tree/AGENTS.md`, `TreeScene` layout |
| **8** | Subagent | 6 | **Relics:** `relics.ts`, save v4 migrate, `RelicScene`, `applyCombatResult` hook, hub icon, engine relic hooks + tests |
| **9** | Central | 1–8 | **Balance bots** for Iron Pass; update `balance.test.ts`; **journey.mjs** new stages (Iron Pass entry, relic pick, layer-2 purchase, Maw still wipes); `poc-qa.md`; mark handoff historical |

**Suggested sequencing:** 0 → 1 → 2 → 3 (dungeon playable) → 4 → 5 → 6 → 7
(tree + CDs) → 8 (relics) → 9 (integration). Chunk 8 can start after 6 if
relic engine hooks are small and **8 avoids `spellTree.ts`**.

---

## Subagent prompt template (central agent fills per chunk)

```markdown
You are implementing **Alpha 0.1 chunk N** for healgame.

Read first: CLAUDE.md, docs/alpha-0.1-handoff.md (sections §D* relevant to chunk).

**Your chunk:** [name]
**You own:** [file list — ONLY edit these unless blockers]
**Do NOT touch:** [other chunks' files]

**Public API contract:** [paste types/signatures chunk must expose]

**Done means:** [bullet list from handoff]

**Definition of done:** From game/: npm run check && npm run smoke
(+ node scripts/journey.mjs if you touch scenes/save/progression/layout)

**Report back:** files changed, test counts, any cross-boundary gap for central agent.
Do not fix other chunks' files — report gaps only.
```

---

## Balance gate amendments (chunk 9)

Keep existing PoC gates **1–4** (base kit loses, naive overheal loses, Ash Gate
maxed kits win, Maw unwinnable). **Add:**

| Gate | Bot | Expect |
|------|-----|--------|
| **5** | Maxed Vigil save vs Iron Pass | Victory, ≥3 alive, Tunnel Vision fires ≥1 |
| **6** | Maxed Zealot save vs Iron Pass | Victory, ≥3 alive |
| **7** | Maxed either + any relic vs Maw | Wipe |

Use scripted bots in `balance.test.ts`; retune Iron Pass HP/damage with throwaway
diagnostic script (delete after tune) per CLAUDE.md working style.

---

## Journey.mjs impact (chunk 9)

Expect new stages (names illustrative):

| Stage | Proves |
|-------|--------|
| **D2-unlock** | Ash Gate cleared save → Iron Pass button visible |
| **Relic** | First clear → RelicScene → pick → `relicId` in save |
| **Tree-L2** | Buy one layer-2 node + CD node on sworn branch |
| **Iron-clear** | Maxed seed clears Iron Pass (or engine bot already proves) |
| **Maw** | Still unwinnable after Iron Pass clear |

Update `UI` table for: hub Iron Pass button, relic card clicks, tree new node
coords, CD button if journey tests activation.

---

## Held for later (do not scope creep)

| Idea | Why wait |
|------|----------|
| Spellbook view | Valuable when spell count overwhelms bar |
| Crit / armor stats | Need tree talents that reference them |
| Full relic system | 0.1 is one static pick |
| Proc / FCT framework | Separate phase |
| Audio / title menu | Different vertical (see old board notes); not 0.1 |

---

## Risk register (central agent watches)

| Risk | Mitigation |
|------|------------|
| Boss ability generalization breaks Bonehowl | Union type + regression tests on Ash Gate |
| CD + mana reserve interaction bugs | Dedicated `engine.cooldown.test.ts` for Still Waters refund |
| Tree layout overcrowding | Spread layer 2 Y +400px; journey coords |
| Relic regen tick desyncs pace | Relic ticks use sim dt (same as engine.advance) |
| Save migration v3→v4 | Unit tests + journey stage with v3 payload |

---

## Document history

| Date | Notes |
|------|-------|
| 2026-07-12 | Alpha 0.1 scope from user: mid dungeon, tree L2, 2 CDs, 3 relics; replaces menu/sound board draft |
