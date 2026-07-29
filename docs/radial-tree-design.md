# Radial talent tree — design spike

Status: historical · Authority: none — Wave 5 design exploration (shipped dual-ship
is documented in poc-qa / CHANGELOG) · Last verified: 2026-07-29

Companion to Wave 5 in
[`playtest-2026-07-26-roadmap.md`](playtest-2026-07-26-roadmap.md) and the
[playtest-planning canvas](/Users/aaronvotre/.cursor/projects/Users-aaronvotre-Git-healgame/canvases/playtest-planning.canvas.tsx).
Ability-spoke radial concept with pinned decisions from the Jul 29 Q&A.
Historical design spike; shipped dual-ship behavior is in poc-qa / CHANGELOG.

---

## 1. Problem

healgame is snack-sized. Friends will not brood over a dense lattice of
interconnected nodes, exclusives, forsaken-path consolations, and multi-hop
prereqs. Playtest feedback already said the tree is glyph-heavy and too full
of filler — you'd have to read everything to understand it.

The live v0.3 lattice (`game/src/data/talentTree.ts`,
`game/src/tree/AGENTS.md`) preserves real build depth and oath × Vowstrike
synergies, but the **graph itself** is the teaching cost. Polish on the old
topology will not fix that (roadmap warning: do not icon-pass the lattice
then rebuild).

**Design tension to hold:**

| Audience | Need |
|---|---|
| Default / friends | Instantly readable: “these are my spells; this one upgrades that one” |
| Enthusiasts | Real forks, named identities, cross-ability synergies worth theorycrafting |

---

## 2. Goals

1. **Glanceable kit.** First open of the tree should look like a class wheel
   of abilities, not a tech tree.
2. **Depth without branch spaghetti.** Specialization is a straight spoke
   outward; the hard choice is an **A-or-B modal** on a single node, not a
   fork in the graph.
3. **Synergy over completionism.** Rings have enough nodes that the player
   cannot buy everything in a band — builds come from specialization +
   cross-ability synergy, not collecting the whole wheel.
4. **Ship both systems next release.** Lattice and radial both work; Settings
   toggles mode (wipe + restart). A/B test with friends.
5. **Keep `CombatMods` as the combat seam.** The engine already never sees
   the graph — only resolved spells/CDs/synergies. That boundary is the
   plug point.

Non-goals for this spike: relic redesign, respec / dual-spec, Defense axis
(reserved, no work yet), subclass/oath fantasy, icon art pass on the live
lattice, migrating active saves.

---

## 3. Pinned decisions (Jul 29 Q&A)

| # | Topic | Decision |
|---|---|---|
| 1 | Starter kit | **Bonk + Heal** unlocked at start. **Mend** appears as a Ring-1 unlock on the first talent point — teaches the system. Ring 1 also needs **spend sinks / upgrades** so early levels stay meaningful. |
| 2 | Bigger heal | **Separate spoke**, not Solemn-Heal. Also brainstorm more paladin tools (instant cast, party buff — DR and/or temp damage amp). |
| 3 | Naming | **Base names stay plain** (Heal, Mend, Bonk, Big Heal, …) so non-gamers get it. **Flavor words only on specialized forms** (Zealous Heal, Solemn Heal, …). |
| 4 | Bonk vs Vowstrike | Player aims for **1 offensive + 3 spells**. Start with Bonk (no CD, minimal effect). At **Ring 2 (Lv5)** choose **Vowstrike** *or* an **upgraded Bonk**. Bonk A/B: **Mana return** vs **stacking next-heal amp** (+10% heal per Bonk stack). Vowstrike keeps its CD / on-CD identity. |
| 5 | Mend | Gets an **A/B** whose options **synergize with other abilities**, not pure power bumps. |
| 6 | Rings | Bands: **Ring 1 = Lv 1–4**, **Ring 2 = Lv 5–9**, **Ring 3 = Lv 10+**. Each band needs **at least ~band-width nodes** to spend into, not four brand-new abilities every ring. Ring 2 kit core: **Vowstrike path + 2 CDs**; Ring-1 spell specializations carry most of the identity. |
| 7 | Upgrades | Every existing spoke should get **truly dope** upgrades (not filler %). New spells allowed where they earn a spoke. |
| 8 | Prepurchases | Heal + Bonk **prepurchased**; player earns **1 talent point per level** to spend. |
| 9 | Cost | **1 talent point per node** for now; retune if it plays weird. |
| 10 | A/B cadence | **A/B at each stage after the starting unlock** of that spoke (not one lifelong fork). |
| 11 | Synergy pillars | Keep / design for: **damage ↔ heal**, **arming**, **fast vs slow** (cast-a-lot vs prepared), **CDs that enable some paths** (e.g. −1 mana/cast loves the fast caster). |
| 12 | Subclass | **None for now.** No Vigil/Zealot oath as a global identity. |
| 13 | Lock | **Hard lock** after an A/B pick. |
| 14 | Toggle | **Settings** control; switching **wipes save and restarts** in the other mode. |
| 15 | Dual ship | Both modes must work in the **next release** for playtest A/B — no rush to delete lattice. |
| 16 | Saves | **Wipe / rotate key**; easiest path. No migration of active saves. |
| 17 | Center | **Placeholder** art/identity for now. |
| 18 | Build stamp | **Static placeholder** on result/hub until radial silhouette is ready. |
| 19 | Bar / spellbook | Specialize → **auto-replace** the bar slot and **remove access** to the earlier version. |
| 20 | Defense axis | **Reserved** — do not act on it yet. |

---

## 4. Concept — ability-spoke radial

### 4.1 Layout metaphor

```
                         Ring 3 (Lv 10+)
                    further A/B + dope upgrades
                               │
              ┌────────────────●────────────────┐
              │         Ring 2 (Lv 5–9)         │
         [Still Waters]  [Offense fork]  [Wrath]
              │         Vowstrike | Bonk↑       │
              │              │                  │
              │         Ring 1 (Lv 1–4)         │
     [Mend] [Heal★] [Bonk★] [Big Heal?] [Instant?] [Buff?]
              │         ★ = prepurchased        │
              └────────────────●────────────────┘
                            CENTER
                         Healer (placeholder)
```

- **Center:** class identity placeholder (not a purchase).
- **Ring 1 (Lv 1–4):** prepurchased **Heal** + **Bonk**; unlockable **Mend**
  (first teaching purchase); additional spokes / upgrades as spend sinks
  (Big Heal, maybe Instant, maybe Buff — see §5).
- **Ring 2 (Lv 5–9):** offensive fork (**Vowstrike** vs **upgraded Bonk**),
  plus **two major CDs** (Still Waters, Wrath — Liturgy placement TBD as a
  CD or as a fast-path upgrade). Dim until level gate.
- **Ring 3 (Lv 10+):** next A/B stage + high-impact upgrades on owned spokes.
  Not a dump of four new abilities.

### 4.2 Choice UX

1. Player clicks a specialize / upgrade socket on a spoke.
2. Modal: side-by-side A vs B — plain comparison to current spell (name,
   one-line fantasy, heal/mana/cast or proc text).
3. Confirm → socket fills with chosen identity; rival gone (hard lock).
4. Loadout **auto-replaces** the bar entry; previous spell id is removed from
   the library.

No second visible rival node on the wheel.

### 4.3 Spend pressure (completionism guard)

Each ring band should offer **more attractive nodes than the player has
points for in that band** (Ring 1 ≈ 4 levels → ≥4 spend targets once Mend
and early upgrades exist; Ring 2 ≈ 5 levels → offense fork + 2 CDs + stage
A/Bs, etc.). The player specializes; they do not fill the circle.

---

## 5. Spell kit

Working names only — numbers live in `game/src/data/` when implemented.
**Base name = what it does. Flavor prefix/suffix = specialized form only.**

### 5.1 Starter and Ring 1

| Spell | Start state | Role |
|---|---|---|
| **Heal** | Prepurchased | Standard single-target heal. Clear name. |
| **Bonk** | Prepurchased | No-CD free(ish) poke; intentionally weak until Ring 2 upgrade path. |
| **Mend** | Unlock on Ring 1 (first point teaches the wheel) | Smaller / cheaper heal tool. A/B picks **synergy partners**, not raw +heal. |
| **Big Heal** | Separate spoke (unlock) | Slow / expensive / large — not folded into Solemn Heal. |
| **Instant?** (brainstorm) | Candidate spoke | Instant or near-instant emergency heal; mana-pricey. Paladin “Flash” energy. |
| **Buff?** (brainstorm) | Candidate spoke | Short window: reduce incoming damage and/or amp party/healer output. |

Ring 1 also needs **non-new-spell upgrades** on Heal/Bonk (and unlocked Mend)
so levels 2–4 are not empty after Mend — e.g. first-stage A/B on Heal, small
dope mods, mana pocket — without reintroducing lattice filler.

### 5.2 Ring 2 — offense fork + CDs

**Offense (pick a lane — hard lock):**

| Path | Identity |
|---|---|
| **Vowstrike** | Personal CD; press on cooldown. Later A/B = current Virtue/Vengeance fantasy (mana discount next spell vs empower next heal), renamed clearly. |
| **Upgraded Bonk** | Still no (or low) CD; A/B: **Mana return** on Bonk vs **stacking heal amp** (each Bonk arms +10% on the next heal, stacks). Competes with Vowstrike for the single offensive bar slot. |

**CDs (two spokes in the band):**

| CD | Live anchor | Synergy note |
|---|---|---|
| **Still Waters** | Free next heal | Strong with Big Heal / prepared path |
| **Wrath** | Heal-bonus window | General amp; pairs with arming setups |
| **Frenzied Liturgy** (place TBD) | −1 mana during window | Explicitly loves **fast cast** specializations — may be Ring 2 third option, Ring 3, or the “fast” side of a CD A/B |

### 5.3 Naming pattern

| Stage | Example display name |
|---|---|
| Base | Heal, Mend, Bonk, Big Heal, Vowstrike |
| Specialized | Zealous Heal, Solemn Heal, … (flavor on the form only) |

Avoid shipping base ids named Solemn Mend / Zealous Flare in the radial
catalog — those become specialized (or Big Heal) forms.

### 5.4 Synergy pillars (design targets)

Cross-ability power is **resolve-time / combat rules**, not extra wheel edges:

| Pillar | Intent |
|---|---|
| Damage ↔ heal | Offensive picks feed healing (Bonk stacks, Vowstrike empower) or healing enables damage |
| Arming | Cast A arms bonus on B (Mend A/B should lean here) |
| Fast vs slow | Benefits for high cast count vs committed long casts |
| CD enablement | Each CD clearly better with some specializations than others |

Mend’s A/B is the primary place to **point** a player at a partner spoke
(“Mend arms Big Heal” vs “Mend refunds after Bonk/Vowstrike”, etc. — exact
pairs still to pin).

### 5.5 Live lattice → radial re-home

| Live piece | Radial home |
|---|---|
| Starter Bonk + tutorial heal | Prepurchased Heal + Bonk (new plain ids) |
| Solemn Mend / Zealous Mending | Mend base + stage A/Bs / Heal specializations |
| Solemn Vigil / Zealous Flare | Heal stage A/Bs and/or Big Heal + Instant — **not** global oaths |
| Patient Vow / Measured / Fervent / Steady | Stage A/Bs and dope upgrades on Heal/Mend spokes |
| Still Waters / Wrath / Liturgy | Ring 2(+ ) CD spokes; Liturgy placement open |
| Vowstrike Virtue / Vengeance | Vowstrike lane stage A/Bs |
| Oath × Vowstrike twists | Replaced by aspect × aspect rules without subclass |
| Crowns | Ring 3 dope upgrades / final A/B stages |
| Deep Reserves | Early Ring-1 spend sink or center later — not required for placeholder center |
| Warped Tempo / forsaken path | **Cut** — hard locks, no consolation rival path |
| Subclass oaths | **Cut** for radial mode |

### 5.6 Dual spell catalogs

- Lattice path: keep `SPELLS` / `COOLDOWNS` / `TALENT_TREE` working.
- Radial path: new catalog (`data/radial/…`) with new ids (`heal`, `mend`,
  `bonk`, `big-heal`, `heal-zealous`, …).
- Engine stays id-agnostic; each mode has its own bots / journey seeds.

---

## 6. Parallel / pluggable architecture

### 6.1 Seam

```
Save  →  loadoutForSave(save)  →  CombatMods  →  CombatEngine / scenes
              │
              ├─ lattice: loadoutFromSave
              └─ radial:  loadoutFromRadialSave
```

### 6.2 Settings toggle (pinned)

- Control lives in **Settings**.
- Changing mode → **wipe save + restart** into that mode (no dual-state save).
- Easiest persistence: rotate save key **or** store a single
  `progressionMode` on a tiny meta key and wipe gameplay save on switch.
- Both modes required for the next release playtest — do not delete lattice.

### 6.3 Provider split

| Concern | Lattice | Radial |
|---|---|---|
| Config | `TALENT_TREE` | `RADIAL_TREE` |
| Persist | `treeRanks` (current) | radial ranks / choice map (new; wipe on mode switch) |
| Resolve | existing `loadoutFromSave` | `loadoutFromRadialSave` → same `CombatMods` |
| UI | `TreeScene` | radial draw mode or `RadialTreeScene` |
| Journey | existing `treeNode:*` seeds | radial spot ids + mode-specific journey |
| Spells | `SPELLS` | `RADIAL_SPELLS` |

### 6.4 Specialize effect (bar contract)

Radial resolve should support replace-in-place:

```ts
{ kind: 'specializeSpell', fromId: 'heal', toId: 'heal-zealous' }
```

- Remove `fromId` from unlocked library and bar.
- Grant `toId`; if `fromId` was equipped, bar slot becomes `toId`.

### 6.5 Build slices (when coding starts)

1. Save wipe + Settings mode toggle + `loadoutForSave` facade; radial starter
   kit = Heal + Bonk only.
2. Radial tree data + resolve (Ring 1 Mend unlock, stage A/B, specialize
   replace) — unit tests, no Phaser.
3. Radial tree UI + A/B modal + journey names.
4. Ring 2 offense fork + 2 CDs + synergy rules.
5. Ring 3 upgrades; balance bots for radial beside lattice; friend A/B test.

---

## 7. Player experience (target)

1. Tutorial / first fight with **Heal + Bonk** on the bar.
2. Level up → open tree → see prepurchased Heal + Bonk, dimmer Ring 2/3,
   and **Mend** affordable on Ring 1. Buying Mend teaches the wheel.
3. Levels 2–4: spend into Ring-1 upgrades / first A/Bs / optional new spokes
   (Big Heal, etc.). Cannot buy everything.
4. Level 5: Ring 2 lights. Choose **Vowstrike** or **upgraded Bonk** (Bonk
   A/B: mana return vs stacking heal amp). Optionally grab a CD.
5. Levels 5–9 / 10+: more stage A/Bs and dope upgrades; hard locks define
   identity; synergies show up in combat feel.

---

## 8. Relics & presentation (deferred)

- Relics stay post-resolve for now; spoke-tagged relics later.
- Center = placeholder; result/hub build mark = **static placeholder**.
- Defense axis reserved — no design work this spike.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Dual systems to maintain | Accept for one release of A/B testing; shared `CombatMods` seam |
| Ring 1 empty after Mend | Explicit early upgrades + optional new spokes as spend sinks |
| Bonk upgrade vs Vowstrike balance | One offensive slot fantasy; tune so both lanes are viable, not equal at everything |
| Too many new spokes (Instant/Buff/Big Heal) | Prefer upgrading existing spokes first; add spokes only when the fantasy is one clear sentence |
| Settings wipe surprise | Clear confirm copy on the toggle |
| Journey assumes lattice ids | Mode-specific journey / seeds |

---

## 10. Brainstorm backlog (not pinned)

Paladin-shaped spells to consider as spokes or upgrades:

| Idea | Plain name candidate | Notes |
|---|---|---|
| Large committed heal | **Big Heal** | Pinned as separate spoke |
| Emergency cast | **Flash** / **Instant Heal** | High mana, low/no cast |
| Mitigation buff | **Guard** / **Shield** | Short DR on target or party |
| Output buff | **Blessing** / **Wrath lite** | Temp heal or damage amp — careful overlap with Wrath CD |
| Hot / renew | Could be a **Mend** specialization rather than a new spoke | Synergy-friendly |

---

## 11. Remaining open questions

**v1 locks shipped** — see Wave 5 notes in [`poc-qa.md`](poc-qa.md) and
[`CHANGELOG.md`](CHANGELOG.md). Historical open list kept below for context.

Prior decisions are in §3. Still need answers before a node table can freeze:

### Kit shape

1. **Which Ring-1 spend sinks ship in v1 besides Mend?** First Heal A/B only?
   Big Heal unlock? A small “dope upgrade” list per prepurchased spoke?
2. **Exact Mend A/B pairs** — which partner abilities does each side arm or
   enable? (Need two sentences that a non-gamer understands.)
3. **Heal stage A/Bs** — if not subclass, what is the first Heal fork
   (fast/cheap vs slow/efficient)? What is the Ring-2/3 Heal fork?
4. **Big Heal** — Ring 1 unlock or Ring 2? Does it get the same stage-A/B
   cadence immediately?
5. **Instant and Buff** — in v1 radial, or brainstorm-only until Heal/Mend/
   Bonk/Vowstrike/CDs feel good?
6. **Frenzied Liturgy** — second CD A/B, third CD competing with the two,
   or a fast-path upgrade on Heal/Mend?

### Offense fork

7. **Is Vowstrike vs Upgraded Bonk mutually exclusive forever**, or can Ring 3
   ever splash the other lane at a steep cost? (Default from hard-lock +
   completionism: forever.)
8. **Vowstrike A/B names** under the plain-name rule — keep Absolution /
   Reckoning as flavor forms of Vowstrike, or rename?
9. **Bonk stacking heal amp** — stacks to a cap? Consumed by any heal or
   only Heal/Big Heal? Clear UI stacks?

### Economy & bands

10. **Minimum node list per band** for v1 (concrete ids) so Lv 1–4 / 5–9 /
    10+ each have enough sinks without four new spells per ring.
11. **Does unlocking Mend cost the first point only**, or is Mend free-looking
    but the point buys “Mend + first tutorial highlight”?

### Engineering

12. **Meta key vs full save rotate** for Settings mode wipe — which is less
    code for “wipe and restart”?
13. **Default mode for fresh installs** next release — lattice or radial?

---

## 12. Next refinement steps

1. Pin remaining questions **1–6** and **9–10** (v1 spoke list + Mend/Heal
   A/B copy).
2. Write a concrete **node table** (id, ring band, prepurchased?, A/B pair,
   effect sketch) in this doc — still no code.
3. Promote a thin handoff when ready to build: Settings wipe toggle + facade
   + radial starter kit as chunk 1.
