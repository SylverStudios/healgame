# Healgame — PoC Spec (locked)

Status: current · Authority: PoC baseline (phase amendments in poc-qa / handoffs win) · Last verified: 2026-07-12

**PoC implementation details.** Wins on PoC conflicts unless a later phase
handoff or `poc-qa.md` amendment says otherwise. Long-term design: [`GDD.md`](./GDD.md).
**Date:** 2026-07-08  
**Title:** healgame  
**Archetype under test:** Oathbound only  
**Related:** [`GDD.md`](./GDD.md) (long-term design) · this file wins on any PoC conflict

---

## 1. What “done” means

The PoC is successful when a player can:

1. Learn **one** heal via a short tutorial (click to unlock / equip).
2. Enter **Ash Gate**, wipe (expected), return to hub with **gold + XP**.
3. Understand hub well enough on the second visit to spend / see progression.
4. Gain a **second skill from XP** (level ding → skill, no extra click required).
5. Unlock **one skill from the talent tree** (gold spend).
6. Clear Ash Gate, earn **1 ruby** (first completion of that dungeon).
7. Spend that ruby on a **subclass split** (see §6) that opens one branch and locks the other.
8. Enter **Dungeon 2** with an **insanely overpowered boss**, die forever in an endless sandbox (no clear expected; no further dungeons).

**Not required for PoC:** procs/floating combo indicators, major cooldowns, hub permanent buffs, Aegis/Wildbloom, respec, polished UI/art, party hotkeys.

**UI/art** is a **separate vertical slice** for a later agent.

---

## 2. Answers to pre-slice questions

| # | Topic | Decision |
|---|-------|----------|
| 1 | Archetype scope | **Oathbound only** |
| 2 | Wildbloom Bonehowl | **N/A for this PoC** — see §2.1 |
| 3 | Starting kit / first run | **Solemn Mend only**; tutorial click; **expected wipe**; then hub with currency |
| 4 | GCD / CDs / boss cast | **GCD 1s**; **everything on GCD** for now; queue back-to-back; boss casts **~10s** |
| 5 | Numbers | **Low integers (1–10)**; first dungeon is **mana / overheal discipline**, not raw HPS check |
| 6 | Targeting | **Click-to-target only** |
| 7 | Rewards | **Fixed gold per enemy**; **1 ruby per dungeon first completion**; replay = gold + XP |
| 8 | Hub buffs | **None in PoC** (deferred) |
| 9 | Ruby sink | **One subclass split** — pick opens a tree branch, locks the other (rival visible but LOCKED; see §6 amendment) |
| 10 | Mercs | **Auto-attacks only** |
| 11 | Wipe expectation | **First run wipes**; many wipes OK; no downside beyond time |
| 12 | PoC bar | See §1 — no procs, no major CD; XP skill + tree skill + ruby subclass; Ash Gate clear; D2 sandbox |
| 13 | Name | **healgame** |
| 14 | UI | **Later slice** — not this PoC |
| 15 | Save | **Single local save**; everything persists |
| 16 | Respec | **No respec**; **restart** (new save / wipe progress) only |

### 2.1 Question 2 explained (Wildbloom — not in PoC)

That question was only for the **Wildbloom** (Resto) vignette, which we are **not building yet**.

- **Ashwood Form** = the big “Tree of Life” style cooldown: you pop a form and your HoTs get stronger for a while.
- **Wild Expenditure** = you **spend/consume** HoTs already on someone for an emergency burst heal (cash in the garden).

For Bonehowl, Wildbloom could either pop the form *or* cash HoTs. **Irrelevant until we build Wildbloom.** Oathbound PoC does not need this choice.

---

## 3. Player journey (scripted)

```
New game
  → Tutorial: click to learn Solemn Mend (only heal)
  → Enter Ash Gate (expected wipe)
  → Hub: gold + XP from enemies killed; UI already familiar from tutorial
  → Play more: level ding → second skill auto-unlocks (XP skill)
  → Spend gold on talent tree → unlock one tree skill
  → Eventually clear Ash Gate → 1 ruby
  → Spend ruby → subclass A or B in the talent tree (rival path LOCKED, not hidden)
  → Ash Gate replayable for gold + XP
  → Unlock Dungeon 2 → overpowered boss sandbox (cannot clear / no need to)
```

Kale reference: first run teaches cast + wipe; second hub visit is when the meta UI clicks. Match that pacing.

---

## 4. Combat rules (PoC)

| Rule | Value |
|------|-------|
| GCD | **1 second** |
| Spell queue | Yes — queue next spell to start when current cast/GCD allows (back-to-back) |
| Major CDs / off-GCD | **None in PoC**; everything on GCD |
| Targeting | Click ally → icon marks them → click spell or hotkey spell |
| Party hotkeys | Not in PoC |
| Merc / enemy actions | Auto-attacks only (plus boss casted move) |
| Boss telegraph | Named move + **~10s** cast bar (same readability as player cast bar) |
| Procs / floating indicators | **Not in PoC** |
| Numbers | Integers only; keep values in roughly **1–10** where possible so we can scale later |

### 4.1 Design intent — Ash Gate difficulty

- Threat is **mana**, not “can you outheal the DPS.”
- Player should feel pressure to **land full heals** (minimal overheal) because wasted mana loses the run.
- Tank should not die in a few seconds if you heal correctly; you die by going OOM and then failing to cover.

### 4.2 Draft numbers (tunable — starting point)

Keep low; retune in play. All integers.

| Stat | Draft |
|------|-------|
| Tank max HP | 20 |
| DPS max HP | 10 each |
| Healer max HP | 15 (if ever hit; prefer not targeted in PoC) |
| Starting mana | 20 |
| Mana regen in combat | 0 or 1 per ~5s (prefer harsh: **0** for first dungeon) |
| Trash auto damage | 1 |
| Trash swing interval | 3s |
| Solemn Mend | Heal **5**, mana **5**, cast **2s** (then GCD rhythm) |
| Gate Warden auto | 2 |
| Gate Warden swing | 3s |
| **Bonehowl** | Cast **10s**, party damage **4** when it lands |
| Gold per enemy | 1 |
| XP per enemy | 1 (level thresholds TBD — e.g. level 2 at 10 XP) |

**Second heal (XP unlock) draft:** Zealous Mending — heal **6**, mana **6**, cast **1s** (faster tempo tool; same heal-per-mana as Solemn Mend). Tuned 2026-07-12 — see `poc-qa.md` playtest retune.  
**Tree unlock draft:** pick one small node (e.g. +max mana **5**, or Solemn Mend cost **4** instead of 5) — exact node TBD in tasking.  
**Ruby subclass:** see §6.

Dungeon 2 boss: absurd HP / damage so the party cannot win with PoC power. Sandbox only.

---

## 5. Progression (PoC)

| Channel | What it does in PoC |
|---------|---------------------|
| **XP / level** | **Kit breadth.** At a level threshold, **auto-grant** a skill (PoC: Zealous Mending at Lv 2). No spend UI. Further XP has no extra sinks yet. |
| **Gold** | **Tree growth.** Spend on **talent tree** nodes (Deep Reserves, forsaken-path tempo, …). |
| **Ruby** | **Branching power.** **One** PoC sink: **subclass oath** after Ash Gate clear (scarce; first-clear only). |
| **Hub buffs** | **Out of PoC.** |
| **Respec** | **None.** Restart = new save / wipe all progress. |

### Rewards

| Event | Reward |
|-------|--------|
| Enemy kill | Fixed **gold** + **XP** (even if you wipe later) |
| Wipe | Keep earned gold/XP; return to hub |
| **First** clear of a dungeon | **1 ruby** + clear loot (gold/XP as usual) |
| Replay cleared dungeon | Gold + XP only (no extra ruby) |

---

## 6. Ruby subclass split (PoC)

After Ash Gate first clear, player has 1 ruby and may buy a **subclass**.

**Rules (original PoC draft):**

- Two options (working names):
  - **Path of the Vigil** — leans efficient / slow-heal mastery (opens Vigil branch nodes).
  - **Path of the Zealot** — leans fast / emergency healing (opens Zealot branch nodes).
- Choosing one **spends the ruby**, **opens that branch**, and **closes the other**.
- ~~The unselected branch is not visible until chosen (blind commit).~~
- No respec; restart to try the other path.

### Amendment (Phase 2 — current)

Blind pick / hidden rival branch is **retired**. Subclass oaths live **in the
talent tree** with full descriptions visible before purchase. Buying one spends
the ruby (two-click confirm in UI), sets subclass, and permanently locks the
rival (shown greyed **LOCKED**, still visible). Follow-up nodes sit behind the
chosen oath. Live config: `game/src/data/talentTree.ts`; tree service:
`game/src/tree/AGENTS.md`.

---

## 7. Content

### Ash Gate (Dungeon 1)

1. Wave — nondescript trash, autos only  
2. Wave — slightly denser, still no specials  
3. Boss **Gate Warden** — autos + **Bonehowl** (10s named cast, party damage)  
4. No phases  

### Dungeon 2 (sandbox)

- Unlocks after Ash Gate clear (or after ruby spend — either is fine; prefer **after clear**).
- Boss is **massively overpowered**; player cannot clear with PoC tools.
- Purpose: endless attempts / grind sandbox / feel the ceiling. No Dungeon 3.

---

## 8. Save / restart

- **One** local save slot.
- Everything that matters is saved (currencies, XP, tree, subclass, dungeon unlocks, tutorial flags).
- **Restart** = wipe save and begin new game. No partial respec.

---

## 9. Explicitly out of PoC

- Aegis, Wildbloom  
- Procs / floating combo indicators  
- Major cooldowns (Wrath, etc.)  
- Permanent hub buffs  
- Party slot hotkeys  
- Merc path trees  
- Boss phases  
- Atonement  
- Multiclass / extra archetypes  
- Polished UI / final art (separate slice)  
- Respec  

---

## 10. Remaining micro-choices (OK to decide during tasking)

These do **not** block cutting tasks or picking tech:

1. Exact level-2 XP threshold  
2. Exact tree node granted for gold (mana vs heal cost vs heal amount)  
3. Whether Dungeon 2 unlocks on Ash Gate clear or after ruby subclass purchase  
4. Whether healer can be targeted by trash in PoC  
5. Solemn Mend: does cast time replace GCD, or cast then 1s GCD? (**Recommend:** cast time is the busy time; queue next during last 0.5s of cast; GCD 1s for instants later)

---

## Document history

| Version | Date | Notes |
|---------|------|-------|
| v1 | 2026-07-08 | Locked from pre-slice Q&A |
| v2 | 2026-07-10 | §6 amended (Phase 2 in-tree oaths); frontmatter |
