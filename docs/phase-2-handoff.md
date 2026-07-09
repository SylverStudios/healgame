# Phase 2 handoff — combat feedback, spell tooltips, real spell tree

**Audience:** the central agent running Phase 2. Read after `CLAUDE.md`.
Authority order: `poc-spec.md` still wins on Phase-1 scope; **this doc wins on
Phase 2 scope** and explicitly amends poc-spec §6 (see "Locked decisions").
`poc-qa.md` decisions and `phase-1-poc-outcome.md` lessons still apply.

## Mission

Make combat legible (who attacked whom, what healed), make spells inspectable
(tooltips), and turn the flat node list into a real prerequisite tree with
functional branch effects — plus a research-only pixel-art pipeline chunk.

## Done means (user-observable; verify each yourself)

1. In combat, every auto-attack shows the **attacker lunging** toward its
   target and returning, and a **`*` marker flashing and fading** over the unit
   that was hit (including all 4 members on a Bonehowl/Extinction hit). Every
   effective heal shows a green **`+N` float** over the target. Readable at
   real game speed.
2. Hovering any spell button shows a **tooltip**: heal amount, mana cost, cast
   time in seconds — reflecting any tree modifiers currently active.
3. The Tree scene renders a **node graph with edges**: Deep Reserves at the
   root showing **`n/5` ranks**, branching to the two subclass nodes (ruby
   cost, granted spell's description visible **before** buying), each
   branching to a multi-rank **synergy node** and a **spell-mod node**. Edges
   gate purchase (prereq unmet = locked). Buying one subclass node visibly
   **locks the other permanently**. SubclassScene is gone from the flow.
4. Every branch effect **actually works in combat** (engine-tested; visible in
   heal numbers/tooltips).
5. A v1 save **migrates** to v2 with no progress lost (rules below); corrupt or
   unknown data still falls back to a fresh save.
6. All gates green: `npm run check`, `npm run smoke`,
   `node scripts/journey.mjs` (rewritten for the new subclass flow), and the
   balance gates in `combat/balance.test.ts` (retuned if needed, shape kept).
7. `docs/research/pixel-art-pipeline.md` exists with a concrete
   recommendation (bonus chunk — research succeeds even if the answer is
   "user draws, we downscale").

## Chunks

| id | what | depends on | owns (CREATE / EDIT) |
|---|---|---|---|
| 0 | **CENTRAL.** Baseline gates green; save v2 + migration; new tree data model; new spell defs; `meta/progression` rework (pure + tested); pin `Loadout` + `CombatSceneData` contracts | — | `game/src/save/`, `game/src/data/`, `game/src/meta/` |
| 1 | Engine effects: constructor options for synergies + missing-health bonus; resolved-spell plumbing; unit tests; update balance gates | 0 | `game/src/combat/` |
| 2 | Combat feedback + tooltips: lunge tween, `*` hit marker, `+N` heal float, spell-button tooltip | 1 | `game/src/scenes/CombatScene.ts`, `game/src/ui/` |
| 3 | Tree graph scene: nodes + edges, rank pips, prereq/lock states, subclass purchase in-tree, delete SubclassScene, fix Hub entry | 0 | `game/src/scenes/TreeScene.ts`, `SubclassScene.ts` (delete), `HubScene.ts`, `keys.ts` |
| R | Pixel-art pipeline research (docs only, no game code) | — | `docs/research/pixel-art-pipeline.md`, scratch scripts |
| 4 | **CENTRAL.** QA/integration: rewrite `journey.mjs` UI table + assertions for new flow, cross-boundary fixes, full journey run, QA note | all | `game/scripts/`, `docs/` |

Chunks 2 and 3 have disjoint file ownership and may run in parallel; default
to sequential (Phase 1 lesson). Chunk R is disjoint from everything and may
run parallel to anything.

## Pinned contracts (spell these out verbatim in subagent prompts)

### Save v2 (chunk 0)

- Key stays `healgame-save-v1`; `version: 2`.
- `treeNodes: string[]` → `treeRanks: Record<string, number>` (nodeId → ranks
  owned). `subclass` field stays; it is **set by purchasing a subclass tree
  node** (which also spends the ruby).
- Migration v1→v2: `'max-mana-1'` → `deep-reserves: 1`; retired nodes
  `'vigil-deep-focus'` / `'zealot-battle-fervor'` → **refund 5 gold each**;
  existing `subclass` maps to owning that subclass node at rank 1 (no extra
  ruby charge); everything else carries over. Unrecognized data → fresh save.

### Tree data model (chunk 0, in `data/tree.ts`)

```ts
type TreeNodeEffect =
  | { kind: 'bonusMaxMana'; amountPerRank: number }
  | { kind: 'grantSpell'; spellId: string }
  | { kind: 'synergy'; triggerSpellId: string; buffedSpellId: string; bonusHealPerRank: number }
  | { kind: 'missingHealthBonus'; spellId: string; healPer10PctMissingPerRank: number }
  | { kind: 'castMod'; spellId: string; castMsDelta: number; manaDelta: number };

interface TreeNode {
  id: string; name: string; description: string;
  cost: { currency: 'gold' | 'ruby'; amount: number };  // per rank
  maxRanks: number;                                      // 1 for most
  requires: string[];                                    // node ids, rank ≥1 each
  exclusiveGroup?: string;                               // 'subclass' — buying one locks the rest
  subclass?: SubclassId;                                 // set on subclass + follow-up nodes
  effect: TreeNodeEffect;
}
```

### Loadout (chunk 0, `meta/progression.ts`) — the cross-boundary type

```ts
interface Loadout {
  spells: SpellDef[];          // RESOLVED defs: castMod already applied to castMs/mana
  bonusMaxMana: number;
  synergies: { triggerSpellId: string; buffedSpellId: string; bonusHeal: number }[];
  missingHealthBonuses: { spellId: string; healPer10PctMissing: number }[];
}
buildLoadout(save: SaveData): Loadout
purchaseNode(save, nodeId): boolean   // checks: known, requires met, rank < maxRanks,
                                      // affordable in its currency, exclusiveGroup free;
                                      // subclass node purchase sets save.subclass
```

### Engine (chunk 1, `combat/engine.ts`)

```ts
new CombatEngine(encounter, spells /* resolved */, options?: {
  bonusMaxMana?: number;
  synergies?: Loadout['synergies'];
  missingHealthBonuses?: Loadout['missingHealthBonuses'];
})
```

- **Synergy semantics:** a completed cast of `triggerSpellId` *arms* the buff
  (re-arming replaces, never stacks); the next completed `buffedSpellId` cast
  consumes it and heals `+bonusHeal`. Deterministic, no new event types; the
  bonus shows up in the existing `heal` event's amount/overheal math.
- **Missing-health semantics:** on cast completion, `+healPer10PctMissing` per
  full 10% of the target's missing HP (`floor((maxHp-hp)/maxHp*10)`), computed
  before the heal lands. Integer math only.
- `castMod` never reaches the engine — it's resolved into `SpellDef` by
  `buildLoadout`.

### Scene contract (chunk 0 pins, chunks 2/3 consume)

```ts
interface CombatSceneData { encounterId: string; loadout: Loadout; returnTo: string }
```

(Replaces `spellIds`/`bonusMaxMana`. Phase 1's only integration bug was an
unpinned scene-data field — do not let this one drift.)

## Locked decisions (do not reopen; retune numbers freely against gates)

- **Two subclasses** (Vigil, Zealot). No third path. (User-decided 2026-07-09.)
- **poc-spec §6 amended:** the blind pick is retired. Subclass nodes live in
  the tree with full descriptions visible; buying one spends the ruby and
  permanently locks the other (shown greyed/LOCKED, not hidden). No respec.
- **Tree shape** (draft numbers; balance gates + affordability decide final):
  - `deep-reserves` — "Deep Reserves", 5 ranks, 5g/rank, +2 max mana/rank,
    requires nothing (root).
  - `vigil-oath` — "Path of the Vigil", 1 ruby, requires deep-reserves,
    exclusiveGroup 'subclass', grants **Solemn Vigil**
    (heal 9, mana 7, cast 3000ms — slow, efficient).
  - `zealot-oath` — "Path of the Zealot", 1 ruby, requires deep-reserves,
    exclusiveGroup 'subclass', grants **Zealous Flare**
    (heal 3, mana 4, cast 500ms — fast, pricey per point).
  - `vigil-patient-vow` — synergy, 3 ranks, 3g/rank, requires vigil-oath:
    each Solemn Mend arms +1/rank heal on your next Solemn Vigil.
  - `vigil-measured-devotion` — castMod, 1 rank, 4g, requires vigil-oath:
    Solemn Vigil casts 1000ms slower, costs 3 less mana.
  - `zealot-fervent-chain` — synergy, 3 ranks, 3g/rank, requires zealot-oath:
    each Zealous Mending arms +1/rank heal on your next Zealous Flare.
  - `zealot-desperate-zeal` — missingHealthBonus, 1 rank, 4g, requires
    zealot-oath: Zealous Flare heals +1 per 10% of target's missing HP.
- **Visual feedback:** lunge = ~12px toward target, out ~90ms / back ~120ms;
  hit marker = `*` monospace text at victim, rises ~14px, fades ~400ms; heal
  float = `+N` in `#7ad67a`, same motion, N = applied (non-overheal) amount.
  All driven from `CombatEvent`s (`damage` → lunge source + `*` on target;
  `heal` → float). No screen shake, no floating-combat-text framework.
- **Tooltip:** appears on pointerover (no delay), panel above the button:
  name, `Heals N`, `Costs N mana`, `Cast: N.Ns`, plus one line per active
  synergy/mod affecting that spell. Values come from the resolved `Loadout`.
- **Tree rendering:** fixed single-screen layout (no pan/zoom): root
  top-center, Vigil branch left column, Zealot right; edges are 2px lines
  (dim = locked, accent = available, green = owned); multirank nodes show
  `n/5` text; keep the existing dark palette + monospace temp-art style.
- **Balance gates keep their shape** (no-heal wipes, naive overheal wipes,
  full kit clears with ≥3 alive, The Maw unwinnable). New spells/nodes may
  force retunes — tune data, not the gates. Remember the Phase-1 lesson:
  fight length is merc-driven; don't try to separate kits via boss HP.

## Chunk R — pixel-art pipeline (research only)

Question: can we get 8-bit-style unit sprites **without an image model**?
Investigate (a) programmatic generation — e.g. palette-indexed number matrices
in TS rendered to a Phaser texture at runtime (`Graphics`/canvas +
`generateTexture`), sprite-gen libraries, Aseprite/Piskel CLI export; and
(b) a **user-drawn pipeline** — user draws big MS-Paint-style images (macOS
Preview is fine), then a script downscales with nearest-neighbor (`sips` is
built into macOS; ImageMagick `-scale`) to target sizes matching current unit
rects (party 64×64, trash 48×48, boss 110×110 — recommend a native pixel size
like 16×16 rendered with `pixelArt: true`). Deliverable: the research doc with
a tried-it-myself recommendation (a tiny throwaway PoC script is encouraged);
**do not wire sprites into scenes** — that's a future art slice. "Best path is
the user draws, here are exact dimensions + the downscale command" is a fully
successful outcome.

## Non-goals (reject creep, including your own)

Third subclass; respec; Aegis/Wildbloom; procs/major cooldowns; hub buffs;
party hotkeys; real art wired into scenes; audio; damage floaters beyond the
spec'd `*`/`+N`; tree pan/zoom; image-model art generation; networking.

## Document history

| Version | Date | Notes |
|---|---|---|
| v1 | 2026-07-09 | Compiled by /forge-goal from user brief + Q&A (2 subclasses; tree replaces blind pick; effects fully functional) |
