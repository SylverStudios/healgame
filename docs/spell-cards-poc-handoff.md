# Spell-card upgrades PoC — handoff

Status: planning · Authority: this file wins for the spell-cards PoC · Last
verified: 2026-07-30

Design background (non-authoritative once this handoff exists):
[`spell-card-upgrades-brainstorm.md`](spell-card-upgrades-brainstorm.md).

Remote agent entry prompt:
[`spell-cards-poc-agent-prompt.md`](spell-cards-poc-agent-prompt.md).

---

## 1. Mission

Ship a **third progression mode** (`cards`) dual-shipped beside lattice and
radial so friends can A/B: no relics, no talent-tree path — **spell/CD cards
with upgrade chips**, free level unlocks, spend points only on random chip
drafts.

**Done means (all must be true):**

1. Settings offers **Classic | Radial | Spell cards**. Switching modes confirms,
   wipes save, restarts Tutorial (same UX as today’s Classic↔Radial).
2. Fresh **Spell cards** save: Heal + Bonk on the bar; album shows both cards
   with empty slots; **1 unspent upgrade point** at level 1 (or equivalent CTA
   so the player knows to open Spells).
3. Leveling grants **+1 upgrade point per level** and free unlocks per §3
   table (Mend, Vowstrike, then one major CD per level 6–8).
4. Player can spend a point: pick a spell with a free slot → **3 random chips**
   from that spell’s pool → pick 1 → slot fills → next fight uses the baked
   numbers / synergies.
5. **RelicScene never opens** in cards mode (first-clear does not offer relics;
   bonus upgrade point instead — §3).
6. Hub in cards mode has a single **Spells** entry (album); tree wheel / lattice
   are not reachable. Lattice + radial journeys and Settings toggles still work.
7. `npm run verify` green on the PR branch (or `verify:fast` + cards journey
   smoke if full journey time-boxed — prefer full verify before PR).

---

## 2. Locked product decisions

| # | Decision |
|---|---|
| D1 | Mode id: `progressionMode: 'cards'`. Settings label: **Spell cards**. |
| D2 | Relics **fully replaced** in cards mode. `relicIds` stays `[]`; never set `pendingRelicOffers`. |
| D3 | Spend currency = **upgrade points only**. No tree ranks / no radial spots. |
| D4 | Spells + major CDs unlock **free on level** (§3). Unlock does not spend a point. |
| D5 | Tree + spellbook **merge** into one album scene. Hub: one button **Spells** (reuse `hubTree` name → album; hide or no-op `hubLoadout` in cards mode). |
| D6 | Chip offers: **random 3-from-pool**, pool size **≤6** per spell. Exclude already-owned chips on that card. If &lt;3 remain, show what’s left. |
| D7 | **2 upgrade slots** per spell card. Major CD cards: unlock + show on album; **no chip slots in PoC** (unlock-only). |
| D8 | Synergy chips emit existing `CombatMods` fields (`synergies`, `manaSynergies`) — **no new engine rules**. |
| D9 | Vowstrike at 5 **adds beside Bonk** (does not replace). |
| D10 | First-clear in cards mode: **+1 bonus upgrade point** (no relic draft). |
| D11 | Base spell defs: **reuse radial catalog** ids (`heal`, `mend`, `bonk`, `vowstrike`, …). Cooldowns: existing `still-waters`, `wrath-ascendant`, `frenzied-liturgy`. |
| D12 | Switching to/from cards **wipes save** (Settings confirm). Save schema bump via `npm run save:bump` when shape breaks golden fixture. |
| D13 | Default fresh install stays **`lattice`**. Cards is opt-in via Settings. |
| D14 | Draft RNG: injectable `random` (same pattern as relic offers) for tests. |
| D15 | Chip magnitudes: **flat integers** (repo law). Conversational “−50%” → concrete mana/heal/ms in data. |

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

## 4. Architecture seam (do not break)

```
Save  →  loadoutForSave(save)  →  CombatMods  →  CombatEngine / scenes
              │
              ├─ lattice → loadoutFromSave
              ├─ radial  → loadoutFromRadialSave
              └─ cards   → loadoutFromCardSave   ← NEW
```

- Combat / scenes must **not** branch on tree topology; only call
  `loadoutForSave` / `ownedSpellsForSave` (extend facade).
- Engine purity unchanged. Chips may only produce effect kinds resolve already
  understands (see §6).

---

## 5. Save shape (Chunk 0)

Extend `ProgressionMode` with `'cards'`.

Cards-mode fields (names may match exactly):

```ts
/** Unspent chip drafts. Lattice/radial ignore (treat as 0). */
upgradePoints: number;

/**
 * spellId → ordered chip ids filling slots (length 0..CARD_SLOTS).
 * Only spell ids (not cooldown ids) in PoC.
 */
spellChips: Record<string, string[]>;
```

Pinned defaults for `newSaveData('cards')`:

- `progressionMode: 'cards'`
- `unlockedSpells: ['heal', 'bonk']` (or derive purely from level — either is
  fine if resolve is the single source; prefer **derive from level + starters**
  and keep `unlockedSpells` in sync for bar/UI helpers)
- `actionBar: defaultRadialActionBar()` (Bonk Q, Heal W)
- `treeRanks: {}` (unused)
- `upgradePoints: 1` at level 1 (so Lv1 can upgrade immediately) **or**
  `0` and grant the first point on leaving tutorial — pick one in Chunk 0 and
  test it; **prefer `upgradePoints: 1` on new cards save**
- `spellChips: {}`
- `relicIds: []`, `pendingRelicOffers: []`
- `subclass: null`

`validateSaveData`: accept `'cards'`; require `upgradePoints` integer ≥0 and
`spellChips` as string→string[] map when mode is cards (lattice/radial may omit
or default empty for forward compat — simplest: **always** persist both fields
on all modes with defaults `0` / `{}` so one shape).

Follow [`.claude/skills/rotate-save-version/SKILL.md`](../.claude/skills/rotate-save-version/SKILL.md).

---

## 6. Public API contracts (Chunk 1–2 consumers)

### 6.1 Unlock table — `game/src/data/cards/unlocks.ts`

```ts
export const CARD_SLOTS = 2;

/** Spells/CDs granted when player level >= minLevel (starters use minLevel 1). */
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

### 6.2 Chip defs — `game/src/data/cards/chips.ts`

```ts
export type CardChipEffect =
  | { kind: 'castMod'; spellId: string; castMsDelta?: number; manaDelta?: number; healDelta?: number; damageDelta?: number; cooldownMsDelta?: number }
  | { kind: 'synergy'; triggerSpellId: string; buffedSpellId: string; bonusHeal: number }
  | { kind: 'manaSynergy'; triggerSpellId: string; targetSpellId: string; manaDelta: number }
  | { kind: 'setManaOnHit'; spellId: string; amount: number }
  | { kind: 'setCastBuff'; spellId: string; castBuff: SpellCastBuff };

export interface CardChipDef {
  id: string;
  name: string;
  /** Plain sentence for the draft modal. */
  description: string;
  /** Pool membership — chip only rolls for this spell. */
  spellId: string;
  effects: CardChipEffect[];
  /** Optional: chips sharing a tag cannot both sit on the same card. */
  exclusiveTag?: string;
}

export const CARD_CHIPS: readonly CardChipDef[];
export function chipById(id: string): CardChipDef | undefined;
export function chipPoolForSpell(spellId: string): CardChipDef[];
```

### 6.3 Draft — `game/src/data/cards/draft.ts`

```ts
/** Pick up to 3 chip ids from the spell pool, excluding owned + exclusive conflicts. */
export function rollChipOffers(
  spellId: string,
  ownedChipIds: readonly string[],
  random: () => number,
): string[];
```

### 6.4 Resolve — `game/src/data/cards/resolve.ts`

```ts
export function loadoutFromCardSave(save: {
  xp: number;
  actionBar: string[];
  spellChips: Record<string, string[]>;
  // plus anything else resolve needs from SaveData
}): CombatMods;

export function ownedSpellsFromCardSave(save: …): SpellDef[];

/** Apply level-up side effects: points, unlocks, bar fills. Mutates save. */
export function applyCardsLevelUps(save: SaveData, prevLevel: number, nextLevel: number): void;

/** Spend 1 point, append chip to spellChips[spellId]. Throws/returns false if illegal. */
export function applyChipPurchase(save: SaveData, spellId: string, chipId: string): boolean;
```

`loadoutFromCardSave` steps:

1. Clone radial spell defs for `spellIdsAtLevel(levelForXp(save.xp))`.
2. Clone cooldown defs for `cooldownIdsAtLevel(...)`.
3. Apply each chip in slot order via effects → mutate clones / collect
   synergies / manaSynergies.
4. Return `CombatMods` (`spells` from action bar order, `cooldowns`,
   `synergies`, `manaSynergies`, empty/default other fields matching radial
   starter shape).

### 6.5 Facade — `game/src/data/loadout.ts`

Branch `progressionMode === 'cards'` to the functions above.

### 6.6 Progression / relics

In `meta/progression.ts` (or equivalent):

- Cards mode: on level-up call `applyCardsLevelUps`.
- Cards mode: **skip** `chooseRelicOffers` / never set `pendingRelicOffers`.
- Cards first-clear: `upgradePoints += 1` (bonus) when you would have opened
  relics.

Unspent CTA: Hub lights **Spells** when `upgradePoints > 0` in cards mode.

---

## 7. PoC chip pools (ship these ids)

Keep ≤6 per spell. Magnitudes are starting points — Chunk 5 may retune.

### `heal` pool

| id | name | effects (sketch) |
|---|---|---|
| `heal-power` | Power Up | castMod heal +2 |
| `heal-cost` | Cost Cut | castMod mana −1 (resolve clamp mana ≥1) |
| `heal-quick` | Quick Cast | castMod castMs −500 |
| `heal-heavy` | Heavy Cast | heal +3, castMs +500 |
| `heal-thrifty` | Thrifty | mana −1, heal −1 (mana clamp ≥1) |
| `heal-armed-by-mend` | Mend Link | synergy mend→heal +2 (`exclusiveTag: 'heal-arm'`) |

### `mend` pool

| id | name | effects |
|---|---|---|
| `mend-power` | Power Up | heal +1 |
| `mend-cost` | Cost Cut | mana −1 (min 0) |
| `mend-quick` | Quick Cast | castMs −400 |
| `mend-arming` | Arming Mend | synergy mend→heal +2 (`exclusiveTag: 'mend-identity'`) |
| `mend-battle` | Battle Mend | manaSynergy bonk→mend −1, vowstrike→mend −1 (`exclusiveTag: 'mend-identity'`) |
| `mend-tempo` | Soft Tempo | castMs −200 |

### `bonk` pool

| id | name | effects |
|---|---|---|
| `bonk-hard` | Harder Bonk | damage +1 |
| `bonk-mana` | Mana Bonk | setManaOnHit 1 |
| `bonk-blessed` | Blessed Bonk | setCastBuff stackNextHealPotencyPct pct 10 cap 3 |
| `bonk-battle` | Battle Link | manaSynergy bonk→mend −1 (`exclusiveTag: 'bonk-mend'`) |
| `bonk-power2` | Heavy Stick | damage +2 |
| `bonk-chip` | Pocket Sand | damage +1 (second mild power; or retune) |

### `vowstrike` pool (thinner OK — still ≤6)

| id | name | effects |
|---|---|---|
| `vs-power` | Harder Strike | damage +1 |
| `vs-ready` | Ready | cooldownMs −2000 |
| `vs-absolution` | Absolution Lite | setCastBuff nextSpellManaReduction 1 |
| `vs-reckoning` | Reckoning Lite | setCastBuff nextHealPotencyPct 20 |
| `vs-battle` | Battle Link | manaSynergy vowstrike→mend −1 |
| `vs-power2` | Crush | damage +2 |

**Exclusive:** `mend-arming` vs `mend-battle` (same `exclusiveTag`). Do not allow
two copies of the same chip id on one card.

---

## 8. UI / journey contracts (Chunk 3)

### Scene

- New `CardAlbumScene` (name TBD but key in `scenes/keys.ts`, e.g.
  `SceneKeys.CardAlbum = 'CardAlbum'`).
- Hub cards mode: `hubTree` → `CardAlbum` (label **Spells**). Do not start
  `Tree` / `RadialTree`.
- `hubLoadout`: hidden in cards mode (bar editing can be a follow-up; PoC
  auto-equips unlocks).

### Semantic names (add to `docs/semantic-targets.md`)

| Name | Object |
|---|---|
| `settingsProgressionCards` | Spell cards mode button |
| `cardAlbumBack` | back |
| `cardSpell:<spellId>` | spell card hit target |
| `cardUpgrade:<spellId>` | upgrade / spend affordance on that card |
| `cardChipOffer:<chipId>` | draft modal offer |
| `cardChipConfirm` | confirm pick (if separate from clicking offer) |
| `cardChipCancel` | cancel draft |

Reuse `settingsProgressionConfirm` / `Cancel` for wipe dialog.

### Draft modal

Show chip name + description. For castMod chips, show **before → after** Cost /
Power / Speed when cheap; synergy chips show the one-line description.
Confirming calls `applyChipPurchase` + `saveGame()`.

### Journey smoke (cards)

Seed or Settings→Spell cards→confirm→Tutorial→Hub→`hubTree`→upgrade Heal once
→ back → Ash Gate enter. Lattice/radial journeys must stay green (don’t steal
their Settings clicks).

---

## 9. Chunk table

| Chunk | What | Depends | Owns (CREATE / MAY EDIT) | Do not touch |
|---|---|---|---|---|
| **0** Central | Mode shell: `ProgressionMode`, save fields, `newSaveData('cards')`, validate, Settings third button + wipe, `loadoutForSave` → starters-only stub, skip relics in cards, Hub routes to stub album **or** Loadout temporarily, save bump | — | `save/`, `data/loadout.ts`, `SettingsScene.ts`, `HubScene.ts` (routing), `meta/progression.ts` (relic skip + points stub), `scenes/keys.ts`, golden fixture / package version via bump | chip pools, album UI polish, engine |
| **1** | Unlock table + level-up grants + auto-equip; `upgradePoints` economy; unit tests | 0 | `data/cards/unlocks.ts`, `data/cards/resolve.ts` (unlock portion), `meta/progression.ts`, tests | draft UI, chip defs beyond stubs |
| **2** | Full chip defs, `rollChipOffers`, apply chips in resolve, Arming/Battle Mend tests, `applyChipPurchase` | 1 | `data/cards/chips.ts`, `draft.ts`, `resolve.ts`, `*.test.ts` | Phaser scenes |
| **3** | `CardAlbumScene` + draft modal + journey names + cards journey smoke | 2 | new scene, `BootScene` registration, `semantic-targets.md`, `scripts/journey.mjs` (cards path), Hub labels | lattice/radial tree scenes (except Hub branch) |
| **4** | Hub/first-clear polish: Spells CTA on points, no relic copy, Tutorial ok in cards | 3 | Hub/Tutorial/result copy paths for cards | new chip kinds |
| **5** Central | Balance smoke bots for cards kits; retune flats if Ash Gate trivial/impossible; full `verify`; PR | 4 | `combat/*Balance*.ts` or cards balance test, chip numbers, poc-qa note on PR | scope creep |

**Chunk 0 + Chunk 5 = central agent.** Delegate 1–4 sequentially; after each,
central runs gates, integrates, commits one checkpoint.

---

## 10. Gates

From `game/`:

```bash
npm run verify:fast   # after every chunk
npm run verify        # before PR (includes journey)
```

Chunk 2 must add pure unit tests for unlocks, draft exclusion, resolve with
Arming Mend + Battle Mend chips. Chunk 3 adds journey coverage for cards mode.

---

## 11. Non-goals (reject)

- Deleting lattice or radial
- Relic redesign / relic art (#19)
- Big Heal, specialize forms, oaths
- Chip slots / pools on major CDs
- Respec, dual-spec
- Idea A polish on lattice/radial tooltips (nice-to-have inside album only)
- Party-stat chips (Guardian HP, DPS swing, etc.)
- New combat engine mechanics
- Migrating active saves across modes without wipe

---

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Three modes maintenance | PoC quality bar; don’t feature-match radial specializes |
| Synergy RNG feels bad | Small pools + exclusiveTags; Mend identity is a clear fork |
| Power chips stack too hard | 2 slots only; Chunk 5 bot pass |
| Hub confusion | One Spells button; hide Spellbook in cards mode |
| Save bump noise | Chunk 0 owns bump; one rotation |

---

## 13. PR expectations

- One PR from this branch (or stacked commits per chunk on same branch).
- Title suggestion: `PoC: spell-card upgrade mode (dual-ship)`
- Body: summary + how to try (Settings → Spell cards → wipe) + test plan
  checklist from §1 done-means.
- Do not merge without human A/B intent — open PR for review / cloud verify.
