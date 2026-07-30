# Spell-card upgrades PoC — handoff

Status: planning · Authority: this file wins for the spell-cards PoC · Last
verified: 2026-07-30

Design background (non-authoritative once this handoff exists):

- [`spell-card-upgrades-brainstorm.md`](spell-card-upgrades-brainstorm.md) —
  mode shape, dual-ship, unlock cadence
- [`relic-revamp-brainstorm.md`](relic-revamp-brainstorm.md) — **feel bible** for
  chip fantasy (Z/S/R archetypes, “change the decision,” wild modifiers). In
  cards mode those ideas map to **spell chips**, not a relic catalog.

Remote agent entry prompt:
[`spell-cards-poc-agent-prompt.md`](spell-cards-poc-agent-prompt.md).

---

## 1. Mission

Ship a **third progression mode** (`cards`) dual-shipped beside lattice and
radial so friends can A/B: no relics, no talent-tree path — **spell/CD cards
with upgrade chips**, free level unlocks, spend points on **authored 3-way
choices** per slot.

**Done means (all must be true):**

1. Settings offers **Classic | Radial | Spell cards**. Switching modes confirms,
   wipes save, restarts Tutorial (same UX as today’s Classic↔Radial).
2. Fresh **Spell cards** save: Heal + Bonk on the bar; album shows both cards
   with empty slots; **1 unspent upgrade point** at level 1 (or equivalent CTA
   so the player knows to open Spells).
3. Leveling grants **+1 upgrade point per level** and free unlocks per §3
   table (Mend, Vowstrike, then one major CD per level 6–8).
4. Player can spend a point: pick a spell with a free slot → see that slot’s
   **fixed set of 3 chips** → pick 1 → slot fills → next fight uses the baked
   numbers / synergies. Slot 1 sets teach synergies; slot 2 sets are wilder.
5. **RelicScene never opens** in cards mode (first-clear does not offer relics;
   bonus upgrade point instead — §3).
6. Hub in cards mode has a single **Spells** entry (album); tree wheel / lattice
   are not reachable. Lattice + radial journeys and Settings toggles still work.
7. `npm run verify` green on the PR branch (prefer full verify before PR).

---

## 2. Locked product decisions

| # | Decision |
|---|---|
| D1 | Mode id: `progressionMode: 'cards'`. Settings label: **Spell cards**. |
| D2 | Relics **fully replaced** in cards mode. `relicIds` stays `[]`; never set `pendingRelicOffers`. Relic *fantasy* lives on chips — see [`relic-revamp-brainstorm.md`](relic-revamp-brainstorm.md). |
| D3 | Spend currency = **upgrade points only**. No tree ranks / no radial spots. |
| D4 | Spells + major CDs unlock **free on level** (§3). Unlock does not spend a point. |
| D5 | Tree + spellbook **merge** into one album scene. Hub: one button **Spells** (reuse `hubTree` name → album; hide or no-op `hubLoadout` in cards mode). |
| D6 | Chip offers: **fixed authored sets** — each upgradable spell has **exactly 6 chips** = **slot-1 trio** + **slot-2 trio**. No RNG in PoC. (RNG pools later if the loop feels fun.) |
| D7 | **2 upgrade slots** per spell card. Filling slot 1 offers the slot-1 trio; filling slot 2 offers the slot-2 trio. Major CD cards: unlock + show on album; **no chip slots in PoC**. |
| D8 | Slot-1 trios **feature synergies / relationship chips** (Arming Mend, Battle Mend, Mend→Heal links, Bonk/Vowstrike→Mend). Slot-2 trios are **wilder playstyle forks** (brinkmanship, commit trades, pressure) inspired by the relic revamp doc — still only existing `CombatMods` hooks. |
| D9 | Synergy chips emit existing `CombatMods` fields (`synergies`, `manaSynergies`, missing/full HP bonuses, castMods, castBuff, manaOnHit) — **no new engine rules**. |
| D10 | Vowstrike at 5 **adds beside Bonk** (does not replace). |
| D11 | First-clear in cards mode: **+1 bonus upgrade point** (no relic draft). |
| D12 | Base spell defs: **reuse radial catalog** ids. Cooldowns: existing `still-waters`, `wrath-ascendant`, `frenzied-liturgy`. |
| D13 | Switching to/from cards **wipes save**. Save schema bump via `npm run save:bump` when shape breaks golden fixture. |
| D14 | Default fresh install stays **`lattice`**. Cards is opt-in via Settings. |
| D15 | Chip magnitudes: **flat integers** (repo law). |

---

## 3. Level unlock table (authoritative)

| Level | Free unlock | Kind |
|---|---|---|
| 1 (start) | `heal`, `bonk` | spells (starters) |
| 2 | `mend` | spell |
| 3–4 | — | upgrade point only |
| 5 | `vowstrike` | spell |
| 6 | `still-waters` | major CD |
| 7 | `wrath-ascendant` | major CD |
| 8 | `frenzied-liturgy` | major CD |
| 9+ | — | upgrade point only |

On level-up: always `upgradePoints += 1` (including the level that also
unlocks content). When crossing a threshold, grant the unlock into the owned
library and auto-equip spells into the first free action-bar slot (mirror
radial grant). CDs appear on the combat CD row via `CombatMods.cooldowns`.

**Big Heal / specialize forms / oaths:** out of PoC.

---

## 4. Feel contract (from relic revamp → chips)

Read [`relic-revamp-brainstorm.md`](relic-revamp-brainstorm.md) §2–§3 before
authoring chip copy. Rule of thumb adapted for cards mode:

> Tree used to be *how you cast*. Relics were meant to be *what the fight asks
> when you cast that way*. **Chips now own both** on the spell card: slot 1
> teaches relationships; slot 2 asks you to commit to a style.

Archetype letters (Z / S / R / X) are optional flavor in chip `description` /
comments only — no UI badge required in PoC. Prefer “change the decision” over
pure number-go-up, especially on **slot 2**.

If a chip is only “+1 forever with no trade,” put it on slot 1 as teaching
sugar, not on slot 2.

---

## 5. Architecture seam (do not break)

```
Save  →  loadoutForSave(save)  →  CombatMods  →  CombatEngine / scenes
              │
              ├─ lattice → loadoutFromSave
              ├─ radial  → loadoutFromRadialSave
              └─ cards   → loadoutFromCardSave   ← NEW
```

- Combat / scenes must **not** branch on tree topology; only call
  `loadoutForSave` / `ownedSpellsForSave` (extend facade).
- Engine purity unchanged. Chips may only produce effect kinds in §7.

---

## 6. Save shape (Chunk 0)

Extend `ProgressionMode` with `'cards'`.

```ts
/** Unspent chip drafts. Lattice/radial ignore (treat as 0). */
upgradePoints: number;

/**
 * spellId → ordered chip ids filling slots (length 0..CARD_SLOTS).
 * Index 0 = slot-1 pick; index 1 = slot-2 pick.
 * Only spell ids (not cooldown ids) in PoC.
 */
spellChips: Record<string, string[]>;
```

Pinned defaults for `newSaveData('cards')`:

- `progressionMode: 'cards'`
- `unlockedSpells: ['heal', 'bonk']` (keep in sync with level unlocks)
- `actionBar: defaultRadialActionBar()` (Bonk Q, Heal W)
- `treeRanks: {}`
- `upgradePoints: 1` on new cards save
- `spellChips: {}`
- `relicIds: []`, `pendingRelicOffers: []`
- `subclass: null`

Prefer **always** persist `upgradePoints` + `spellChips` on all modes
(`0` / `{}` defaults) so one save shape.

Follow [`.claude/skills/rotate-save-version/SKILL.md`](../.claude/skills/rotate-save-version/SKILL.md).

---

## 7. Public API contracts

### 7.1 Unlock table — `game/src/data/cards/unlocks.ts`

```ts
export const CARD_SLOTS = 2;

export interface CardUnlock {
  id: string;
  kind: 'spell' | 'cooldown';
  minLevel: number;
}

export const CARD_UNLOCKS: readonly CardUnlock[];

export function unlocksAtOrBelowLevel(level: number): CardUnlock[];
export function spellIdsAtLevel(level: number): string[];
export function cooldownIdsAtLevel(level: number): string[];
```

Must encode §3 exactly.

### 7.2 Chip defs — `game/src/data/cards/chips.ts`

```ts
export type CardChipEffect =
  | { kind: 'castMod'; spellId: string; castMsDelta?: number; manaDelta?: number; healDelta?: number; damageDelta?: number; cooldownMsDelta?: number }
  | { kind: 'synergy'; triggerSpellId: string; buffedSpellId: string; bonusHeal: number }
  | { kind: 'manaSynergy'; triggerSpellId: string; targetSpellId: string; manaDelta: number }
  | { kind: 'missingHealthBonus'; spellId: string; healPer10PctMissing: number }
  | { kind: 'missingHealthPctBonus'; spellId: string; pctPer10PctMissing: number }
  | { kind: 'fullHealthBonus'; spellId: string; hpPctAtLeast: number; bonusHeal: number }
  | { kind: 'setManaOnHit'; spellId: string; amount: number }
  | { kind: 'setCastBuff'; spellId: string; castBuff: SpellCastBuff };

export interface CardChipDef {
  id: string;
  name: string;
  description: string;
  spellId: string;
  /** 0 = first upgrade on the card; 1 = second. */
  slotIndex: 0 | 1;
  effects: CardChipEffect[];
  /** Optional flavor tag from relic revamp (Z/S/R/X) — comments/tests only. */
  archetype?: 'Z' | 'S' | 'R' | 'X';
}

export const CARD_CHIPS: readonly CardChipDef[];
export function chipById(id: string): CardChipDef | undefined;

/** Exactly the three authored offers for this spell + slot. */
export function chipOffersForSlot(
  spellId: string,
  slotIndex: 0 | 1,
): readonly [string, string, string];
```

Invariant: for each of `heal` | `mend` | `bonk` | `vowstrike`, there are
exactly **3 chips with slotIndex 0** and **3 with slotIndex 1** (6 total).
`chipOffersForSlot` returns those three ids in stable display order.

### 7.3 Offers helper — `game/src/data/cards/draft.ts` (or fold into chips.ts)

```ts
/** Next slot to fill = current spellChips[spellId].length (must be 0 or 1). */
export function offersForNextSlot(
  spellId: string,
  ownedChipIds: readonly string[],
): readonly [string, string, string] | null;
```

Returns `chipOffersForSlot(spellId, ownedChipIds.length)` when
`ownedChipIds.length < CARD_SLOTS`, else `null`. No RNG.

### 7.4 Resolve — `game/src/data/cards/resolve.ts`

```ts
export function loadoutFromCardSave(save: {
  xp: number;
  actionBar: string[];
  spellChips: Record<string, string[]>;
}): CombatMods;

export function ownedSpellsFromCardSave(save: …): SpellDef[];

export function applyCardsLevelUps(save: SaveData, prevLevel: number, nextLevel: number): void;

/** Spend 1 point; chip must be in offersForNextSlot for that spell. */
export function applyChipPurchase(save: SaveData, spellId: string, chipId: string): boolean;
```

`loadoutFromCardSave` steps:

1. Clone radial spell defs for spells unlocked at current level.
2. Clone cooldown defs for CDs unlocked at current level.
3. Apply each owned chip in slot order → mutate clones / collect synergies,
   manaSynergies, missing/full HP bonus lists.
4. Return `CombatMods`.

### 7.5 Facade — `game/src/data/loadout.ts`

Branch `progressionMode === 'cards'`.

### 7.6 Progression / relics

- Cards mode: on level-up call `applyCardsLevelUps`.
- Cards mode: **skip** relic offers; first-clear → `upgradePoints += 1`.
- Hub CTA: light **Spells** when `upgradePoints > 0`.

---

## 8. Authored chip sets (ship these ids)

Six chips per spell. Magnitudes are starting points — Chunk 5 may retune.
Copy should stay plain-English (radial naming rule). Parenthetical notes map to
[`relic-revamp-brainstorm.md`](relic-revamp-brainstorm.md) ideas — implement
only the effect column.

### `heal` — 6 chips

**Slot 1 — synergy / teach the strip**

| id | name | archetype | effects |
|---|---|---|---|
| `heal-mend-link` | Mend Link | X | synergy: `mend` → `heal` +2 |
| `heal-power` | Power Up | S | castMod heal +2 |
| `heal-cost` | Cost Cut | Z | castMod mana −1 (clamp mana ≥ 1) |

**Slot 2 — wild fork**

| id | name | archetype | effects | Relic-revamp cousin |
|---|---|---|---|---|
| `heal-graven` | Graven Light | S | missingHealthPctBonus on heal, pctPer10PctMissing 10 | Graven Hourglass / Hollow Mercy |
| `heal-heavy` | Heavy Cast | S | heal +3, castMs +500 | Measured / commit Solemn |
| `heal-steady` | Steady Hands | Z | fullHealthBonus hpPctAtLeast 80, bonusHeal +2 | Steady Ignition / top-off |

### `mend` — 6 chips

**Slot 1 — synergy identity (the fun fork)**

| id | name | archetype | effects |
|---|---|---|---|
| `mend-arming` | Arming Mend | X | synergy: `mend` → `heal` +2 |
| `mend-battle` | Battle Mend | R | manaSynergy: `bonk`→`mend` −1, `vowstrike`→`mend` −1 |
| `mend-quick` | Quick Mend | Z | castMod castMs −400 |

**Slot 2 — wild**

| id | name | archetype | effects | Cousin |
|---|---|---|---|---|
| `mend-penny` | Penny Mend | S | castMod mana set via manaDelta to reach 0 cost (manaDelta −1 if base 1) | Thrift Seal energy |
| `mend-graven` | Brink Mend | S | missingHealthBonus healPer10PctMissing +1 | Graven / scary Solemn |
| `mend-spark` | Spark Mend | Z | castMod heal +1, castMs −200 | Ember Cadence-lite (active mend) |

### `bonk` — 6 chips

**Slot 1 — weave / synergy**

| id | name | archetype | effects |
|---|---|---|---|
| `bonk-battle` | Battle Link | R | manaSynergy: `bonk` → `mend` −1 |
| `bonk-blessed` | Blessed Bonk | R | setCastBuff stackNextHealPotencyPct pct 10 cap 3 |
| `bonk-mana` | Mana Bonk | Z | setManaOnHit 1 |

**Slot 2 — wild pressure**

| id | name | archetype | effects | Cousin |
|---|---|---|---|---|
| `bonk-crush` | Crushing Bonk | R | castMod damage +2 | pressure |
| `bonk-reckoning` | Reckoning Weight | R | setCastBuff stackNextHealPotencyPct pct 15 cap 3 (or pct 10 cap 5) | Reckoning Weight |
| `bonk-quicksteel` | Quicksteel | X | setCastBuff nextHealPotencyPct 25 | Quicksteel Rosary (instant → next heal) |

Note: if slot 1 already took `bonk-blessed`, slot 2 `bonk-reckoning` /
`bonk-quicksteel` **replace** castBuff (last applied wins in resolve — document
in resolve: later chip overwrites `castBuff`). Prefer picking distinct fantasy;
tests cover overwrite.

### `vowstrike` — 6 chips

**Slot 1 — synergy / aspect lite**

| id | name | archetype | effects |
|---|---|---|---|
| `vs-battle` | Battle Link | R | manaSynergy: `vowstrike` → `mend` −1 |
| `vs-absolution` | Absolution Lite | S | setCastBuff nextSpellManaReduction 1 |
| `vs-reckoning` | Reckoning Lite | R | setCastBuff nextHealPotencyPct 20 |

**Slot 2 — wild**

| id | name | archetype | effects | Cousin |
|---|---|---|---|---|
| `vs-ready` | Ready Strike | Z | castMod cooldownMs −2000 | tempo |
| `vs-crush` | Crush | R | castMod damage +2 | pressure |
| `vs-weight` | Heavy Vow | R | castMod damage +1 + setCastBuff nextHealPotencyPct 30 | Reckoning Weight amp |

---

## 9. UI / journey contracts (Chunk 3)

### Scene

- New `CardAlbumScene` (`SceneKeys.CardAlbum = 'CardAlbum'`).
- Hub cards mode: `hubTree` → `CardAlbum` (label **Spells**).
- `hubLoadout`: hidden in cards mode.

### Semantic names (add to `docs/semantic-targets.md`)

| Name | Object |
|---|---|
| `settingsProgressionCards` | Spell cards mode button |
| `cardAlbumBack` | back |
| `cardSpell:<spellId>` | spell card hit target |
| `cardUpgrade:<spellId>` | upgrade affordance |
| `cardChipOffer:<chipId>` | draft modal offer |
| `cardChipConfirm` | confirm (if separate) |
| `cardChipCancel` | cancel draft |

### Draft modal

Show the **fixed three** for the next empty slot. Name + description; castMod
chips show before→after Cost/Power/Speed when cheap; synergy chips show the
one-liner. Confirm → `applyChipPurchase` + `saveGame()`.

### Journey smoke (cards)

Settings→Spell cards→confirm→Tutorial→Hub→`hubTree`→ upgrade Heal (pick any
slot-1 offer) → Ash Gate. Lattice/radial journeys stay green.

---

## 10. Chunk table

| Chunk | What | Depends | Owns | Do not touch |
|---|---|---|---|---|
| **0** Central | Mode shell, save + bump, Settings third button, loadout stub, relic skip, Hub route stub | — | `save/`, `data/loadout.ts`, `SettingsScene.ts`, `HubScene.ts`, `meta/progression.ts`, `scenes/keys.ts` | chip tables, album polish, engine |
| **1** | Unlock table + level-up grants + points + tests | 0 | `data/cards/unlocks.ts`, resolve unlock portion, `meta/progression.ts` | draft UI |
| **2** | All 24 chips, `chipOffersForSlot` / `offersForNextSlot`, resolve apply (incl. missing/full HP), purchase validation, synergy tests | 1 | `data/cards/chips.ts`, `draft.ts`, `resolve.ts`, tests | Phaser scenes |
| **3** | `CardAlbumScene` + modal + journey names + cards journey | 2 | new scene, BootScene, `semantic-targets.md`, `journey.mjs` | lattice/radial tree scenes |
| **4** | Hub/Tutorial/first-clear polish | 3 | Hub/Tutorial/result cards paths | new chip kinds |
| **5** Central | Balance smoke, retune, full verify, PR | 4 | balance tests, chip numbers | scope creep |

**Chunk 0 + 5 = central agent.** Delegate 1–4 sequentially; verify + commit
per chunk.

---

## 11. Gates

```bash
cd game && npm run verify:fast   # after every chunk
cd game && npm run verify        # before PR
```

Chunk 2 tests must prove: unlock table; `chipOffersForSlot` returns exact trios;
`applyChipPurchase` rejects wrong-slot chips; Arming Mend + Battle Mend resolve
into engine-visible synergies/manaSynergies; Graven/Steady chips land in
missing/full HP lists.

---

## 12. Non-goals (reject)

- Deleting lattice or radial
- Shipping a parallel relic catalog / relic art (#19) — fantasy only via chips
- RNG chip pools (deferred)
- Big Heal, specialize forms, oaths
- Chip slots on major CDs
- Respec, dual-spec
- New combat engine mechanics (Martyr’s Mirror, Silent Choir, Ash Confession,
  etc. stay brainstorm-only until a later phase)
- Party-stat chips (Guardian HP, DPS swing)
- Soft save migration across modes

---

## 13. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Three modes maintenance | PoC bar; don’t feature-match radial specializes |
| Slot-2 too weak/strong | Authored sets — easy to retune in Chunk 5 |
| castBuff overwrite on Bonk | Document last-wins; journey can pick Blessed then Crush |
| Hub confusion | One Spells button |
| Feel drift from relic doc | Slot-2 must cite a cousin; reject pure +flat with no trade |

---

## 14. PR expectations

- One PR from `poc/spell-card-upgrades`.
- Title: `PoC: spell-card upgrade mode (dual-ship)`
- Body: try-steps (Settings → Spell cards → wipe) + Done-means checklist.
- Note chip sets are fixed (no RNG) and point at relic-revamp for future wild
  engine chips.
