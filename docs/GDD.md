# Healgame — Game Design Document (v0.4)

Status: current · Authority: long-term design only (poc-spec wins on PoC) · Last verified: 2026-07-17

**PoC implementation details live in [`poc-spec.md`](./poc-spec.md)** — that file wins on PoC conflicts.  
**Working title:** healgame  
**Date:** 2026-07-08  
**Related:** [`poc-spec.md`](./poc-spec.md) · [`CHANGELOG.md`](./CHANGELOG.md) · [`research/master-healer-kale.md`](./research/master-healer-kale.md) · [`research/design-direction.md`](./research/design-direction.md)

---

## 1. Elevator pitch

You are the only healer that matters. Your mercenaries fight on a single battle line — no movement, no micromanagement — while you keep them alive through cast-time triage, mana discipline, and build-defining magic.

Between runs you spend hard-won currency on an archetype skill tree that actually forces choices. Rubies are rare. Paths lock out other paths. Failure still pays. Success opens darker dungeons.

**One-liner:** Old-school MMO healing, stripped to a beautiful minimal run, with theorycraft that finally matters — in a heavy-metal dark fantasy skin.

---

## 2. Inspiration

### Primary: *Master Healer Kale with useless party* (Evrac Studio, 2026)

What we steal because it works:

| Idea | Why it works |
|------|----------------|
| Healer-only control | Pure fantasy, zero diluted roles |
| Auto-battling party on a facing line | The run stays minimal and readable |
| Wipe still grants gold + XP | Failure feels productive |
| Scarce rubies as contested spend | Real meta choice |
| Easy respec | Experimentation without punishment |
| Dungeon modifiers as tool checks | Builds matter beyond raw stats |
| Short campaign + optional hard mode | Scope discipline |

What we leave behind:

| Gap | Our answer |
|-----|------------|
| Tree looks branched, plays linear | 3 exclusive archetypes; XP unlocks skills; tree = big perks |
| No reason to respec | Exclusive paths make respec meaningful |
| Party trees too complex for AI units | Mercs: ~3 abilities, simple forks |
| Weak combo feedback | Floating proc indicators around the healer |
| Inconsistent cast UX, no queue | Target → hotkey; ~0.5s end-of-cast queue |
| Thin first minutes (1 spell) | Stronger early kit (exact mix TBD) |
| Comedy “useless party” tone | Heavy-metal dark fantasy (see Tone) |

Full systems breakdown: [`research/master-healer-kale.md`](./research/master-healer-kale.md).

### Secondary inspirations

| Source | What we take |
|--------|----------------|
| Classic / modern WoW healing | Triage, GCD rhythm, mana, spell queue, proc windows, **major cooldowns** |
| WoW Holy Paladin | Slow efficient / fast costly / instant triad + Wings-style pop CDs |
| WoW Discipline Priest | Shields-first, still needs real heals, external “save” CDs |
| WoW Restoration Druid | HoT garden, extend/consume HoTs for payoffs, Tree-form style CD |
| Darkest Dungeon | Facing-line composition readability (not stress/formation systems) |
| *The Last Spell* | Tone/vibe: heavy metal, apocalyptic dread, badass survivors — not its tactics or art pipeline |
| Panel-van / denim-patch dragon fantasy | Attitude reference: loud, mythic, slightly trashy-cool dark fantasy energy — **vibe, not literal art style** |

---

## 3. Design pillars

1. **The run is sacred and small.** No movement. Party auto-attacks. You heal. If a system complicates the run without deepening healer skill expression, cut it.
2. **Theorycraft lives in the meta.** Archetypes and lockouts create builds you can argue about. Rubies make you choose.
3. **Readable magic.** Procs and combo windows float around the healer. You should *see* when a free cast or synergy is live.
4. **Casting feels like healing.** Target first, then spell. Shared GCD rhythm, spell queue, and **major “oh shit” cooldowns** that change how you play for a window.
5. **Failure pays; mastery shines.** Every attempt advances currency. Good play still feels better than bad play.
6. **Tone is metal, not meme.** Scary, loud, old-school dragon-fantasy swagger — earnest grit with swagger, not sitcom uselessness.

---

## 4. Tone & presentation

### Locked: heavy-metal dark fantasy

**Reference vibe:** *The Last Spell* energy — progressive-metal intensity, last-stand dread, hardened fighters against something that should have already won — crossed with **old-school dragon / panel-van fantasy attitude** (mythic beasts, chrome-and-leather swagger, denim-patch cool).  

**Important:** This is a **mood and brand direction**, not a mandate to paint airbrushed dragons on every screen. Art direction will translate the vibe into whatever pipeline we choose later (pixel, illustrated 2D, etc.).

| Do | Don't |
|----|-------|
| Grim, loud, mythic | Kale-style comedy incompetence as the joke |
| Mercenaries who feel dangerous and flawed | Party as pure punchline |
| Dungeons that feel like bad places | Cute pastel adventure |
| UI with weight and menace | Soft cozy idle UI |
| Music/SFX that hit like a chorus | Quirky meme stingers as default |

**Working fiction sketch (replaceable):** A broken age after something divine went wrong. You are a battlefield binder — the last reliable healer a warband will hire. Your mercs are killers, not clowns. The dungeons are wounds in the world. Rubies are crystallized something-that-should-not-be — scarce, contested, slightly cursed.

---

## 5. Core loops

### 5.1 Single run (combat)

```
Select dungeon
  → Enter stage (party left, enemies right, single horizontal line)
  → Select a target (ally) — pointer/icon marks them
  → Hotkey (or click) a spell at that target
  → Cast time → resolve → optional ~0.5s queue into next spell
  → Party & enemies fire abilities on their own cooldowns (no movement)
  → Manage mana, spikes, procs (floating indicators on healer)
  → Clear stage → next stage / boss
  → Wipe OR dungeon clear
```

**Player skill expression:** who to target, when to spend mana, when to hold for a spike, reading proc windows, matching tools to dungeon modifiers.

**Not player skill:** positioning, issuing party attack commands, kiting.

### 5.2 Overall game (meta)

```
Attempt dungeon
  → Always earn XP + gold per enemy killed (even on failure)
  → First clear of a dungeon → 1 ruby
  → Hub:
       • Spell / perk tree (gold)
       • (Later) permanent hub buffs
       • Ruby subclass splits / keystones
  → XP auto-unlocks some skills on level-up
  → Unlock new dungeons on success
  → (Later) Respec / more archetypes / achievement unlocks
```

**Roguelite / incremental layer:** power bought in the hub **persists between attempts and dungeons**. Wipes are progress. Replay cleared dungeons for gold + XP.

**PoC subset:** see [`poc-spec.md`](./poc-spec.md) — Oathbound only; no hub buffs; no respec (restart only); ruby = subclass split.

---

## 6. Combat presentation

### Layout

- 2D side view, **Darkest Dungeon–style facing line**
- Player party on one side, enemies on the other
- **No movement** during combat
- Attacks and spells resolve in place on cooldowns / cast times

### Party (MVP)

Fixed warband of **4**:

| Slot | Role | Control |
|------|------|---------|
| Healer (you) | All support casting | Full |
| Tank merc | Soak / threat identity via path | AI only |
| DPS merc A | ~3 abilities, path fork | AI only |
| DPS merc B | ~3 abilities, path fork | AI only |

Mercenaries are **competent but autonomous** — dangerous people with bad habits, not sleeping joke tanks. Personality can be darkly funny; competence is the baseline.

### Targeting & casting (locked — D5)

**Primary model: target → spell.**

1. Click an ally (or use a party-slot hotkey) to **select target**.
2. A clear **target icon / pointer** marks the selected character.
3. Press a spell hotkey **or** click a spell on the bar to cast at the current target.
4. Spells that are truly self/AoE (no ally pick) are explicit exceptions and still respect “have a valid context.”

**Also supported:** clicking a spell button manually — but a target must already be selected (same rule).

**Spell queue:** ~**0.5 second** window at the end of a cast where input queues the next spell to start immediately (WoW-like). Exact timing tunable.

**Proc feedback:** when a combo/proc window is active (e.g. “next B is free after A”), indicators **float around the healer**, not as a detached WoW-style buff strip as the primary read.

**Cast timing model (D9 / PoC):**

- Spells share a **global cooldown (GCD)**. PoC: **1s GCD**; everything on GCD for simplicity.
- **Spell queue** allows back-to-back casts.
- Longer-term: major cooldowns per archetype (Wings / Tree / Pain Suppression energy). **Not in PoC.**
- Boss telegraphs use long named cast bars (PoC: **~10s**) so the player can prepare.

**Still open long-term:** off-GCD major CDs; max simultaneous floating proc indicators.

---

## 7. Progression systems

### 7.1 Currencies

| Currency | Earn | Spend | Role |
|----------|------|-------|------|
| **XP / levels** | Per enemy (incl. wipes) | Auto-unlock skills on level-up | Breadth of kit |
| **Gold** | Fixed amount per enemy | Talent tree nodes; (later) hub buffs, merc paths | Steady growth |
| **Rubies** | **1 per dungeon first completion** | Subclass splits / keystones; contested unlocks | Scarce choice |

Rubies remain the **primary limiting resource**. Replay cleared dungeons for gold + XP only.

### 7.1b Permanent hub buffs (later — D11)

Roguelite-style **permanent upgrades** (HP, mana, +heal, etc.) that persist across runs.

**Deferred past PoC.** Still desired for full game; not in the first vertical slice. See [`poc-spec.md`](./poc-spec.md).

### 7.2 Healer archetypes (locked — D1)

**MVP: 3 mutually exclusive archetypes**, inspired by classic WoW healer fantasies (names TBD — metal/dark fantasy rename later).

- Player picks **one** archetype for a build.
- Within an archetype, the tree supports **hybridization between that archetype’s branches**.
- You **cannot** take everything; branches and keystones create lockouts.
- **Respec** is a long-term goal for theorycraft; **PoC has no respec** (restart only).
- Every archetype has a **core spell rhythm**, **combo/proc identity**, and at least one **major cooldown** long-term. **PoC (Oathbound):** no procs, no major CD — see [`poc-spec.md`](./poc-spec.md).

**PoC builds Oathbound only.** Aegis / Wildbloom remain design targets for after PoC.

| Archetype | WoW analog | Core fantasy | Feel in a run |
|-----------|------------|--------------|---------------|
| **Oathbound** | Holy Paladin | Slow efficient / fast costly / instant triad + Wings | “I weave the triad and pop glory for the spike” |
| **Aegis** | Discipline Priest | Shields first, real heals second, external saves | “I pre-shield the hit, then patch what leaks” |
| **Wildbloom** | Resto Druid | HoT garden; extend or consume HoTs for payoffs | “I seed the line, then spend the garden” |

Spell names below are **working placeholders**. Numbers are illustrative, not balance.

---

#### Oathbound — Holy Paladin triad

**Fantasy:** Mana-efficient healing as a craft. Three primary heals that combo into each other; mastery is knowing which button the moment asks for.

**Core triad**

| Spell (placeholder) | Role | Notes |
|---------------------|------|-------|
| **Solemn Mend** | Slow, mana-efficient direct heal | Long cast, cheap, big value per mana |
| **Zealous Mending** | Fast, costly direct heal | Short cast, expensive, emergency throughput |
| **Vowstrike** | Instant heal | Smaller or conditional; often enabled/empowered by triad procs |

**Combo identity (Paladin-style):** Casting one heal feeds windows on the others — e.g. efficient heal grants a chance at free/cheap instant; fast heal refunds or empowers the next slow; instants extend buffs that make the next cast hit harder. Floating indicators around the healer show which triad window is live.

**Major cooldowns**

| CD (placeholder) | Job | Analog |
|------------------|-----|--------|
| **Wrath Ascendant** | Throughput / haste / empowered heals for a short window | Avenging Wrath / Wings |
| **Bastion Oath** (optional 2nd) | Big external save or party mitigation | LoH / Aura Mastery energy |

**Play pattern:** Spend most of the fight in the triad on GCD. See a spike → pop Wrath Ascendant → dump fast + instant while windows are hot → return to efficient Solemn Mend to recover mana.

**Tree hybrid hooks (within archetype):** lean efficient (mana / slow-heal mastery) vs lean emergency (fast/instant / Wings uptime) vs lean support (utility/blessings). Still all Oathbound.

---

#### Aegis — Discipline Priest shields

**Fantasy:** Prevention over cure. Absorb damage before it lands; keep a smaller heal kit for when shields break. Feels proactive and “ramp into the spike.”

**Core tools**

| Spell (placeholder) | Role | Notes |
|---------------------|------|-------|
| **Bulwark Word** | Primary shield | Main GCD spender; applies absorb + light heal-adjacent effect |
| **Radiant Veil** | AoE / multi shield | Pre-load the party before a wave |
| **Penitent Mend** | Real direct heal | Required — still need heals when absorbs fail |

**Combo identity:** Shielding builds stacks or “aegis charge” that empower the next Penitent Mend, or overshield converts to a short HoT/mitigation. Breaking a shield may grant a floating “breach” proc for an instant patch heal. Indicators show shield-ramp and save-CD availability.

**PoC scope:** **No damage→heal / atonement loop.** Cool idea; defer past PoC. Aegis is shields + real heals + save CDs only.

**Major cooldowns**

| CD (placeholder) | Job | Analog |
|------------------|-----|--------|
| **Painbind** | Huge single-target damage reduction | Pain Suppression |
| **Barrier Rite** | Party-wide mitigation window | Power Word: Barrier |
| **Rapture Seal** *(optional)* | Temporary: shields stronger / spamable | Rapture-style ramp |

**Play pattern:** Pre-shield before known damage → patch leaks with Penitent Mend → hold Painbind for the tank spike → Barrier Rite for dungeon-wide hits. Unlike Oathbound, the “correct” play is often *before* the damage, not after.

**Tree hybrid hooks:** pure absorb thickness vs heal-when-broken vs cooldown reduction / external saves.

**Note vs Kale:** Kale had shields as unlockable tools on a generalist healer. Here shields *are* the class — if you want triad weaving, pick Oathbound instead.

---

#### Wildbloom — Restoration Druid HoTs

**Fantasy:** Garden management. Keep HoTs rolling; the interesting decisions are **extending** vs **expending** those HoTs for different boosts.

**Core tools**

| Spell (placeholder) | Role | Notes |
|---------------------|------|-------|
| **Lifeseed** | Primary single-target HoT | Bread and butter |
| **Canopy** | Multi-target / party HoT | Seed the line |
| **Bloomburst** | Direct heal | Spot heal; often stronger if target is seeded |
| **Germinate** | Extend HoTs | Pushes durations; sets up big windows |
| **Wild Expenditure** | Consume / clip HoTs | Spend remaining HoT value for an instant burst, shield, mana, or empowered Bloomburst |

**Combo identity:** Maintain the garden → choose **extend** (survive long pressure) or **expend** (convert HoTs into a spike answer). Floating indicators show “garden ready,” “extend window,” and “expend available.” Direct heals should feel worse on bare targets and better on seeded ones so the HoT fantasy stays mandatory.

**Major cooldowns**

| CD (placeholder) | Job | Analog |
|------------------|-----|--------|
| **Ashwood Form** | Transform window: HoTs stronger / cheaper / auto-spread | Tree of Life |
| **Swiftmend Rite** *(optional)* | Instant consume-for-big-heal on a seeded target | Swiftmend energy |

**Play pattern:** Seed tank + party → during steady damage, Germinate to keep coverage → when a spike hits, either Ashwood Form and blanket, or Wild Expenditure to cash HoTs into emergency throughput → re-seed.

**Tree hybrid hooks:** pure sustain (extend / duration) vs expend-crit (consume payoffs) vs canopy (AoE HoT mastery).

---

#### Shared combat cadence (all archetypes)

| Layer | Purpose |
|-------|---------|
| **GCD** | Shared rhythm — every meaningful cast occupies the global window |
| **Spell queue (~0.5s)** | Queue next GCD at end of cast/GCD |
| **Per-spell CDs** | Some tools (instants, AoEs) also have personal CDs |
| **Major CDs** | Rare, loud, identity-defining; change decision-making for 8–20s |
| **Floating procs** | Show triad windows / shield ramp / garden state on the healer |

**Contrast with Kale:** Kale’s cadence was mostly per-spell cast/CD with late *Cast All* as a meta dump. We want **GCD weaving + intentional cooldown pops** as the skill ceiling, not a single “cast everything” button.

#### Hybridization roadmap (document now, build later)

| Phase | Scope | MVP? |
|-------|-------|------|
| 1 | Hybridize **within** the chosen archetype’s branches | **Yes** |
| 2 | Limited **cross-archetype** multiclass (D&D-style dip / dual path) | **No — post-MVP** |
| 3 | Deeper multiclass rules, caps, and identity protection | **No — post-MVP** |

Cross-archetype multiclass waits until the three cores feel distinct and fun alone.

#### Achievement-unlocked archetypes (document now, build later)

As players hit **achievement milestones** (campaign clears, challenge dungeons, mastery goals), **new archetypes unlock**.

- Include in long-term design so the fantasy of “more identities over a lifetime” is planned.
- **Not in MVP.** MVP ships exactly these three.
- Unlock criteria and archetype list TBD after the first three are solid.
- Future candidates (not committed): Holy Priest–style pure reactive, Mistweaver-style hybrid, Shaman totem/CD toolkit, etc.

### 7.3 Skill unlock philosophy (leaning — D2)

**Hybrid model:**

- **Experience** unlocks a baseline spell list over time (you earn tools by playing).
- **Skill tree** grants big perks, keystones, modifiers, and *some* skill unlocks — but is not a pure “buy every spell” ladder.
- Archetype choice shapes which perks and keystones are available.

### 7.4 Mercenary trees (leaning — D3)

- Each merc: about **3 abilities**.
- Tree is a **simple fork** (often binary or ternary): which identity do they lean into?
- Examples of fork *types* (not final): sponge vs pulse-threat; execute vs DoT; burst vs sustain.
- Complexity budget stays on the healer.
- Whether merc forks cost rubies is **open (D4)**.

---

## 8. Content structure

### Dungeons (general)

- Selectable from a hub after unlock.
- Multi-stage fights ending in a boss.
- Later dungeons add **modifiers** that demand specific tools (silence-like constraints, mana pressure, timers, cleanses, etc.).
- First clear rewards a **ruby** (confirm exact economy in balancing pass).

### PoC / first dungeon shape (locked — D12)

Keep early content **Kale-simple**: nondescript trash with no fancy effects is fine.

| Beat | Content |
|------|---------|
| **Waves 1–2** | Generic mobs. Auto-attacks only. |
| **Boss** | After the waves. **One named move** with a **~10s visible cast bar**. |
| **Phase transitions** | Out of PoC. |

Full PoC script, numbers, and Dungeon 2 sandbox: [`poc-spec.md`](./poc-spec.md).

### Campaign shape (open — D7)

Targeting a complete short-to-medium campaign later. PoC = Ash Gate + unwinnable Dungeon 2 only.

### Post-game (open — D8)

Deferred.

---

## 9. Archetype vignettes (design reference)

Long-term “same dungeon, three brains” writeups. **PoC implements a trimmed Oathbound path only** (no procs, no Wrath) — see [`poc-spec.md`](./poc-spec.md).

**Shared stage (design):** *The Ash Gate* — waves of trash → **Gate Warden** with **Bonehowl** (~10s cast).

### Vignette A — Oathbound (full fantasy; not all in PoC)

**Full kit:** Solemn Mend · Zealous Mending · Vowstrike · Wrath Ascendant  
**PoC kit:** Solemn Mend → XP unlock Zealous → gold tree node → ruby subclass split. No Vowstrike/Wrath/procs yet.

| Beat | Full fantasy | PoC |
|------|--------------|-----|
| Waves | Triad weave, bank mana | Solemn Mend only at first; avoid overheal |
| Bonehowl | Pop Wrath, dump fast heals | Pre-heal / top off during 10s cast; mana matters |
| Fail | OOM from Zealous spam | OOM / overheal waste |

### Vignette B — Aegis (post-PoC)

Shields first, Penitent Mend for leaks, Painbind on Bonehowl. No atonement.

### Vignette C — Wildbloom (post-PoC)

**Ashwood Form** = Tree-style window (HoTs stronger for a duration).  
**Wild Expenditure** = consume/cash HoTs for emergency burst.  
Choose extend vs expend on Bonehowl — irrelevant until Wildbloom is built.

---

## 10. MVP / PoC vs later

### PoC (authoritative: [`poc-spec.md`](./poc-spec.md))

- Title **healgame**; **Oathbound only**
- Tutorial → Solemn Mend → expected wipe → hub
- XP auto-skill + gold tree skill + **ruby subclass split**
- Ash Gate clear; Dungeon 2 overpowered sandbox
- GCD 1s, all on GCD, queue, click-to-target, ~10s boss casts
- No procs, no major CD, no hub buffs, no respec (restart only)
- Single local save; UI/art = **separate slice**

### Full MVP (after PoC)

- All three archetypes; procs; major CDs; hub buffs; merc forks; more dungeons
- Respec when theorycraft needs it

### Explicitly later

- Boss phases; atonement; multiclass; achievement archetypes; polished UI/art; post-game

---

## 11. Decision log

| ID | Topic | Decision | Date |
|----|-------|----------|------|
| D1 | Healer path model | 3 archetypes long-term; **PoC = Oathbound only** | 2026-07-08 |
| D2 | Skill unlock source | Hybrid — XP auto-skills + gold tree | 2026-07-08 |
| D3 | Party complexity | ~3 abilities + forks long-term; **PoC = autos only** | 2026-07-08 |
| D4 | Ruby sinks | **PoC: subclass split** (opens one branch, hides other) | 2026-07-08 |
| D5 | Cast UX | Target → spell; **PoC: click-to-target only** | 2026-07-08 |
| D6 | Tone | Heavy-metal dark fantasy | 2026-07-08 |
| D7 | Campaign length | PoC: 2 dungeons (D2 unwinnable); full length TBD | 2026-07-08 |
| D8 | Post-game | TBD | — |
| D9 | Combat cadence | **GCD 1s**; all on GCD in PoC; queue; boss casts ~10s | 2026-07-08 |
| D10 | Archetype identities | Oathbound / Aegis / Wildbloom | 2026-07-08 |
| D11 | Permanent hub buffs | Desired later; **out of PoC** | 2026-07-08 |
| D12 | PoC dungeon | Ash Gate waves + Bonehowl; no phases; D2 sandbox | 2026-07-08 |
| D13 | Aegis atonement | Deferred | 2026-07-08 |
| D14 | PoC success bar | No procs/major CD; XP+tree+ruby subclass; wipe→hub; clear Ash Gate; D2 sandbox | 2026-07-08 |
| D15 | Save / respec | Single local save; **no respec**; restart only | 2026-07-08 |
| D16 | Rewards | Gold+XP per enemy; 1 ruby per dungeon first clear; replay OK | 2026-07-08 |
| D17 | Product name | **healgame** | 2026-07-08 |

---

## 12. Open questions (post-PoC / micro)

PoC is locked. Remaining are either **tasking micro-choices** (see poc-spec §10) or **post-PoC**:

1. Fantasy rename pass for spells/archetypes  
2. When to reintroduce hub buffs, procs, major CDs  
3. Wildbloom: teach Ashwood Form vs Wild Expenditure first  
4. Full D7/D8 scope  

---

## 13. Next steps

1. Pick **tech**  
2. Cut **vertical-slice tasks** from [`poc-spec.md`](./poc-spec.md)  
3. UI/art slice = separate track later  

---

## Document history

| Version | Date | Notes |
|---------|------|-------|
| v0.4 | 2026-07-08 | PoC Q&A locked; pointer to poc-spec.md |
| v0.3 | 2026-07-08 | PoC vignettes; hub buffs; simple waves + boss move |
| v0.2 | 2026-07-08 | Archetype kits, GCD + major CDs |
| v0.1 | 2026-07-08 | First GDD from Kale research + D1/D5/D6 |
