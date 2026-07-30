# Spell-card upgrades (Idea B) — design + PoC plan

Status: planning · Authority: none — brainstorm / design exploration (not a
phase handoff) · Last verified: 2026-07-30

Playtest-driven exploration: replace Slay-the-Spire relics and path-tracing
talent trees with **upgrade chips on spell cards**. Dual-ship for friend A/B
(same pattern as Wave 5 radial — [`radial-tree-design.md`](radial-tree-design.md)).

Pinned answers from Jul 30 Q&A are in §3. **Executable PoC handoff (wins):**
[`spell-cards-poc-handoff.md`](spell-cards-poc-handoff.md) · remote prompt:
[`spell-cards-poc-agent-prompt.md`](spell-cards-poc-agent-prompt.md) ·
chip feel bible: [`relic-revamp-brainstorm.md`](relic-revamp-brainstorm.md).

---

## 1. Problem

healgame currently teaches healer identity with WoW-shaped assumptions:

- Players already know what **cost / cast time / heal amount** mean.
- Mana management is an intrinsic skill, not something the UI teaches.
- Permanent power comes from **relics** (global bag of mods) + a dense
  talent graph that assumes you’ll read every node.

Playtest reality: friends do **not** share that literacy. The fantasy that
lands is: *here is my card; it got stronger in a way I can see*.

| Audience | Need |
|---|---|
| Casual / friends | Glanceable Cost / Power / Speed; upgrades live *on the spell* |
| Enthusiasts | Synergy chips (Battle Mend–style) that make builds feel wild |
| Us | Dual-ship so lattice/radial stay playable while we try this |

---

## 2. Idea B (the path we’re on)

1. Each owned spell is a **card** with empty upgrade slots.
2. Level-ups grant **upgrade points** (not tree nodes). Spells/CDs unlock
   **free at level milestones** — no spend to gain Vowstrike, etc.
3. Spend a point → pick a spell with a free slot → choose from that slot’s
   **fixed trio of 3 chips** → pick 1 → chip fills the slot forever.
   (6 chips authored per spell; RNG deferred.)
4. Relics are **gone** in this mode. First-clear does not open RelicScene.
5. Talent tree + spellbook **merge** into one album of spell cards (no path
   tracing). Hub “Tree” / “Spellbook” become the same surface (or one dies).

**Idea A** (Cost / Power / Speed strip) is still worth shipping on the card
UI inside this mode — it’s how chips teach themselves — but it is not a
separate product track anymore.

---

## 3. Pinned decisions (Jul 30)

| # | Topic | Decision |
|---|---|---|
| 1 | Relics | **Fully replaced** by card chips in this mode. No RelicScene. Fantasy from [`relic-revamp-brainstorm.md`](relic-revamp-brainstorm.md). |
| 2 | Spend | **Only card upgrades.** Shared point pool is upgrade points only. |
| 3 | Spell unlocks | **Free on level** (Vowstrike at 5; major CDs one per level 6–8). |
| 4 | Tree shape | Tree + spellbook **merge** into a spell-card album. No path tracing. |
| 5 | Synergies | **Encapsulate in chips**. Slot-1 trios feature them. |
| 6 | Offers | **Fixed authored sets** — 6 chips/spell = slot-1 trio + slot-2 trio. No RNG in PoC. |
| 7 | Dual-ship | Settings mode + wipe save (Wave 5 pattern). Keep lattice/radial. |

---

## 4. Can Battle Mend live on a chip? Yes.

This is the wild part — and it’s already engineered.

Today (radial):

- **Arming Mend** → `CombatMods.synergies`  
  (`mend` completes → next `heal` / `big-heal` gets +heal)
- **Battle Mend** → `CombatMods.manaSynergies`  
  (`bonk` / `vowstrike` completes → next `mend` costs −1 mana)  
  Engine + overhead cue already shipped (Wave 5 / 5b).

A chip is just authored data that resolve applies into those same fields:

```ts
// chip on Mend's pool
{ id: 'chip-battle-mend', effects: [
  { kind: 'manaSynergy', triggerSpellId: 'bonk', targetSpellId: 'mend', manaDelta: -1 },
  { kind: 'manaSynergy', triggerSpellId: 'vowstrike', targetSpellId: 'mend', manaDelta: -1 },
]}

// chip on Mend's pool
{ id: 'chip-arming-mend', effects: [
  { kind: 'synergy', triggerSpellId: 'mend', buffedSpellId: 'heal', bonusHeal: 2 },
]}
```

**No engine work** for PoC synergies if we stay inside existing effect kinds:
`castMod` (heal/mana/castMs/damage), `synergy`, `manaSynergy`, and spell-local
`castBuff` / `manaOnHit` already on `SpellDef`.

Offer copy should always show strip before→after when the chip is a stat, and
one plain sentence when it’s a synergy (“After Bonk, next Mend costs 1 less”).

**PoC constraint:** a spell can hold at most one chip of a given synergy
*family* (e.g. can’t stack two Battle Mends). Stat chips can stack with caps.

---

## 5. Target player loop

1. Start: **Heal + Bonk** on the bar. Open album → two cards, empty slots.
2. Win / level → **+1 upgrade point**. Album highlights cards with free slots.
3. Click Heal → modal: 3 chips from Heal’s pool of 6 → pick one → slot fills.
4. Hit level gate → **Mend** appears free (empty slots, own pool). Auto-add to
   library; bar gets it if there’s a free key slot (same as radial grant).
5. Later level → **Vowstrike** free. Offense identity without a tree fork.
6. Keep spending points into whichever cards you actually cast.

Teaching: the strip numbers move; synergy chips explain themselves in combat
when the gold arming border / Battle Mend cue fires.

---

## 6. PoC kit (intentionally small)

Reuse **radial plain-name spell defs** (`heal`, `mend`, `bonk`, `vowstrike`,
maybe `big-heal`) — do not invent a third catalog yet.

| Level | Free unlock | Notes |
|---|---|---|
| 1 (start) | Heal, Bonk | Starters |
| 2 | Mend | Second heal + synergy chip space |
| 3–4 | — | Upgrade point only |
| 5 | Vowstrike | Adds beside Bonk |
| 6 | Still Waters | Major CD (1 per level after 5) |
| 7 | Wrath Ascendant | Major CD |
| 8 | Frenzied Liturgy | Major CD |
| 9+ | — | Upgrade point only |

**Out of PoC:** specialize forms (Zealous/Solemn Heal), oaths, lattice nodes,
relic offers, Big Heal, CD chip pools (CDs unlock-only), party-stat chips, respec.

**Slots:** **2 per spell** for PoC (enough to feel sticky; fewer UI edge cases
than 3). **1 upgrade point per level** (same cadence players already know).

**Points vs unlocks:** leveling can both unlock a spell *and* grant a point in
the same level-up — that’s fine; the free spell doesn’t consume the point.

---

## 7. Chip sets — see handoff

**Authoritative tables** (fixed slot-1 / slot-2 trios, 24 chips):
[`spell-cards-poc-handoff.md`](spell-cards-poc-handoff.md) §8.

Feel / wild fantasy source:
[`relic-revamp-brainstorm.md`](relic-revamp-brainstorm.md).

PoC: **no RNG**. Each upgrade shows that slot’s authored three options.

---

## 8. Architecture for dual-ship PoC

```
Save  →  loadoutForSave(save)  →  CombatMods  →  engine / scenes
              │
              ├─ lattice
              ├─ radial
              └─ cards   ← new progressionMode
```

### Save sketch (wipe on mode switch)

```ts
progressionMode: 'lattice' | 'radial' | 'cards'
// cards mode:
spellChips: Record<spellId, chipId[]>  // length ≤ slots
upgradePoints: number                  // unspent
// unlocked spells derived from level + starters (not stored ranks)
// relics unused: relicIds stays [] ; never populate pendingRelicOffers
```

Offers are deterministic (fixed trios). Combat stays pure.

### Resolve

`loadoutFromCardSave(save)`:

1. Base spells = starters ∪ level-gated unlocks (clone from radial catalog).
2. For each chip on each spell, apply effects → mutate cloned `SpellDef` /
   push synergies / manaSynergies / cooldowns.
3. Return `CombatMods` (same shape combat already consumes).
4. Action bar: starters + auto-equip new unlocks into free QWER slots
   (mirror radial grant behavior).

### UI

| Surface | PoC behavior |
|---|---|
| Hub | Single entry: **Spells** (replaces Tree + Loadout for this mode, or Loadout becomes the album) |
| Album scene | Grid of owned cards; locked silhouette for not-yet-level spells; unspent points callout |
| Card | Name, Cost/Power/Speed strip, slot chips, Upgrade button if points > 0 and free slot |
| Draft modal | 3 offers, before→after strip or synergy sentence, confirm |
| RelicScene | Never entered |
| Settings | Third mode: **Spell cards** (copy TBD); confirm → wipe → Tutorial |

Journey: one short cards-mode smoke (level cheat / seeded save → upgrade Heal
once → enter Ash Gate). Lattice + radial journeys untouched.

---

## 9. PoC build slices (definition of done = tryable A/B)

Estimate: **smaller than full Wave 5**, larger than a polish PR — roughly
**4–6 focused chunks** if we ruthlessly cut kit.

| Chunk | Owns | Done when |
|---|---|---|
| **0 — Mode shell** | `progressionMode: 'cards'`, save wipe, Settings toggle, `loadoutForSave` branch returning radial starters only, skip relic offers | Can boot Tutorial→Ash Gate in cards mode with Heal+Bonk; lattice/radial green |
| **1 — Level unlocks + points** | Level→spell table, `upgradePoints` on level-up, no tree spend | Hit Lv2 in a bot/save → Mend owned; points accrue; bar updates |
| **2 — Chip data + resolve** | ~6 chips × Heal/Mend/Bonk (+ thin Vowstrike), `spellChips` on save, pure resolve + unit tests (incl. Arming + Battle Mend chips) | Scripted save with chips changes CombatMods; engine tests reuse existing synergy cases |
| **3 — Album + draft UI** | Card grid scene, slot glyphs, spend→fixed 3→pick, journey names | Human can upgrade without console; `verify:fast` + cards journey smoke |
| **4 — First-clear / hub cleanup** | No relics; hub copy; optional Big Heal or skip | Full friend loop: fight → level → upgrade → fight |
| **5 — Soft balance** | One bot pass so Ash Gate isn’t trivial/impossible with 2 stacked Power chips | `radialBalance`-style smoke for cards kits; tune chip magnitudes |

**Explicitly deferred past PoC:** Idea A polish on every mode, CD cards, full
Vowstrike/Big Heal pools, specialize replacements, telemetry dashboards,
pretty chip art (temp glyphs fine), deleting lattice/radial.

---

## 10. What it takes (honest cost)

| Layer | Work | Risk |
|---|---|---|
| Data | New `data/cards/` (unlock table, chip defs, resolve) — clone radial spells as base | Low — same patterns as `data/radial/resolve.ts` |
| Save | Mode enum + `spellChips` + points; rotate/wipe | Medium — familiar Wave 5 path; use rotate-save-version skill |
| Engine | **None** if chips only emit existing effect kinds | — |
| Meta | Level-up grants points; suppress `pendingRelicOffers` in cards mode | Low |
| Scenes | New album scene (or gut Loadout); draft modal; Settings third option; Hub wiring | **Largest chunk** — UI is the PoC |
| Tests | Resolve unit tests + one journey smoke + light balance smoke | Medium |
| Balance | Chip % / flats will be wrong first week | Accept; tune from bots + one friend session |

**Synergy encapsulation verdict:** viable for PoC. The “wild” part is
*design/authorship* (which chip sits on which spell, conflict rules, offer
copy), not new combat rules.

**Biggest product risk:** with no tree path and no relics, the album must feel
like *the* progression toy on first open — empty slots + point callout have to
read instantly, or friends will think nothing dropped.

**Biggest schedule risk:** polishing three modes. Mitigate by treating cards as
friend-facing experiment and not feature-matching radial specialize forms.

---

## 11. Open questions for PoC scoping (smaller than before)

Answer these when we cut the handoff; defaults in italics if you don’t care yet.

1. **Mode name in Settings?** *Spell cards* vs *Album* vs something flavorful.
2. **Hub entry:** replace both Tree and Spellbook with one button, or keep
   Spellbook as the album and hide Tree? *One button: Spells.*
3. **Vowstrike vs Bonk at 5:** does Vowstrike **add** beside Bonk, or
   **replace** Bonk for free (radial-like offense slot)? *PoC default: add
   beside Bonk; bar has 4 slots anyway.*
4. **First-clear reward** with no relics: just XP/points, or a **bonus upgrade
   draft** (extra point)? *Extra point is the obvious juice.*
5. **Slot count** stick at 2 for PoC, or 3? *2.*

---

## 12. Next step

1. You skim §6–§7 kit/pools — rewrite any chip that feels wrong.
2. Answer §11 if you have preferences (or say “defaults fine”).
3. Forge a real `*-handoff.md` with chunk ownership + DoD = §9 table, then
   implement Chunk 0 in a branch dual-shipped like radial.

No code until that handoff is cut (unless you want a spike branch sooner).
