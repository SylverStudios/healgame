# Healgame — Design Direction (Phase 1)

Working title TBD. Spiritual successor to *Master Healer Kale with useless party*, not a clone.

**Status:** Research complete; key decisions locked into [`../GDD.md`](../GDD.md). Mixing remaining ideas before tech/tasking.

---

## North star

A short-to-medium healer game where:

1. A **run** is beautifully minimal — Darkest Dungeon–style facing line, no movement, party auto-attacks on cooldown, you only heal/support.
2. The **meta** is where theorycrafting lives — exclusive archetypes, real lockouts, rubies as the scarce vote.
3. Combat feedback makes **combos readable** — proc states float around the healer.
4. Casting feels like **old-school MMO healing** — target first, then spell; end-of-cast queue window.
5. Tone is **heavy-metal dark fantasy**, not comedy-useless party.

---

## Keep from Kale (confirmed)

| Element | Why |
|---------|-----|
| Healer-only control | Core fantasy |
| Fixed party auto-DPS + tank sponge | Simplicity of the run |
| Horizontal 2D facing line, no movement | Visual clarity + “beautiful minimalism” |
| Wipe still pays gold + XP | Failure feels productive |
| Rubies scarce; contested spend | Real choice |
| Easy respec | Encourages experimentation *if* builds differ |
| Dungeon modifiers that demand tools | Forces build diversity beyond raw stats |
| Short campaign arc + optional hard mode | Scope discipline |

---

## Locked alterations

### A. Healer archetypes (D1)

- **MVP: 3 mutually exclusive archetypes**
- Hybridize **within** an archetype’s branches
- **Later:** D&D-style cross-archetype multiclass (not MVP)
- **Later:** achievement milestones unlock additional archetypes (GDD only for now)
- XP unlocks baseline skills; tree sells big perks / keystones / some unlocks (D2)

### B. Party trees (D3)

- Mercenaries, not clowns: ~**3 abilities**, simple path forks
- Complexity budget stays on the healer

### C. Rubies

- Stay scarce (exact sinks = D4, open)

### D. Combat UX (D5)

- **Target → hotkey/click spell**
- Selected target shows a **pointer/icon**
- Manual spell clicks still require a selected target
- **~0.5s** end-of-cast queue
- Proc indicators float around the healer

### E. Tone (D6)

- *The Last Spell* energy + old-school panel-van dragon fantasy **attitude**
- Heavy metal, scary, mythic swagger — vibe reference, not literal airbrush art mandate

---

## System map (draft)

```
RUN
  Layout: DD-style line, no move
  Player: heal/support only
  Party: 3 mercs, auto abilities on CD
  Targeting: select ally (icon) → hotkey/click spell
  Feedback: floating proc indicators on healer
  Casting: ~0.5s end-of-cast queue

REWARDS (always on attempt)
  XP → unlocks baseline skills / levels
  Gold → small perks, merc path steps
  Ruby → first clear / boss (scarce) → keystones & contested unlocks

META
  Healer: 3 archetypes (hybridize within; multiclass later)
  Mercs: tiny forks, ~3 abilities
  Respec: cheap/free
  Dungeons: unlock with success; modifiers demand tools
  Later: achievement archetypes
```

---

## Decision log

| ID | Topic | Decision | Date |
|----|-------|----------|------|
| D1 | Healer path model | 3 archetypes MVP; within-hybrid; cross-multiclass later; achievement archetypes documented not built | 2026-07-08 |
| D2 | Skill unlock source | Hybrid (XP skills + tree perks) | 2026-07-08 |
| D3 | Party complexity | ~3 abilities + simple path forks | 2026-07-08 |
| D4 | Ruby sinks | TBD | — |
| D5 | Cast UX | Target → hotkey/click; target icon; queue ~0.5s | 2026-07-08 |
| D6 | Tone | Heavy-metal dark fantasy (Last Spell + panel-van dragon vibe) | 2026-07-08 |
| D9 | Combat cadence | Shared GCD + major pop CDs per archetype | 2026-07-08 |
| D10 | Archetype identities | Oathbound (Holy Pal), Aegis (Disc), Wildbloom (Resto HoT) | 2026-07-08 |

---

## Next phases

1. Same-dungeon vignettes for each archetype
2. Resolve D4 (ruby sinks)
3. Pick tech + vertical-slice tasks

---

## Reference

- GDD: [`../GDD.md`](../GDD.md)
- Kale breakdown: [`master-healer-kale.md`](./master-healer-kale.md)
- Canvas: `kale-design-research.canvas.tsx`
