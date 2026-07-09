# healgame — Tech Options for PoC

**Status:** Decision aid (not locked)  
**Date:** 2026-07-08  
**Constraint:** Most of the PoC will be coded by a **Fable / Cursor coding agent**  
**Authority for gameplay:** [`poc-spec.md`](./poc-spec.md)

---

## What the PoC actually needs from tech

This is **not** a physics platformer or open world. It is:

| Need | Notes |
|------|--------|
| 2D side-view battle line | Units stand still; no pathfinding |
| Click targeting + spell bar | UI-heavy healer fantasy |
| Timers | GCD, cast bars (~2s heals, ~10s boss casts), auto-attack intervals |
| Simple scenes | Tutorial → combat → hub → tree → subclass |
| Persist | Single local save (localStorage / file) |
| Temp art | Placeholders OK until separate art/UI slice |
| Fast agent iteration | Preview in browser, TypeScript types, lots of examples online |

**Implication:** Prefer a **code-first 2D web stack** over a heavy editor-first engine for agent success.

---

## Options compared

| Option | Lang | Agent success | Fit for PoC | Ship later | Verdict |
|--------|------|---------------|-------------|------------|---------|
| **A. Phaser 3 + TypeScript + Vite** | TS | **Best** — huge corpus of examples | Excellent | Web / Steam via wrappers later | **Recommended** |
| **B. Excalibur.js + TypeScript** | TS | Very good — TS-native, smaller corpus | Excellent | Web-first | Strong alt |
| **C. PixiJS + custom loop + React/HTML UI** | TS | Good at UI, more glue to invent | Good | Web | Overkill architecture for PoC |
| **D. Godot 4 (GDScript)** | GDScript | Weaker — less agent training than TS/JS | Excellent game-wise | Desktop/mobile/web export | Better *after* PoC if you want native |
| **E. Unity 2D (C#)** | C# | Mixed — agents can do it, heavier project | Overkill | Strong shipping | Too much for PoC |
| **F. Pure React/DOM “game”** | TS/React | Great at hub/tree UI; weak at combat feel | Mediocre combat | Web | Tempting, wrong primary loop |
| **G. Love2D / Raylib** | Lua / C | Poor–fair for Fable | Fine technically | Desktop | Skip for agent-led PoC |

### Agent success ranking (practical)

1. **TypeScript + Phaser** — most tutorials, StackOverflow, and prior agent runs  
2. **TypeScript + Excalibur** — clean API, less noise, fewer copy-paste recipes  
3. **TypeScript + Pixi + HTML overlay** — flexible, more decisions for the agent to get wrong  
4. **Godot GDScript** — great engine, agents stumble more on project layout / signals / exports  
5. **Unity** — viable but slow to scaffold and heavy for “Ash Gate in a week”

---

## Recommendation

### Ship the PoC on: **Phaser 3 + TypeScript + Vite**

**Why this is most realistic for healgame + Fable:**

1. **Combat + UI in one toolkit** — scenes, input, tweens, text, rectangles, timers without inventing an engine.  
2. **Browser preview** — `npm run dev`, click, iterate; agents debug with console + screenshots easily.  
3. **TypeScript** — types for `Unit`, `Spell`, `SaveData` stop agents from inventing inconsistent shapes.  
4. **Matches the game** — facing-line auto-battler with cast bars is a solved pattern in Phaser examples.  
5. **Temp art is trivial** — colored rects, circles, emoji/text labels, or 1–2 placeholder PNGs.  
6. **Escape hatches** — later you can still move to Godot/Unity for a “real” client if needed; keep combat rules as pure TS modules so logic isn’t trapped in Phaser forever.

**Suggested layout:**

```
healgame/
  docs/                 # already exists
  game/                 # or src/
    package.json
    vite.config.ts
    index.html
    src/
      main.ts
      scenes/           # Boot, Tutorial, Combat, Hub, Tree
      combat/           # pure logic: gcd, cast queue, damage, waves
      data/             # spells, dungeons, numbers from poc-spec
      save/             # localStorage
      ui/               # bars, target marker (Phaser objects for PoC)
      assets/placeholders/
```

**Keep combat rules Phaser-agnostic** (`combat/` as plain TS). That gives the coding agent a clean core and makes a future engine swap possible.

### When to pick something else

| If you care most about… | Pick |
|-------------------------|------|
| Absolute simplest TS engine API | Excalibur instead of Phaser |
| Hub/tree UI perfection first | Still Phaser for combat; don’t go React-only |
| Desktop-first + visual editor *you* will use daily | Godot — but expect more agent friction |
| Already living in Unity | Unity 2D — only if you personally want that toolchain |

---

## Temp art plan (PoC)

Do **not** block on real art. Separate UI/art slice later (per PoC decisions).

| Asset | Temp approach |
|-------|----------------|
| Units | Colored capsules / rectangles + name label (Tank, DPS, Healer, Mob, Boss) |
| Target marker | Triangle / chevron above selected ally |
| HP / mana | Phaser graphics bars (green / blue) |
| Cast bars | Yellow bar + spell/boss ability name text |
| Spell bar | Bottom row of labeled buttons (clickable rectangles) |
| Hub / tree | Simple panels + text buttons (ugly OK) |
| Background | Flat dark ash/gray gradient or solid `#1a1210` |
| Vibe | Optional: one concept image as hub splash later; not required to play |

**Optional cheap upgrade:** Kenney-style CC0 packs or 32×32 silhouette sprites — only if it doesn’t slow the agent. Rectangles are enough to validate mana triage.

**Audio:** silence or one beep on cast — optional for PoC.

---

## What Fable should optimize for

Give the coding agent:

1. [`poc-spec.md`](./poc-spec.md) as the build bible  
2. **TypeScript strict** + small pure modules for combat math  
3. **One scene at a time** tasks (Boot → Tutorial → Combat wipe → Hub → …)  
4. Placeholder art conventions in a one-pager (`docs/temp-art.md` when we start)  
5. Avoid: ECS over-engineering, React+Phaser hybrid, networking, asset pipelines

---

## Decision

| Choice | Status |
|--------|--------|
| Recommended stack | **Phaser 3 + TypeScript + Vite** |
| Alt if you hate Phaser | Excalibur + TypeScript + Vite |
| Not for PoC | Unity, pure React game, Love2D |
| Temp art | Geometric placeholders + text |
| Next | Lock stack → cut vertical-slice task list |

---

## Document history

| Version | Date | Notes |
|---------|------|-------|
| v1 | 2026-07-08 | Initial options + recommendation for Fable-led PoC |
