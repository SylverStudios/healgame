# Road to 1.0 — Player mechanics handoff

Status: planning · Authority: this file wins for v1 player-progression
mechanics (scope below) · Last verified: 2026-07-31

Roadmap frame: **Mechanics → Balance → Polish → Juice**. This document locks
**player out-of-combat systems** + the engine seams they need. Enemy /
in-combat ability redesign is a later mechanics slice. **Numeric magnitudes**
for modifiers, secondary ranks, and new CD power are **deferred to Balance** —
Mechanics ships working systems with stub/placeholder values that keep
`balance.test.ts` green (secondaries default harmless; new CDs may be
near-copies of existing verbs until Balance retunes).

Remote agent entry prompt:
[`v1-mechanics-agent-prompt.md`](v1-mechanics-agent-prompt.md).

Related (lower authority):

- Cards PoC (partially superseded): [`spell-cards-poc-handoff.md`](spell-cards-poc-handoff.md)
- Chip feel bible: [`relic-revamp-brainstorm.md`](relic-revamp-brainstorm.md)
- Playtest CD cluster: [`playtest-2026-07-30.md`](playtest-2026-07-30.md) §H
- J26 (points from clears): [`poc-qa.md`](poc-qa.md)

---

## 1. Mission

Commit the game to the **spell-card path** as the real progression loop, then
extend it into four player systems:

1. **Loadout** — exactly four equipped abilities; player chooses which four.
2. **Modifiers** (today’s chips) — significant spell mutations after dungeon
   clears, authored 3-way drafts.
3. **Upgrades** (new) — secondary stats chosen on every level-up
   (block / crit / haste / manaRegen).
4. **Cooldown choice** — at levels 6 and 8, pick one major CD from an authored
   set of three (**Set A** = existing three; **Set B** = three **new distinct**
   CD ids).

**Cards is the default** for new saves. Lattice + radial remain dual-shipped
until a **separate removal pass** (out of this handoff).

### Done means (all must be true)

1. Fresh install → `progressionMode: 'cards'` (no Settings spelunking).
2. Hub in cards mode exposes **4-slot equip UI** (unhide `LoadoutScene` /
   `hubLoadout`) and **Spells** album.
3. Clear → `upgradePoints` → modifier draft works; live catalog is
   **significant-only** (power-only chips parked/removed from offers).
4. Every level-up: player picks **one of four** secondaries to rank up; ranks
   persist; fight kit applies them.
5. Engine supports: deterministic tank **block** (every-N damage),
   deterministic **crit** (every-N casts), **haste** (castMs only),
   **mana regen** stacking.
6. Level 6 → pick 1 of Set A (3); level 8 → pick 1 of Set B (3 distinct new
   CDs). Chosen ids persist. No auto-grant of all three legacy majors.
7. Save bumped if golden fixtures break; journey names for new controls.
8. `npm run verify` green.

---

## 2. Locked product decisions

| # | Decision |
|---|----------|
| D1 | Internal/UX glossary: chips → **modifiers**; level-up secondaries → **upgrades**. Code may keep `spellChips` / `CardChip*` until cleanup. |
| D2 | **Four ability slots** (`ACTION_BAR_SLOTS = 4`). Cards Hub must expose equip UI. |
| D3 | Major CDs stay on **Shift+QWER** — not one of the four slots. |
| D4 | **Modifiers** = significant mechanical changes only (new rule, playstyle fork, cross-ability interaction). Flat +power/−mana/−cast without a decision change are **out of live offers**. |
| D5 | Modifier currency = **`upgradePoints` from dungeon victories** (J26). Level-ups do **not** grant modifier points. |
| D6 | Modifier offers stay **authored fixed trios** (no RNG). **2 slots** per upgradable spell (`heal` / `mend` / `bonk` / `vowstrike`). |
| D7 | No modifier slots on majors in this slice. |
| D8 | **Upgrades**: on **every level-up**, choose **1 of 4** secondaries (`block`, `crit`, `haste`, `manaRegen`). One pick per level gained. Ranks stack. |
| D9 | Magnitudes live in `data/` tables keyed by rank — **not** baked into SaveData (save stores ranks / chosen ids only). |
| D10 | **Block (tank only, deterministic):** no RNG. Tank accumulates incoming damage; **every N damage, block 1** (reduce that hit by 1, carry remainder). Upgrades **reduce N**. See §5.3. |
| D11 | **Crit (deterministic, cast-based):** every N **completed player casts**, that cast crits (+50% = 500 permille). Applies to player heal and player spell damage. Same carry model as block. **No RNG.** |
| D12 | **Haste:** % reduction of **player castMs only**. **GCD unchanged.** |
| D13 | **Mana regen:** stacks via existing merge (sum amount, min interval). |
| D14 | Crit and block are both deterministic accumulators — no `CombatEngineOptions.rng` for secondaries. |
| D15 | Rates use **integers** (permille bonuses, damage/cast thresholds). |
| D16 | **CD choice:** L6 → Set A (existing `still-waters`, `wrath-ascendant`, `frenzied-liturgy`); L8 → Set B (**three new distinct CD ids**). Max two majors. |
| D17 | Chosen CD ids **persist on save**. Cards loadout reads save, not `cooldownIdsAtLevel` auto list. |
| D18 | **Default** `newSaveData().progressionMode = 'cards'`. Settings still offers Classic / Radial / Spell cards (wipe on switch). |
| D19 | Lattice / radial / relics **deletion is separate work**. |
| D20 | Balance owns final magnitudes, modifier curation polish, Set B power, and balance-bot retune if needed. |
| D21 | **Future hint (do not build):** Upgrade offers should eventually feel like **gear** — thematic to the dungeon just cleared / current progress, presented as item slots (chest, legs, hands, boots, shoulders, head, rings, necklace). Leave a short `// Future:` comment + note in `data/secondaryStats.ts` (or upgrades module). Current ship = flat 4-choice every level. |

---

## 3. Current reality (baseline)

Facade: `Save → loadoutForSave(save) → CombatMods → CombatEngine`.

| Area | Today | Target |
|------|-------|--------|
| Default mode | `lattice` | `cards` |
| Loadout UI | Exists; **hidden** in cards Hub | Visible in cards |
| Modifiers | 24 chips, mixed power + mechanical | Significant-only offers |
| Level-up | HP + free unlocks | + Upgrade picker (4 secondaries) |
| Block / crit / haste | Missing (flat relic armor ≠ block) | Engine + ranks |
| Majors (cards) | Auto Still@6 Wrath@7 Liturgy@8 | Choice Set A @6, Set B @8 |

Key paths:

- `game/src/data/cards/unlocks.ts` — free unlock table
- `game/src/data/cards/chips.ts` — modifier catalog
- `game/src/data/cards/resolve.ts` — loadout + purchase
- `game/src/scenes/CardAlbumScene.ts` — album + draft
- `game/src/scenes/LoadoutScene.ts` — 4-slot equip
- `game/src/meta/progression.ts` — `applyCombatResult`
- `game/src/data/cooldowns.ts` — major CD defs
- `game/src/save/save.ts` — `SaveData`, `newSaveData`
- Engine: `applyDamageToUnit` / `damageAfterArmor`, `completePlayerCast`, `beginCast`

---

## 4. Target player loop (cards)

```
Hub
  ├─ Loadout (equip ≤4 owned spells)     [hubLoadout]
  ├─ Spells album (spend modifier pts)   [hubTree → CardAlbum]
  └─ Enter dungeon
       → Combat (+XP always)
       → Clear: +1 upgradePoints
       → Level-up(s): party HP + free spell unlocks
                      + Upgrade picker (1 of 4 secondaries)
                      + at L6 / L8: CD type picker if not yet chosen
       → Hub: spend modifiers when ready
```

### Free unlock cadence (cards)

| Level | Free unlock |
|-------|-------------|
| 1 | spells: heal, bonk |
| 2 | spell: mend |
| 5 | spell: vowstrike |
| 6 | **CD choice Set A** (not auto Still Waters) |
| 7 | — (no auto Wrath) |
| 8 | **CD choice Set B** (three new distinct CDs) |

Spell free-unlocks still use `CARD_UNLOCKS` / `applyCardsLevelUps`. Cooldown
rows are **removed** from the auto table; choice + `chosenCooldownIds` replace
them.

---

## 5. System specs

### 5.1 Loadout (4 slots)

- Reuse `actionBar`, `spellsFromActionBar`, journey `loadoutSlot:*` /
  `loadoutPick:*`.
- Cards Hub: **show** `hubLoadout` → `LoadoutScene` (smallest ship). Keep
  album as Spells CTA.
- Library may exceed 4; unequipped spells remain owned.
- Auto-`placeOnActionBar` on unlock may remain as convenience.

### 5.2 Modifiers (ex-chips)

- Economy unchanged: victory → `upgradePoints += 1`.
- Spend UX: existing album draft (`cardChipOffer:*`).
- **Catalog policy:** remove or stop offering pure number bumps
  (`heal-power`, `bonk-crush`, `mend-spark`, etc.). Keep mechanical /
  synergy / castBuff / conditional chips. Prefer existing `CardChipEffect`
  hooks; add engine hooks only if a kept modifier cannot express.

### 5.3 Upgrades (secondaries)

**Save (ranks only):**

```ts
secondaryRanks: Partial<Record<SecondaryId, number>>
// SecondaryId = 'block' | 'crit' | 'haste' | 'manaRegen'
```

Optional pending interrupt:

```ts
pendingUpgradeLevel?: number  // or count of unclaimed level-up picks
```

**Each level-up:** offer all four; player picks one; that id’s rank += 1.

**Data table** (`game/src/data/secondaryStats.ts` — new):

```ts
// Stub magnitudes OK — Balance retunes. Keep crown kits ~safe.
export const SECONDARY_RANK_EFFECTS: Record<SecondaryId, (rank: number) => SecondaryFightMods>
```

**Block — deterministic tank every-N (no RNG):**

- Runtime on tank only: maintain `blockDamageCarry` (integer, starts 0).
- On incoming damage `D` to tank (after or before flat armor — **locked:
  apply block after role armor, still floor ≥ 1 unless full block of tiny
  hits is desired; prefer: armor first, then block against post-armor
  amount, floor 1 if any damage remains and hit was not fully blocked**).
- Algorithm:

  ```
  carry += postArmorDamage
  blocked = floor(carry / N)
  carry = carry % N
  finalDamage = max(0, postArmorDamage - blocked)
  // if finalDamage > 0, existing floor-1 rule may still apply — pick one
  // consistent rule in implementation and unit-test it.
  ```

- `N = blockThreshold(rank)` — **higher rank → smaller N** (block more often).
  Stub example (Balance replaces): rank 0 = no block; rank 1 → N=20; each
  rank −2 N, min N=5 (example only).
- Emit `blocked?: number` (or boolean) on `damage` events for future juice.
- **Not** probabilistic. **Not** %-DR. **Not** whole-party.

**Crit — deterministic every-N casts:**

- `critThresholdN(rank)`, `critBonusPermille` (stub 500 = +50%).
- Each **completed** player cast: `carry += 1; procs = floor(carry / N);
  carry %= N`. When `procs > 0`, that cast crits. Cancelled casts do not
  advance carry. Hybrid damage+heal shares one tick.
- After heal/damage raw assembled in `completePlayerCast`, before overheal
  split / apply: multiply by `(1000+bonus)/1000` with **integer floor**.
- `crit?: boolean` on heal/damage events.
- Rank 0 / omit = disabled. Higher rank → smaller N.

**Haste — castMs only:**

- In `beginCast`: `effectiveCastMs = max(0, floor(spell.castMs * (1000 - hastePermille) / 1000))`.
- **Do not** change `GCD_MS`.

**Mana regen:**

- Map ranks → `{ amount, intervalMs }` delta folded into existing
  `CombatMods.manaRegen` merge.

**Future hint (D21):** comment in the upgrades module that offers will become
dungeon-thematic **gear slot** picks (chest / legs / hands / boots /
shoulders / head / rings / necklace). Do not implement gear UI now.

**UI:** Hub modal after level-ups detected — four options, journey names
e.g. `upgradeOffer:block`, `upgradeConfirm`. Sequential if multiple levels.

### 5.4 Cooldown choice

**Save:**

```ts
chosenCooldownIds: string[]  // 0..2, order = acquisition order
```

**Sets:**

| Gate | Set | Contents |
|------|-----|----------|
| Level ≥ 6 | A | `still-waters`, `wrath-ascendant`, `frenzied-liturgy` |
| Level ≥ 8 | B | **Three new distinct ids** (author stub defs in `cooldowns.ts`) |

**Set B stubs (Mechanics must ship real selectable defs):** invent three
distinct verbs that reuse existing `CooldownDef` effect fields where possible
(e.g. variants: stronger short window, party shield-style if expressible,
instant free mend wrap, etc.). If a verb needs a new engine effect field,
prefer composing from existing `freeNextHeal` / `manaCostReduction` /
`healBonus` / duration / cooldownMs first. Names/ids TBD by implementer but
must not collide with Set A. Balance will retune numbers and may replace
fantasy later.

**UI:** three-card pick (reuse chip/relic modal patterns). Journey:
`cooldownOffer:<id>`, confirm/cancel as needed.

**Resolve:** `loadoutFromCardSave` → `CombatMods.cooldowns` from
`chosenCooldownIds` only (validated against known defs).

### 5.5 Engine / determinism

1. Optional secondaries on options / `CombatMods` — omit = today’s behavior.
2. Block uses accumulator state on engine (tank), not RNG.
3. Crit uses cast-count accumulator (player casts), not RNG.
4. Event flags for later juice.
5. Balance bots: leave secondaries at 0 on crown kits unless intentionally
   testing.

---

## 6. Work chunks

| id | Owner | What | Depends |
|----|-------|------|---------|
| M0 | central | Confirm docs; flip default to cards in plan; save field design | — |
| M1 | central | Save fields + `save:bump`; `newSaveData` default `'cards'`; stubs in data | M0 |
| M2 | subagent | Engine: haste + manaRegen secondary path + tests | M1 |
| M3 | subagent | Engine: deterministic tank block every-N + crit + rng + events + tests | M2 |
| M4 | subagent | Level-up Upgrade picker UI + Hub interrupt + journey names | M1–M3 |
| M5 | subagent | CD Set A/B data, unlock table change, picker UI, resolve, tests | M1 |
| M6 | subagent | Cards Hub unhide loadout | M1 |
| M7 | subagent | Modifier catalog significant-only (park power chips) | M0 |
| M8 | central | Integration, journey, full `npm run verify`, open PR | M2–M7 |

---

## 7. Open decisions — RESOLVED

| # | Resolution |
|---|------------|
| O1 | **Yes** — default `progressionMode` to `'cards'`. |
| O2 | **Always all 4** secondaries each level-up. Future: dungeon-thematic gear-slot presentation (D21) — not built now. |
| O3 | **Tank only.** Deterministic every-N block (not chance). |
| O4 | Armor then block (see §5.3); document in tests. |
| O5 | **Haste = castMs only**; GCD untouched. |
| O6 | **Set B = three new distinct CD ids.** |
| O7 | Same id cannot appear in both sets. |
| O8 | Multi-level → sequential modals (Upgrade per level; CD when gate crossed). |
| O9 | Modifier spend stays Hub/album (not forced post-clear). |
| O10 | Retire unlucky/lucky point flavor; L6/L8 copy may mention CD choice. |

---

## 8. Non-goals

- Final balance numbers / modifier power / Set B potency
- Deleting lattice, radial, relics, tree service
- Enemy ability redesign, trash curriculum, interrupt/esuna
- Wrap-verb CD redesign; CD modifier chips
- Theme-evolve / gear-slot Upgrade UI (hint only)
- Polish/juice beyond event flags needed for later VFX

---

## 9. Definition of done checklist

- [x] Default new save is cards
- [x] Loadout reachable in cards Hub
- [x] Modifiers = significant-only offers
- [x] Level-up Upgrade picker (4 secondaries) works + persists ranks
- [x] Block every-N tank-only deterministic; crit/haste/regen work
- [x] CD choice Set A @6, Set B @8; persist; distinct Set B defs
- [x] Future gear-slot hint comment present
- [x] Save version OK; journey names; `npm run verify` green
- [x] PR opened with try-steps
