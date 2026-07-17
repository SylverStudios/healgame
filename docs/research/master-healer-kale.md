# Master Healer Kale — Research Notes

Status: historical · Authority: none — inspiration research · Last verified: 2026-07-17

**Full title:** *Master Healer Kale with useless party*  
**Developer:** Evrac Studio (Evrac, Indonesia)  
**Released:** July 2–3, 2026 (Steam)  
**Platforms:** Windows, macOS; Steam Deck playable; itch.io / web demo  
**Reception:** Overwhelmingly Positive (~97%, 648+ reviews)  
**Length:** Designed ~4 hours + Nightmare / post-game  
**Engine:** Unity (inferred from web demo)

**Primary sources**
- [Steam store](https://store.steampowered.com/app/4634490/Master_Healer_Kale_with_useless_party/)
- [Steam news / v1.5 changelog](https://steamcommunity.com/app/4634490/allnews/)
- [Steam achievements (38)](https://steamcommunity.com/stats/4634490/achievements)
- [itch.io demo](https://evrac.itch.io/masterhealerkale)
- [Into Indie Games beginner guide](https://intoindiegames.com/walkthroughs/tips-tricks/master-healer-kale-with-useless-party-beginners-guide/)
- [TposeGaming walkthrough](https://tposegaming.com/master-healer-kale-walkthrough/) — useful but treat dungeon/spell specifics as medium confidence
- Steam discussions (controls, mage vs archer, bugs)
- Gameplay footage (e.g. Indie Buffet ~60m)

**Source quality:** Steam + achievements + changelog + player discussions = high confidence. SEO walkthroughs may be partially AI-assisted; mark unverified claims.

---

## 1. What the game is

A short **incremental healer-sim auto-battler**. You play only the healer. A fixed comedy party auto-fights on a 2D side-view line. You manage mana and cast heals/buffs (later utility/offense) so they clear dungeon stages. Between attempts you spend currencies in a Tavern skill web.

**Core fantasy:** compressed WoW healing — triage, cast-time tension, “can the tank eat one more hit?” — plus failure-as-progress incremental power and a joke party that slowly becomes useful.

**Not:** Darkest Dungeon formation management, party swapping, or player-controlled movement. Layout *looks* like DD (units facing each other on a horizontal line), but nobody repositions; attacks fire on cooldown.

---

## 2. Essential components

### 2.1 Party (fixed, no swapping)

| Unit | Role | Behavior |
|------|------|----------|
| **Kale** (player) | Healer / support | Casts heals, buffs, later utility/offense |
| **Grandpa Bagel** | Tank | Sleeps through combat; soaks damage; little/no attacking early |
| **Madeleine** | Mage DPS | Fireballs; later Arcane path; “genius but mean” |
| **Klepon** | Archer DPS | Newbie archer; arrows; status/DoT later |

**AI pillars:** Bagel is a pure sponge. From ~stage 3, enemies hit backline randomly. Archer/mage often focus poorly (boss before adds) — comedy *and* friction. Tree nodes improve AI, targeting, and conditional DPS (e.g. mage bonus with shield / when archer dead — community-reported).

### 2.2 Combat presentation

- Side-view 2D pixel; party left, enemies right; single horizontal line
- No movement; auto-attacks on per-ability cooldowns
- Spells on a bottom bar
- HP shown on units and/or a side list (players complain attention is split)
- Pause exists; Joystick Mode for controller
- Cast bars / charging for cast-time spells

### 2.3 Player controls (verified)

| Mode | Behavior |
|------|----------|
| Default single-target | **Hotkey/select spell → click target** |
| Party Heal (and similar) | Hotkey casts immediately (no aim) |
| Desired by players | Target-first then hotkey; remappable binds |

**Starter Heal (high confidence):** restore 30 HP, cost 10 mana, **2s cast**, **2s cooldown**.

**Cast model:** per-spell cast times + cooldowns. **No verified shared GCD.** **No verified spell queue** (press-ahead). Late tools like Cast All / multi-cast exist and have caused cast-lock bugs.

### 2.4 Resources in a fight

- **Mana** is the real skill expression (overheal = waste; OOM = wipe)
- Later: shields, cleanses, haste, meditate, emergency forms
- Party DPS is automatic; player offense is secondary (some fighting spells unlock later)

### 2.5 Currencies (meta)

| Currency | Source | Spend |
|----------|--------|-------|
| **Gold** | Kills / progress (even on wipe) | Most skill-tree nodes |
| **Skill points** | Party XP / levels | Skill-tree nodes |
| **Rubies** | Scarce; bosses / first clears (player report: 1 ruby on first dungeon clear; achievements at 6 / 16 collected) | Premium spells & major nodes; also contested with party upgrades |
| **Training / Research funds** | Post-game (Nightmare) | Infinite stat / spell scaling |

### 2.6 Skill tree (Tavern)

- One giant **web/graph**, ~222 nodes at launch → **~253** after v1.5 (+31)
- Branches for Kale + each party member
- Mix: flat stats, cast-time reduction, mana max/regen, heal potency, shields, AI, weapon masteries, automation, comedy nodes
- **Respec:** “Reset Point” node; v1.5 right-click resets a node + dependents; full reset refunds currencies
- **Feel (player + your experience):** looks expansive, plays fairly linear — main heal upgrades + unlock more tools; money eventually unlocks everything; **rubies** are the real choice
- Party trees ~1/3 the size of Kale’s; still mostly unlock ladders

### 2.7 Spells (partial list from achievements + guides)

**Confirmed via achievements / changelog:** Heal, Party Heal, Meditate, Burst Heal, Instant Heal, Raise, Time Warp, Esuna, Angel Form, Transmute Gold, Shield / Protection, Cast All (guides), Life Ascension (guides — medium confidence)

**Marketing claim:** 18 active spells.

**Proc / combo patterns (verified or strongly evidenced):**
- Party Heal overheal → mana refund
- Burst Heal to full → grant shield
- Bagel KO → backline gains shield
- Madeleine bonus damage with shield / when archer dead
- Magma Core achievement: Shield on all when Fire Dragon special hits

**Feedback gap:** combos exist in tooltips/nodes but lack clear “proc window active” HUD (your observation matches community UX complaints).

### 2.8 Dungeons & progression

**Structure:** Tavern → pick dungeon → multi-stage waves → boss → win or wipe → retreat with partial rewards → upgrade → retry / unlock next.

**Marketing:** 16+ dungeons; bosses with different strategies.

**Named content (tiered confidence):**

*High / achievement-backed:* Goblin Leader, Winterfall Peak, Withered Desert, Battle Arena, Underwater Abyss, Gravity Arena, Magma Core, Demon King, Nightmare variants

*Gameplay / multi-source:* Underground Sewer / Giant Fang, Haunted Armory / Living Weapons / Parasite Knight, Wolf’s Den

*Guide-only (medium):* Temple of Silence, Toxic King, Grand Alpha, Dread Boore

**Dungeon modifiers** force tool diversity (silence, low start mana, timer, heavy defense, speed debuffs needing Esuna).

**Post-game:** Nightmare Mode after Demon King (or required nodes); Training Facility + Research Facility for infinite scaling.

---

## 3. Play loops

### 3.1 Single run (combat loop)

```
Enter dungeon stage
  → Party auto-attacks on CDs; enemies attack (tank-focused early, random later)
  → Player watches HP / mana / cast bars
  → Select heal/buff → (optional) click target → cast time → resolve
  → Manage triage: who dies next, when to spend mana, when to hold for spike
  → Stage clear → next stage / boss
  → Wipe OR dungeon clear
```

**Skill expression in-run:** mana efficiency, pre-casting before spikes, target priority, using the right tool (AoE heal vs single, shield vs cleanse), reading dungeon modifiers.

**What is intentionally *not* skill expression:** positioning, party commands, movement, enemy targeting (except via meta AI upgrades).

### 3.2 Overall game loop (meta)

```
Attempt dungeon
  → Earn gold + skill points (even on failure)
  → First-time / boss clear → ruby(s)
  → Tavern: spend into skill web (Kale + party)
  → Unlock next dungeon when strong enough
  → Repeat until Demon King
  → Nightmare + infinite facilities
```

**Emotional arc:** weak first run (1 spell, OOM, wipe) → productive failure → power fantasy as party “fireworks” → tool checks via dungeon modifiers → post-game climb.

**Dev note (Evrac):** built in ~35 days; early game acknowledged as slow/repetitive; skill tree intentionally huge (“do we need more skills? No… but it’s fun”).

---

## 4. What players love (keep)

1. Healer-only fantasy with cast-time / mana triage
2. Minimal run: no movement, auto DPS, you only heal
3. Failure always pays (gold + XP)
4. Rubies as scarce meaningful spend
5. Comedy party fantasy
6. Short complete campaign + optional post-game
7. Easy-ish respec (directionally good; execution imperfect)

## 5. What players / you found lacking (improve)

1. **Skill tree looks branched, plays linear** — unlock ladders into “use main heal + everything else”; little exclusive build identity
2. **No real reason to respec** once gold/SP flood; only rubies force choices
3. **Party trees too unlock-linear** for units you don’t control
4. **Combo/proc feedback weak** — no floating “ready” indicators on the healer
5. **Inconsistent cast UX** — some spells hotkey-instant, some select-then-click; no WoW-style end-of-cast queue
6. **Early game thin** with only 1 spell
7. Opaque tree gates / tiny % nodes / HP UI split attention

---

## 6. Explicit unknowns (do not invent as Kale facts)

- Full 18-spell list and exact numbers
- Exact ruby drop rules (first clear vs every boss vs Nightmare)
- Whether any shared GCD exists
- Complete dungeon list and modifier rules
- Precise gold/XP formulas
- Full keybind map
- Exact “free cast of B on A” rates (your memory of combo design; not fully verified in primary sources — treat as design inspiration, not confirmed Kale data)

---

## 7. Design takeaway for our game

Kale’s genius is the **minimal run + productive failure + scarce rubies**. Its missed opportunity is **build identity**: the tree sells theorycrafting but delivers a completionist unlock path. Our successor should keep the run simplicity and ruby scarcity, then make the meta about **exclusive paths and readable combat feedback**, not unlocking everything.
