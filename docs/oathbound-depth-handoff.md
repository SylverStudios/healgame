# Alpha 0.2 — Oathbound Depth (Vowstrike crown)

Status: historical · Authority: none — archive / Alpha 0.2 shipped · Last verified: 2026-07-15

**Audience:** a **central agent in a fresh session** who reads this doc end-to-end,
then **delegates chunks to Sonnet-class subagents** sequentially (parallel only
where file ownership is disjoint). Read first: [`CLAUDE.md`](../CLAUDE.md),
[`AGENTS.md`](../AGENTS.md), [`game/src/combat/README.md`](../game/src/combat/README.md),
[`game/src/tree/AGENTS.md`](../game/src/tree/AGENTS.md),
[`game/src/data/README.md`](../game/src/data/README.md).

**This doc wins on Alpha 0.2 scope.** [`poc-spec.md`](./poc-spec.md) wins on
baseline combat rules unless this doc explicitly amends them. Living QA /
amendments after ship: [`poc-qa.md`](./poc-qa.md). Long-term fantasy:
[`GDD.md`](./GDD.md) § Oathbound (Beacon-class excitement; triad + Wings).

**Baseline:** `main` after Verdant Rift / content-DX (dungeon ladder through
Black Choir + Maw). Gates green before chunk 0.

---

## Mission

Ship **Alpha 0.2 — Oathbound Depth**: make leveling feel valuable, free the
talent tree from mana-maintenance duty, densify the tree/combat UI with
placeholder glyphs, and grow the tree into a **shared → oath split → shared →
Vowstrike (light/dark) split → crown** shape whose payoff is a **late
Vowstrike** (identity choice) plus a **shared Wings cooldown** — the
Holy-Paly “I’ve been climbing forever for this” moment. **Black Choir becomes
clearable** with the completed crown kit; **The Maw stays unwinnable**.

Theme note: the product tone leans **Last Spell / dark**. The second exclusive
fork is **Virtue (light) vs Vengeance (dark)** Vowstrike — justice paladin vs
vengeance paladin — not a second subclass. Vigil/Zealot remain the oath tempo
identities.

---

## Done means (whole phase — central agent verifies)

1. **Level grants mana:** each level above 1 adds **max mana** and **combat mana
   regen** (draft numbers in §D2). Relics stay as-is and stack on top.
2. **Tree no longer is the mana story:** Deep Reserves and layer-2 pure-mana
   pads are slimmed / retargeted so point spend buys **output, tools, identity**.
3. **Tree topology shipped** (see §Tree shape):
   shared early → Vigil|Zealot oath → shared mid → Light|Dark Vowstrike →
   shared crown (**Wrath Ascendant** Wings CD + crowned Vowstrike payoff).
4. **Two Vowstrike spells** exist as true **instants** (`castMs: 0`), granted by
   the light/dark exclusive fork; oath colors the chosen Vowstrike **lightly**
   (§D5).
5. **Placeholder glyph icons** on tree nodes and combat spell/CD buttons;
   hover tooltips still show full name + numbers. Temp-art exception is
   explicit (§D8).
6. **Black Choir:** maxed crown kits (both oaths × both Vowstrike aspects, with
   disciplined bot) **clear** with ≥3 alive; Soul Toll still burns mana ≥1.
7. **The Maw:** still unwinnable with maxed kit ± any relic.
8. **Ash Gate balance shape preserved** (no-heal wipe, naive wipe, disciplined
   base kit not a cruise, prior mid-dungeons still clearable).
9. **No respec.** Wrong exclusive picks stay locked; Warped Tempo–style
   forsaken consolations may remain for the oath fork only.
10. Gates green: `npm run verify` (full — scenes, save, progression, encounter /
    spell data). Append Alpha 0.2 section to `poc-qa.md`; mark this handoff
    `historical`.

---

## Why this phase (product intent)

| Pressure | Response |
|----------|----------|
| Mid-tier ladder (esp. Black Choir) outgrew the old max tree | Deeper power + crown tools |
| Tree points were spent on not-OOMing | Move pool/regen to **level**; talents buy fantasy |
| Named nodes waste space; bar will grow | Glyph icons + tooltips |
| Need a Beacon-class emotional peak without literally copying Beacon | Late **Vowstrike** (identity) + **Wings** (shared crown CD) |
| Early overwhelm vs late grind | Pace levels + XP so early kit stays small and crown is reachable via the dungeon ladder, not Maw farming |

---

## Locked design decisions (do not re-litigate without user)

### D1 — Tree topology (minimal hourglass)

```
[Shared early]          slim entrance; fewer pure-mana ranks
        │
   Vigil │ Zealot       exclusiveGroup: subclass (existing oaths + forsaken tempo)
        │
[Shared mid]            recombine; output-focused passives (any-of prereq off oath follow-ups)
        │
 Light VW │ Dark VW     exclusiveGroup: vowstrike-aspect (Virtue vs Vengeance)
        │
[Shared crown]          Wrath Ascendant (Wings CD) + crown Vowstrike amp
```

- **Oaths** remain Vigil (efficient/slow) vs Zealot (fast/emergency).
- **Second split** is **not** a third subclass. It picks **which Vowstrike**
  you earn: **Virtue (light)** vs **Vengeance (dark)**.
- **Crown is shared** — every completed path gets Wings; your Vowstrike flavor
  comes from the fork below.
- Existing branch spice (Patient Vow / Measured Devotion / Fervent Chain /
  Steady Hands / Graven Scale / Still Waters / Frenzied Liturgy) **stays in
  the oath wedge** between oath and shared mid, retuned as needed. Pure-mana
  layer-2 nodes (Deep Well / Spendthrift Grace) are **cut or converted** to
  output.

### D2 — Level → mana pool + regen (no HoTs)

- **No player HoTs.** Regen means **mana regen**, not heal-over-time.
- At fight start, `loadoutFromSave` (or a pure helper it calls) adds
  level-derived bonuses into combat options:
  - `bonusMaxMana += manaPoolPerLevel * (level - 1)`
  - combat mana regen from level (see engine pin below)
- **Draft numbers** (tune with bots; keep integers):

  | Rule | Draft |
  |------|-------|
  | Max mana per level above 1 | **+3** |
  | Mana regen | **+1 mana / 10s** at level 2; **+1 / 10s again every 3 levels** (L2, L5, L8, L11, …) |
  | `PARTY.startingMana` | stays **20** |
  | Relics | unchanged; stack with level bonuses |

- Engine today only regens mana via **relic** `manaRegen`. This phase **must**
  expose level (or loadout) regen without pretending to be a relic — prefer
  `CombatEngineOptions.manaRegen?: { amount; intervalMs }` merged with relic
  regen (sum amounts; use min interval or a single combined ticker — pick one
  rule, document in `combat/README.md`, test it).
- `PARTY.manaRegenPer5s` may be retired or wired through the same path; do not
  leave a second competing regen system.

### D3 — Leveling / XP pacing

Goals:

1. **Early (L1–3):** few buttons. Solemn Mend → Zealous at L2; oath not forced
   in the first minutes.
2. **Mid:** oath + branch follow-ups land while clearing Ash Gate → Iron Pass
   → Cinder Vault.
3. **Late:** Vowstrike fork + crown reachable by playing the mid-tier ladder
   **without grinding The Maw**; Black Choir is the first fight that *wants*
   the crown kit.

**Draft pacing targets** (verify with content preview / XP math; adjust data):

| Milestone | Target player level (approx) | Talent points available |
|-----------|------------------------------|-------------------------|
| After first Ash Gate clear attempts | 2–3 | 2–3 |
| Comfortable oath + one follow-up | 4–6 | 4–6 |
| Shared mid nodes available | 7–9 | 7–9 |
| Vowstrike fork purchaseable | 10–12 | 10–12 |
| Crown owned (Wings + amp) | 12–14 | 12–14 |

Levers (use as needed; prefer data over novel systems):

- Soften **post–level 8** XP thresholds (flatten `xpForLevel` growth).
- Raise `xpPerEnemy` on **mid+ dungeons** (Cinder Vault onward) so progression
  accelerates where fights are longer — keep Ash Gate at 1.
- Shrink **Deep Reserves** (draft: **3 ranks** max, still +mana but smaller
  total than today) so points aren’t trapped in the old mana sink.

Point budget for a **completed single path** (not both exclusives): aim
**~12–14** purchases including oath branch ranks. Balance bots “maxed” means
one oath × one Vowstrike aspect × crown, plus the sensible passives on that
path — not owning both exclusives.

### D4 — Vowstrike (light / dark) + instant casts

| ID (draft) | Name (draft) | Fantasy | Role |
|------------|--------------|---------|------|
| `vowstrike-virtue` | Vowstrike: Absolution | Virtue / justice / light | Instant direct heal; stable, triad-friendly |
| `vowstrike-vengeance` | Vowstrike: Reckoning | Vengeance / dark | Instant direct heal; stronger when target is hurting |

**Draft combat numbers** (1–10 scale; retune freely):

| Spell | heal | mana | castMs | Extra (encoded as existing rule kinds where possible) |
|-------|------|------|--------|--------------------------------------------------------|
| Absolution | 3 | 2 | **0** | Synergy-friendly: e.g. casting Solemn Mend arms +1 on next Absolution (tree passive) |
| Reckoning | 2 | 2 | **0** | Missing-health: +1 heal per 10% missing (or pct-of-base) via existing bonus kinds |

Both are **direct heals only** — no damage, no HoT, no cleanse.

**Instant rule:** `castMs: 0` must complete without a visible cast bar, still
consume **GCD**, still reserve mana at cast start, still participate in
synergy arm/consume. Pin and test in `combat/` (`castMs: 0` path in
`beginCast` / advance). If 0-cast currently waits a frame, make that
behavior explicit and UI-safe (no stuck 0ms bar).

### D5 — Oath lightly colors Vowstrike

Not a second full tree. After both an oath and a Vowstrike aspect are owned,
apply **one small twist** via data (tree node or resolve-time rule):

| Oath × Aspect | Draft twist |
|---------------|-------------|
| Vigil × Virtue | Absolution mana **−1** |
| Vigil × Vengeance | Reckoning heal **+1** when target ≤50% HP (or reuse missing-health band) |
| Zealot × Virtue | Absolution GCD-feel: cast remains 0; **−1 mana** is taken by Zealot×Virtue OR Absolution arms +1 on next Zealous Mending |
| Zealot × Vengeance | Reckoning heal **+1** flat (aggressive finish) |

Implement with existing effect kinds (`castMod`, `synergy`, `missingHealthBonus`,
`fullHealthBonus`) preferred. Add a new kind only if unavoidable — document in
`combat/README.md` + tests.

### D6 — Crown: Wings CD + Vowstrike payoff

Shared crown requires owning **either** Vowstrike aspect node (any-of).

1. **`wrath-ascendant`** cooldown (grant via `grantCooldown`):
   - Name: Wrath Ascendant
   - Draft: **45s** CD; **12s** window; effect **new kind**
     `{ kind: 'healBonus'; durationMs; bonusHeal: 2 }` — all successful
     player heals add `bonusHeal` while active (off-GCD activate, same
     patterns as Frenzied Liturgy window).
   - Description copy should feel like Wings / Last Spell radiance-or-doom,
     not a mana crutch.

2. **Crown amp node** (same spot or adjacent 1-pointer): chosen Vowstrike
   gains **+1 heal** (or arms a one-charge free Vowstrike — prefer simple
   `castMod`/`synergy`/`bonus` on the granted spell id). This is the “crowned”
   feel so Wings isn’t the only button at the peak.

Still Waters / Frenzied Liturgy remain **oath-branch** CDs. Crown adds a
**third** CD for completed builds.

### D7 — Hotkeys / bar slots (stretch, not content-blocker)

- Desired end state: **Q W E R** + **Shift+Q/W/E/R** → max **8** actions
  (spells and CDs share the pool in display order).
- **Not required to land content.** If a small, isolated chunk can swap
  digit hotkeys → QWER/Shift after icons without delaying balance, do it;
  otherwise keep `1…N` for this phase and note QWER in `poc-qa.md` as next.
- Spell bar must tolerate **up to 8** buttons visually (compact with glyphs).

### D8 — Placeholder glyph icons (temp art exception)

Reopens CLAUDE.md “rects + text, no icons” **narrowly**:

- Tree spots and combat spell/CD buttons may show a **crappy placeholder
  glyph** (letter, simple geometric mark, or 16×16 drawn texture).
- **Hover still shows everything** (name, ranks, numbers, synergy lines).
- No polish creep: dark palette, monospace elsewhere, Kenney units unchanged.
- Add a stable `glyph` / `iconKey` on spell defs, cooldown defs, and tree
  content (or a single map in `ui/`) — journey names stay
  `treeNode:<spotId>`, `combatSpell:<id>`, `combatCooldown:<id>`.

### D9 — Balance contract changes

| Encounter | Gate after this phase |
|-----------|------------------------|
| Ash Gate | Preserve existing no-heal / naive / disciplined / maxed shape |
| Iron Pass / Cinder Vault / Verdant Rift | Maxed **crown** kits still clear (≥3 alive); mechanic still fires |
| **Black Choir** | **CLEARABLE** with maxed crown kits (each oath × each Vowstrike), ≥3 alive; Soul Toll burns ≥1 |
| The Maw | Still wipe with maxed kit ± any relic |

Update `balanceBot.ts` maxed saves to include shared mid + one Vowstrike path +
crown; teach the disciplined bot to **use Vowstrike instants** and **Wrath
Ascendant** under spike pressure.

### D10 — Save

- Rotate save key (**v5 → v6**) if tree rank ids / capacity assumptions break
  old payloads; delete stale (no migration), matching CLAUDE.md.
- Prefer keeping existing node ids that survive (oaths, synergies, CD grants)
  so narrative continuity is easier; removed mana nodes simply vanish on
  fresh saves.

### D11 — Status effects / cleanse

**Out of scope.** Next minor version: dungeon that applies poison/curse + a
cleanse spell. Do not build debuff UI or cleanse this phase.

### D12 — Respec

**No respec.** Restart only.

---

## Tree shape (authoritative sketch)

Positions/scroll: TreeScene already scrolls (`WORLD_HEIGHT`). Expect to extend
world height again; keep HUD `setScrollFactor(0)`; journey uses named targets
+ wheel — **no coordinate tables**.

### Shared early

| Spot (draft id) | Ranks | Effect intent |
|-----------------|-------|---------------|
| `deep-reserves` | **3** (was 5) | Still +mana/rank but smaller total; flavor as foundation, not endgame |
| optional 1-rank shared output | 0–1 | Only if bots show early points feel dead after mana move |

Prereq root unchanged: first Deep Reserves rank unlocks oaths.

### Oath wedge (existing, trimmed)

Keep:

- `vigil-oath` / `zealot-oath` + Warped Tempo forsaken chains
- Vigil: Patient Vow ×3 XOR Measured Devotion; Graven Scale on Patient path
- Zealot: Fervent Chain ×3; Steady Hands
- Branch CDs: Still Waters / Frenzied Liturgy
- Convert or remove: Deep Well, Spendthrift Grace (pure mana). Thrift / Quick
  Breath may stay as efficiency/tempo output.

### Shared mid (new)

`requires: { mode: 'any', nodes: [<any oath follow-up gate nodes>] }`

Draft 2–3 one-pointers, **output**:

- e.g. +1 heal on Solemn Mend; +1 heal on Zealous Mending; small cast trim on
  one baseline heal — exact ids/numbers for central agent to lock before
  delegating data chunk.

### Vowstrike fork (new exclusiveGroup: `vowstrike-aspect`)

| Spot | Grants | Support |
|------|--------|---------|
| `vowstrike-virtue` | `vowstrike-virtue` spell | 0–1 passive on Absolution |
| `vowstrike-vengeance` | `vowstrike-vengeance` spell | 0–1 passive on Reckoning |

Two-click arm for exclusives: **optional** — oaths already use two-click in
TreeScene for subclass; reuse that pattern for `vowstrike-aspect` if cheap,
else single click is acceptable (no respec anyway).

### Shared crown (new)

| Spot | Effect |
|------|--------|
| `wrath-ascendant` | `grantCooldown: wrath-ascendant` |
| `vowbound-crown` (or chain rank 2 on same spot) | +1 heal on owned Vowstrike id(s) |

---

## Chunks

Chunk 0 and final QA are **central agent**. Delegate middle chunks
sequentially when ownership overlaps.

| id | what | depends on | owns (files / dirs) | deliverable |
|----|------|------------|---------------------|-------------|
| **0** | Foundations: level→mana helper contract, `CombatEngineOptions` regen pin, instant-cast rule, Wings `healBonus` kind stub, save v6 if needed, draft constants | — | `game/src/combat/types.ts`, `engine.ts` (+tests), `game/src/data/constants.ts`, `game/src/save/save.ts` (+tests), `game/src/meta/progression.ts` (+tests), `combat/README.md` | Unit tests: level mana/regen applied; `castMs: 0` instant; `healBonus` CD window; save key rotation |
| **1** | Spell + cooldown data: both Vowstrikes, Wrath Ascendant def, glyphs keys | 0 | `game/src/data/constants.ts`, `spells.ts`, `cooldowns.ts` (+tests) | Catalog lookup; numbers match §D4/D6 drafts until balance chunk |
| **2** | SPELL_TREE hourglass rebuild + resolveCombatMods (oath×aspect twists) + loadout level bonuses | 0, 1 | `game/src/data/spellTree.ts` (+tests), `game/src/tree/AGENTS.md` | Config validates; loadout exposes new spells/CDs; twists covered by tests |
| **3** | Balance bots + gates: Black Choir clearable; Maw still wipe; Ash/mid preserved | 2 | `game/src/combat/balanceBot.ts`, `balance.test.ts`, dungeon `xpPerEnemy` / `xpForLevel` if pacing requires | `npm run content -- balance --all` sanity; `balance.test.ts` green |
| **4** | Glyph UI: TreeScene nodes + spellBar/CD buttons; tooltips unchanged in content | 1, 2 | `game/src/scenes/TreeScene.ts`, `game/src/ui/spellBar.ts`, `spellTooltip.ts`, `cooldownTooltip.ts`, small `ui/` glyph helper (+tests) | Nodes/buttons readable as glyphs; hover complete; journey names stable |
| **5** *(stretch)* | QWER + Shift hotkeys, max 8 slot layout | 4 | `CombatScene.ts` hotkey registration, `spellBar.ts` labels | Digits replaced or dual-supported; documented in poc-qa |
| **6** | Journey coverage for new tree depth + QA docs | 3, 4 (,5) | `game/scripts/journey.mjs`, `docs/poc-qa.md`, this handoff → historical, `AGENTS.md` active-mission clear | Full `npm run verify` green |

**Non-goals / reject list**

- Status effects, poison/curse, cleanse, player HoTs
- Respec / refund talents
- Beacon-of-Light multi-target bond (crown is Vowstrike + Wings instead)
- Real art pass / polished icon set
- Aegis / Wildbloom / multiclass
- Proc/FCT framework, hub buffs, networking
- Making The Maw clearable
- QWER if it jeopardizes verify timeline (park in poc-qa)

---

## Pinned public API contracts

Central agent fills exact signatures in subagent prompts. Sketches:

### Level mana (pure)

```ts
// preferred location: meta/progression.ts or data/constants.ts
export function manaBonusesForLevel(level: number): {
  bonusMaxMana: number;
  manaRegen: { amount: number; intervalMs: number } | null;
};
```

`loadoutFromSave` includes these in `CombatMods` (extend interface) so
CombatScene passes them into the engine.

### CombatMods additions

```ts
// spellTree.ts CombatMods — add:
manaRegen?: { amount: number; intervalMs: number };
// bonusMaxMana already exists — level mana ADDS to tree/relic totals at loadout time
```

### CooldownEffect

```ts
| { kind: 'healBonus'; durationMs: number; bonusHeal: number }
```

While `buffRemainingMs > 0`, each completed player heal adds `bonusHeal` to the
raw heal (before overheal split), identical stacking rules to document in
README (draft: **after** synergy/missing/full-health bonuses, or before —
**lock one order in chunk 0** and test).

### Instant cast

`SpellDef.castMs === 0` ⇒ no cast bar occupancy; GCD still applies; mana
reserved/consumed per existing heal rules.

### Glyph

```ts
// on SpellDef / CooldownDef and/or SpellTreeContent
glyph: string; // single character or key into ui glyph map
```

---

## Micro-choices pre-locked for subagents

1. Vowstrike aspect exclusiveGroup id: `vowstrike-aspect`.
2. Wings id: `wrath-ascendant`; effect kind: `healBonus`.
3. Virtue id: `vowstrike-virtue`; Vengeance id: `vowstrike-vengeance`.
4. No cleanse/HoT kinds.
5. Black Choir gate flips wipe → clear; Maw unchanged.
6. Temp glyphs only; Kenney unit art untouched.
7. Every new interactive control gets `setName` per
   [`semantic-targets-handoff.md`](./semantic-targets-handoff.md).
8. Tune with balance bots / telemetry scripts; delete diagnostics after.
9. Integers only; keep printed heals/mana roughly 1–10.

---

## Verification gates

From `game/`:

```bash
npm run verify:fast   # minimum after each chunk
npm run verify        # required before phase victory (save/scenes/spells/tree)
npm run content -- validate
npm run content -- balance --all
```

Definition of done per chunk = owned tests green + `verify:fast` (central
agent runs). Final chunk = full `verify` + poc-qa writeup.

---

## Open tunables (central agent decides with bots — not user blockers)

- Exact XP curve flatten vs per-dungeon XP bump mix
- Shared mid passive list (2 vs 3 nodes)
- Whether crown is one spot chain (CD then amp) or two spots
- Two-click arm for Vowstrike exclusives
- Stretch QWER in or out

---

## Document history

| Version | Date | Notes |
|---------|------|-------|
| v1 | 2026-07-15 | Planning handoff from design clarification (Vowstrike crown, level mana, glyphs, Black Choir clearable) |
