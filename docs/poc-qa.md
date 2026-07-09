# PoC QA — journey checklist & verification

**Date:** 2026-07-08 · **Verdict: PoC complete.** Every poc-spec §1 criterion is
implemented, and all of them are enforced by automated gates that run headless.

## How to run

```bash
cd game
npm install
npm run dev      # → http://localhost:5173
```

Verification gates (all must pass, all deterministic):

| Command | What it proves |
|---|---|
| `npm run check` | typecheck (strict TS) + ESLint + 75 Vitest tests + production build |
| `npm run smoke` | game boots in headless Chromium with zero console errors |
| `node scripts/journey.mjs` | full §1 player journey driven with real clicks/hotkeys in headless Chromium, asserting on the save between stages (~5 min) |

## poc-spec §1 checklist

| # | Criterion | Status | Enforced by |
|---|-----------|--------|-------------|
| 1 | Tutorial: click to learn Solemn Mend | ✅ | journey stage A |
| 2 | Ash Gate → expected wipe → hub with gold + XP | ✅ | journey stage A + `balance.test.ts` (naive healing wipes) |
| 3 | Hub readable on second visit (gold/XP/level/rubies, buttons) | ✅ | journey screenshots |
| 4 | Level ding auto-grants Zealous Mending, no spend UI | ✅ | journey stage A2 + progression tests |
| 5 | Gold spend unlocks one tree node (Deep Reserves) | ✅ | journey stage B + progression tests |
| 6 | Ash Gate clearable → 1 ruby on first clear only | ✅ | `balance.test.ts` (full-kit bot wins) + progression tests (ruby once) |
| 7 | Ruby → blind Vigil/Zealot split; other branch hidden; no respec | ✅ | journey stage B + progression tests |
| 8 | Dungeon 2 (The Maw): overpowered boss, endless sandbox | ✅ | journey stage C + `balance.test.ts` (full-kit bot wipes) |

Also verified: save persists everything across reloads; restart wipes the save
(two-click confirm); wipes bank gold/XP; replays never re-grant the ruby.

## Difficulty shape (balance.test.ts pins these permanently)

Scripted bots run the real engine deterministically:

- **No healing** → wipe. The healer must matter.
- **Naive spam-healing** (overheal freely) on the starting kit → wipe. This is
  the spec's expected first run — wasted mana loses the run (§4.1).
- **Perfect zero-overheal play** on the starting kit → never a comfortable
  clear (wipe, or OOM scrape-through with ≤2 survivors at best).
- **Full PoC kit** (Zealous Mending + Deep Reserves) with disciplined play →
  victory with ≥3 alive, and the Bonehowl telegraph lands during the fight.
- **The Maw** → wipe even with the full kit and perfect play.

## Tuning changes from poc-spec §4.2 drafts (all QA-driven, spec marks them tunable)

| Value | Draft | Tuned | Why |
|---|---|---|---|
| Gate Warden HP | (unspecified) 15 | **55** | at 15 the boss died before the first Bonehowl finished; party won with zero healing |
| Gate Warden auto | 2 | **3** | at 2 the fight never threatened even a heal-less party |
| Bonehowl timing | first 5s / every 15s | **first 3s / every 12s** | telegraph must land 1–2× inside a ~30s boss fight |

## Micro-choices made (poc-spec §10)

1. Level 2 at **10 XP**.
2. Gold tree node: **Deep Reserves** — +5 max mana, 5 gold.
3. Dungeon 2 unlocks **after Ash Gate first clear** (spec's preference).
4. Healer is **never targeted** by enemies in PoC.
5. Cast time is the busy time; GCD 1s runs in parallel (`max(cast, GCD)`),
   one-slot spell queue re-validated when busy ends. Mana spent on cast
   **completion**.
6. Subclass branch nodes (Deep Focus / Battle Fervor) reuse the +5 max mana
   effect with branch flavor — one visible follow-up node each, per §6.
7. The Maw has one light trash wave before the Hollow King so grind attempts
   still pay a little gold/XP (grind-sandbox intent of §7).

## Architecture notes for the next slice

- `game/src/combat/` is pure, deterministic TS (no Phaser) — see its README
  for the engine API; the UI slice can be replaced without touching rules.
- All numbers live in `game/src/data/` as data, guarded by balance tests —
  retune freely; the tests fail if the difficulty shape breaks.
- `scripts/journey.mjs` clicks by scene-layout coordinates; if a scene's
  layout constants change, update the `UI` table at the top of that script.
