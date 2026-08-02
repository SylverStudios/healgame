# Playtest follow-up — secondary HUD, results, dungeon order

Status: planning · Authority: this file wins for the playtest UI + light
balance slice · Last verified: 2026-08-02

Implementation complete on branch `v1/playtest-ui-balance` — checkboxes below
track DoD; retire this handoff on ship-phase closeout after merge.

Systems (player mechanics + enemy trash curriculum) are **shipped on main**.
This handoff covers readability and a small mid-game order/tune pass after
playtesting.

Remote agent entry:
[`v1-playtest-ui-balance-agent-prompt.md`](v1-playtest-ui-balance-agent-prompt.md).

Canvas boards (IDE): `v1-playtest-ui-balance.canvas.tsx` (active),
`v1-player-mechanics.canvas.tsx` (updated to “shipped + follow-ups”).

---

## 1. Mission

Make secondaries and progression **readable in play**, then soften the early
mid-game spike by swapping dungeon 2/3 and easing Cinder Vault toward
**levels 4–5** clears.

**Done means:**

1. Combat shows crit progress on the **healer** and block progress on the
   **tank (guardian)**; floats on proc. No combat chrome for haste/regen.
2. Upgrade picker shows **current → next** numbers for all four secondaries.
3. Results overlay lists **damage done** per party character (+ enemies
   optional — **party only** unless trivial).
4. On level-up, UI shows **HP and mana** gains (per role / character).
5. Dungeon order: Ash Gate → **Cinder Vault** → **Iron Pass** → …; unlock
   graph updated; Cinder eased for ~Lv 4–5; playtest ranges + balance gates
   green.
6. `npm run verify` green; one PR with try-steps.

---

## 2. Locked decisions

| # | Decision |
|---|----------|
| P1 | Crit/block stay **deterministic every-N** (already shipped). Do not reintroduce RNG. |
| P2 | Crit UI: status on healer showing casts remaining until next crit; on crit, floating crit icon (and keep/enhance crit float number if easy). |
| P3 | Block UI: same pattern on **tank** — progress toward next block-1 (damage remaining until threshold); on block, floating block icon. |
| P4 | Haste: **no** extra combat UI (cast bar already reflects castMs). |
| P5 | Mana regen: **no** combat UI. |
| P6 | Upgrade modal: show current value and next-if-selected for block N, crit N, haste ‰ (or %), mana regen amount/interval. |
| P7 | Results: **damage done only** (per character). No heal/mana columns this slice. |
| P8 | Level-up display: show increased **health and mana** for each character/role when a level is gained from the fight. |
| P9 | Swap slots 2↔3: `cinder-vault` order 2 (unlock: ash-gate); `iron-pass` order 3 (unlock: cinder-vault); Verdant+ unlock from the new prior dungeon (`iron-pass`). |
| P10 | Ease Cinder further if needed so headless/playtest targets **god≈4, basic≈5** (or as close as practical without breaking Ash/Iron gates). Use `npm run content -- playtest` + balance bots. |

---

## 3. Current hooks (reuse)

| Area | Path | Note |
|------|------|------|
| Rank → numbers | `game/src/data/secondaryStats.ts` | `blockThreshold`, `critThreshold`, `hastePermille`, `manaRegenFromRank` |
| Upgrade UI | `game/src/ui/upgradePickModal.ts` | Labels only today — add current/next |
| Crit/block events | `heal`/`damage` with `crit?` / `blocked?` | Unused by CombatScene presentation |
| Carry state | private on engine | **Expose** progress on `CombatState` for HUD (e.g. casts until crit, dmg until block) |
| Healer cues pattern | `game/src/ui/healerCues.ts` | Extend or sibling `secondaryCues.ts` |
| Results | `CombatResult`, `ui/resultPanel.ts`, `ui/runSummary.ts` | Extend with damage tallies |
| Level HP/mana | `PARTY_LEVEL_HP`, `LEVEL_MANA`, `levelHp.ts`, `levelMana.ts` | Deltas = one level step of bonuses |
| Dungeon order | `game/src/data/dungeons/index.ts` + per-dungeon `unlock` / `order` | Also content pins, Hub, playtest ranges |

---

## 4. Spec notes

### 4.1 Combat secondary HUD

**Expose on `CombatState` (or equivalent read API)** something like:

```ts
secondaries?: {
  crit?: { n: number; carry: number };   // remaining = n - carry (when n set)
  block?: { n: number; carry: number };  // tank only
}
```

UI:

- Healer: badge/chip “Crit in X” (X = casts remaining); hide if crit rank 0.
- Tank: badge/chip “Block in Y” (Y = damage until next block-1); hide if block rank 0.
- On `heal`/`damage` with `crit: true` → floating crit icon above healer (or over number).
- On `damage` with `blocked > 0` → floating block icon above tank.

Presentation: temp-art OK (text/icon rect); match existing cue depth/palette. No new PixelLab assets required unless trivial reuse of spell icons.

### 4.2 Upgrade picker numbers

Pass `save.secondaryRanks` into `buildUpgradePickModal`. For each card:

| Stat | Current | Next (rank+1) |
|------|---------|----------------|
| block | `Every N` or Off | `Every N'` |
| crit | `Every N` or Off | `Every N'` |
| haste | `H%` (from permille) | `H'%` |
| manaRegen | `+A / Ts` or Off | next amount |

Fix copy if it still says “hits” for block — it is **damage points**, not hit count.

### 4.3 Results — damage done

- Engine accumulates damage dealt per unit id (player healer + mercs; optionally boss/trash — **minimum = party roles**).
- Extend `CombatResult` (or parallel summary built in CombatScene) with
  `{ unitId, name/role, damageDealt }[]`.
- Render a compact list on the result overlay under XP/score.
- Save bump only if `CombatResult` persistence requires it (likely not —
  result is ephemeral). If SaveData changes, use rotate-save-version skill.

### 4.4 Level-up HP/mana display

When `levelForXp` increases from the fight:

- Compute delta for the levels gained: HP via `PARTY_LEVEL_HP` per role ×
  levels gained; mana via `LEVEL_MANA.poolPerLevel` × levels (healer pool) and
  note regen rank changes if a regen threshold was crossed.
- Show on result overlay and/or Hub level-up notice — **at least one clear
  surface** the player sees immediately after the fight. Prefer result overlay
  if they leveled from that combat; Hub welcome can repeat briefly.

Per character = tank / dps1 / dps2 / healer (use party display names already in
UI).

### 4.5 Dungeon swap + Cinder ease

Target order:

```
ash-gate → cinder-vault → iron-pass → verdant-rift → …
```

Updates required:

- `DUNGEON_ORDER` and each dungeon’s `order` + `unlock`
- `content.test.ts` legacy pins / order expectations
- Floor autos will shift (± `FLOOR_ENEMY_DAMAGE`) — expected
- Ease Cinder authored numbers (boss HP / ability / trash) so playtest lands
  near **Lv 4–5**; set `playtestLevelRange` accordingly after
  `npm run content -- playtest`
- Re-pin `balance.test.ts` Iron/Cinder sections; journey if copy assumes order
- Hub dungeon button order follows `ORDERED_DUNGEONS` automatically

---

## 5. Work chunks

| id | Owner | What |
|----|-------|------|
| U0 | central | Read bible; branch already `v1/playtest-ui-balance` |
| U1 | subagent | Expose crit/block progress on CombatState + unit tests |
| U2 | subagent | Combat HUD countdown + float icons (healer/tank) |
| U3 | subagent | Upgrade modal current→next numbers |
| U4 | subagent | Engine damage tallies + results overlay list |
| U5 | subagent | Level-up HP/mana delta display |
| U6 | subagent | Swap dungeon 2↔3, unlock graph, content pins |
| U7 | subagent | Ease Cinder + playtest bake + balance gate retune |
| U8 | central | Integration, verify, CHANGELOG/poc-qa, open PR |

U6/U7 sequential (order then tune). U1→U2 sequential. U3–U5 can follow U1
or parallel if ownership is clean.

---

## 6. Non-goals

- Rebalancing all secondaries magnitudes globally
- Heal/mana contribution columns on results
- Gear-slot upgrade fantasy UI
- New enemy kinds / interrupt
- Full polish/juice pass beyond these floats/countdowns

---

## 7. Definition of done

- [x] Crit/block combat readability live when ranks > 0
- [x] Upgrade picker shows current→next for all four
- [x] Results show damage done per party character
- [x] Level-up shows HP + mana increases
- [x] Order Ash→Cinder→Iron; Cinder ~Lv 4–5; gates green
- [x] `npm run verify` green; PR with try-steps
