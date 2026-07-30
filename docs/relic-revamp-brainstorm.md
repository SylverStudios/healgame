# Relic revamp — archetypes + interesting modifiers

Status: planning · Authority: none — brainstorm / feel reference (not a phase
handoff) · Last verified: 2026-07-30

Raw design thinking for replacing boring “number go up” relics with playstyle
modifiers that create archetypes and off-tree synergies.

**Cards-mode mapping (Jul 30):** the spell-card PoC **fully replaces relics**
with per-spell upgrade chips. Use this doc as the **feel / fantasy bible** for
those chips (especially slot-2 “wild” forks) — not as a parallel relic catalog
to ship. Authoritative chip tables + engine constraints:
[`spell-cards-poc-handoff.md`](spell-cards-poc-handoff.md) §4 and §8.
Engine-heavy ideas in §6b stay aspirational until a later phase.

Related live systems: [`game/src/data/relics.ts`](../game/src/data/relics.ts)
(lattice/radial only), [`game/src/data/talentTree.ts`](../game/src/data/talentTree.ts),
[`game/src/combat/types.ts`](../game/src/combat/types.ts),
[`poc-qa.md`](poc-qa.md). Sibling:
[`spell-card-upgrades-brainstorm.md`](spell-card-upgrades-brainstorm.md).

---

## 1. Problem

Current relics served their purpose: prove the attachment point (first-clear
offer of 3, permanent accumulate, hub/combat run-mod display). Mechanically
they are flat stats only — mana regen, +heal, max mana/HP, tank armor, DPS
swing/damage. They do not change how you play.

Goal: keep the attachment point, replace the catalog with relics that:

- Reinforce clear archetypes for players who will not solve every talent
- Create synergies you would not get from the talent tree alone
- Prefer “change the decision” over “number go up”

---

## 2. Three layers (how the pieces fit)

| Layer | Job | Today |
|---|---|---|
| **Archetype (Z / S / R)** | Readable fantasy + play feel for people who don’t want to solve the whole tree | Tree already has **Zealot** vs **Vigil (Solemn)**; **Righteous** is the missing third fantasy |
| **Talent tree** | Durable kit + “easy vs scary” dials inside an archetype | Synergies, castMods, missing-HP bonuses, Vowstrike forks, CDs — already rich |
| **Relics** | Run-defining *modifiers* that amplify an archetype or create weird off-tree synergies | Flat stats only (`bonusHealing`, mana, role HP/armor/DPS) |

**Rule of thumb:** Tree = *how you cast*. Relics = *what the fight asks of you when you cast that way*.

If a relic is just “+1 heal forever,” it belongs on the tree or level curve. If
it makes Solemn players *want* to let people get low, or Zealot players *want*
a 3-button chain, it’s a relic.

**Beginner call:** make **Solemn the onboarding archetype**. Zealot is high
APM / combo literacy. Righteous needs a damage-capable kit before it’s honest.
Solemn can win on “big heal, right target, right time” with forgiving safety
nodes *and* a scary low-HP mastery track.

---

## 3. Archetypes

### Z — Zealot (active / combo)

- **Fantasy:** sparks, chains, tempo.
- **Fun:** rotation changes; chaining; reacting.
- **Risk:** overwhelm for first-timers — offer as “spicy,” not default.
- **Attribute family:** flat cost down, flat output up, cast-count / frequency,
  timing windows (“within Xs of last cast”).
- **Tree lean (existing):** Zealot oath, Fervent Chain, Quick Breath, Frenzied
  Liturgy, Steady Hands (full-HP bonus), Zealot×Vowstrike twists.
- **Relic job:** reward *sequences and cadence*, not bigger single heals.

### S — Solemn / Vigil (deliberate / impact)

- **Fantasy:** vows, judgment, last-second salvation.
- **Fun:** big hits that feel earned; planning > twitching.
- **Beginner track:** safe nodes (cheaper/faster Mend, Still Waters, mana) so
  “almost wipe then clutch” still works.
- **Depth track:** missing-HP amp, self-heal-while-low, “scary style” relics
  that punish overheal / reward brinkmanship.
- **Attribute family:** free casts, while-casting bonuses, % output (crit-ish),
  % cost, % cast time (haste-ish).
- **Tree lean (existing):** Vigil oath, Patient Vow, Measured Devotion, Graven
  Scale, Thrift, Still Waters.
- **Relic job:** make *timing and threshold* matter; custom juice later (cast
  swell, impact flash, “saved” beat) — highlight for new players.
- **Note:** depth option for experienced Solemn players should focus on healing
  targets at low health, and healing yourself while at low health. Relics a
  “normal” run wouldn’t choose, but that reward the scary style.

### R — Righteous (pressure / damage)

- **Fantasy:** holy wrath ends the fight; healing is triage between swings.
- **Fun:** shortening the clock; weaving damage without soft-wiping.
- **Needs tree spine first:** Vowstrike already exists as the seed; Righteous
  wants talents that make strikes *part of the plan*, plus mitigation that
  frees GCDs (armor / redirect / shield-lite — not HoTs; keep the paladin
  feel).
- **Attribute family:** heal-on-hit, heal-lowest-on-hit, damage charges next
  heal, DR / redirect so you can attack more.
- **Relic job:** make “more hits, less babysitting” feel smart — and break pure
  Bonk spam with *conditions* (alternate, spend stacks, protect while striking).
- **Open:** least fleshed of the three; refining talents is part of good relic
  ideation for this path. Success = increasing team DPS to end fights faster
  rather than overwhelming healing.

---

## 4. Attribute families by style (Idea 3)

| Lever | Z | S | R |
|---|---|---|---|
| Cost | flat −mana | % −mana / free proc | heal-on-hit as “mana substitute” |
| Output | flat + / per-cast stacks | % / crit / missing-HP | dmg → next heal charge |
| Tempo | cast count, windows, GCD shave | cast-time %, while-casting | DR so you can spend GCD on hits |
| Targeting | chain / don’t repeat | lowest / brink | lowest-on-hit, tank optional |
| Failure mode | overwhelm / OOM from spam | mis-time / interrupt | underheal while tunneling damage |

Keep **1–2 “safety” relics** that are mild number bumps so first-clear offers
aren’t always brain-melting; put wild ones later in dungeon order or tag
`depth: true` for weighted offers.

---

## 5. Art / index convention (Idea 2)

Hold off on real art. Use a single placeholder plate: letter badge
**Z / S / R / X** (X = wild / synergy) + short `artDesc` in the relic def for
later PixelLab.

Suggested index fields when writing the catalog:

```
id · name · letter · archetypeTags[] · fantasy one-liner · mechanical summary · artDesc · synergyNotes
```

UI shows letter + name + description; `artDesc` can live in tooltip under
“Concept art” until real icons exist.

---

## 6. Relic brainstorm

### 6a. Fits mechanics well (near-term — builds on existing hooks)

These speak the language already in combat: cast complete, next-heal potency,
missing HP, synergies, Vowstrike, mana, GCD.

**Zealot-leaning**

1. **Spark Ledger** — After 3 casts within 5s, next cast is free. Rewards tempo
   without raw +heal.
2. **Chain Censer** — Whenever a synergy proc fires, refund 1 mana *or* shave
   GCD slightly. Makes Fervent Chain / Patient Vow feel “on.”
3. **Quicksteel Rosary** — Instant spells (Vowstrike / 0-cast) grant +1 to the
   *next* cast-time heal. Bridges Z→S tools.
4. **Ember Cadence** — Every Nth heal this fight +flat; resets if you go idle
   >X s. Punishes AFK, rewards active Z.

**Solemn-leaning**

5. **Graven Hourglass** — Heals on targets ≤30% HP gain +% (stacks with Graven
   Scale). The “scary style” badge relic.
6. **Still Covenant** — While casting ≥1.5s, target takes −1 damage (mini-DR
   during channel). Makes long casts feel protective, not just risky.
7. **Thrift Seal** — First heal after dropping below 20% mana is free.
   Beginner Solemn safety without +heal forever.
8. **Last Candle** — If a heal lands and target would have died to the next
   auto within ~1 swing, +big bonus (or small shield). Pure “clutch” juice —
   simplified: “heal that crosses from ≤15% to >40%.”

**Righteous-leaning**

9. **Vowblood Signet** — Player damage heals the lowest ally for 1 (or % of
   damage). Core R identity.
10. **Reckoning Weight** — Each Vowstrike stacks +1 next heal (cap 3); spending
    a heal consumes. Anti-bonk-spam: you *want* to dump into a real heal
    sometimes.
11. **Iron Benediction** — After you deal damage, party takes −1 from the next
    hit. Buys GCDs for more strikes.
12. **Absolution Edge** — Healing a full-HP target converts excess to a damage
    buff on your next Vowstrike (anti-overheal → pressure).

**Neutral “good first revamp” (replace Triage Bell energy)**

13. **Triage Bell v2** — +1 heal only on the *lowest* HP ally (targeting skill,
    not blanket).
14. **Ember Ledger v2** — Regen ticks only if you cast in the last 8s (active
    play tax).

### 6b. Outside the box (change how you have to play)

These should feel like picking a challenge modifier you *want*.

1. **Martyr’s Mirror** — 50% of overheal redirects as damage to your current
   target enemy. Solemn overheal becomes Righteous fuel; bad triage burns the
   boss.
2. **Ash Confession** — Your heals cost 0 mana but deal 1 damage to *you* per
   cast. Turns Solemn into self-HP management; pairs with self-low relics.
3. **Silent Choir** — You cannot heal the same target twice in a row; violated
   casts are half power. Forces triage literacy; Zealot chaining becomes
   target-dance.
4. **Fixed Benediction** — Your first spell each combat is locked as
   “signature”; it gains huge amp, others slightly nerfed. Build-defining,
   run-unique.
5. **Borrowed Time** — Once per combat, if a party member would die, they
   linger at 1 HP for 2s instead — but your cast speed halves until you heal
   them. Dramatic Solemn clutch as a relic, not a CD talent.
6. **Blood Tithe** — Merc autos deal +1, but every N merc hits also damage the
   healer for 1. Shorten fights; heal yourself; Righteous / scary Solemn hybrid.
7. **One Hand Open** — Disable one action-bar slot; remaining spells gain a
   strong thematic buff (Z: cost− / S: heal% / R: damage+). Forces kit identity.
8. **Judgment Clock** — Fight gains a soft enrage: after T seconds, heals
   weaken and damage strengthens. Pushes Righteous / aggressive Zealot; Solemn
   must plan the curve.
9. **Cinder Fast** — Casting while a boss ability is on the cast bar grants
   bonus; casting otherwise is normal. Teaches mechanic windows.
10. **Oathbreaker’s Coin** — You may equip a second oath’s signature spell at
    −efficacy, OR double your sworn oath’s synergy and lose the other branch’s
    spells. Explicit archetype fork at relic layer.

### 6c. Synergy-builder / archetype-specific keystones

Think **keystones**: weak alone, absurd in the right tree. A “normal” run
wouldn’t choose these; the matching archetype would.

**Zealot keystones**

- **Fervent Dynamo** — Synergy bonus heals also reduce that buffed spell’s cast
  time next use. Combo engine.
- **Liturgy Loop** — Frenzied Liturgy window: every 2nd cast refunds GCD (or
  50% GCD). Makes the CD a playstyle, not a button.
- **Steady Ignition** — Steady Hands (full-HP bonus) also grants a micro damage
  proc. Topping people becomes Z offense.

**Solemn keystones**

- **Graven Appetite** — Missing-HP bonuses apply to *you* when you’re low too;
  self-Solemn becomes a build.
- **Patient Eclipse** — Patient Vow synergy: if the buffed heal lands ≤25% HP,
  gain a free Vigil charge. Rewards deliberate setup.
- **Measured Risk** — Measured Devotion’s longer cast: if uninterrupted, heal
  crits (double) but interrupt/cancel costs double mana. High-skill Solemn.

**Righteous keystones**

- **Vengeance Dynamo** — Vowstrike: Vengeance stacks don’t expire until spent;
  Virtue instead clears stacks for a burst strike. Aspect matters.
- **Warblood Litany** — Party DPS +swing only while your last player action was
  a damage spell. Commit to weaving.
- **Bastion of Wrath** — Tank armor +1, but *your* heals on the tank are −1;
  you’re expected to DR + strike, not pad the tank.

**Cross-archetype bridges**

- **Twin Path Seal** — Zealot cost reductions also apply to Vigil’s big spell
  at half strength (or vice versa). Hybrid bait.
- **Crown of Three** — After using heal → damage → heal (or Z-chain of 3
  distinct spells), gain a short “aspect burst.” Rewards kit breadth.
- **Hollow Mercy** — +big heal amp below 20% target HP, −heal amp above 70%.
  Solemn depth + anti-overheal; Zealot hates it; good intentional pick.

---

## 7. Suggested catalog organization

When writing the real index, group as:

1. **Core 6–9** — one clear Z, one clear S, one clear R, plus 2 bridges, plus 2
   mild universal (replace today’s Triage / Ember / Still roles).
2. **Depth 6** — scary Solemn, anti-spam Zealot, anti-bonk Righteous.
3. **Wild 4–6** — Martyr’s Mirror, Silent Choir, Borrowed Time, etc.
   (engine-heavier; design now, implement later).

For each entry, force:

- **“What does a bad player do with this?”**
- **“What does the intended archetype do that a wrong archetype can’t?”**

If both answers are “press the same buttons harder,” cut it.

---

## 8. Open decisions

1. **Is Righteous a third oath, or a late Vowstrike/crown identity?** (Tree
   work vs relic-only.)
2. **Relic stacking:** still accumulate all first-clears, or eventually loadout
   2–3 active?
3. **Offer weighting:** pure random vs archetype-aware (if you swore Zealot,
   bias Z relics)?
4. **How scary is Solemn for new players** — clutch juice first, or Graven-style
   amp first?

---

## 9. Next step (when ready)

Turn §6 into a concrete **v1 relic index table** (12–15 entries with `id`,
letter, tags, `artDesc`, and “engine: existing hook vs new kind”) ready to
drop into data comments or a phase handoff — still no art, no implementation
until scoped.
