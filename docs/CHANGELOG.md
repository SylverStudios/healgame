# Changelog — healgame

Status: current · Authority: shipped-history summary (details in poc-qa) · Last verified: 2026-07-17

Newest first. Numbers and rule detail live in `game/src/data/` and
[`poc-qa.md`](./poc-qa.md) — this file is the short ship log.

---

## 2026-07-17 — Mid-boss pressure (Emberfall / Matriarch / Dirge)

- Emberfall DoT ticks harder (2/tick, 3s window) so the burn can’t be ignored.
- Thorn Matriarch autos harder; Needle Gaze comes a bit earlier/more often.
- Dirge / Black Choir: more HP + heavier Soul Toll mana burn — mid-tree wipes;
  crown kits still clear (tree-depth gate).
- Ash Gate / Gate Warden left alone.
- Relic glyphs: grey defense, red offense, green healing.
- Tree tooltips show rank capacity `(owned/max)` instead of redundant `1 point`.
- Graven Scale laid out as a left dead-end spur (no longer on the vow→thrift line).
- Combat: Tab cycles party heal targets (skips dead, wraps).

## 2026-07-16 — Playtest polish

- Juicier basic heals (soft shake, brighter floats, ripple, particles).
- Mana-spend aura on the healer (presentation-only).
- Round glyph tree nodes; name/cost/desc on hover only.
- Hub: vertical dungeon list with CURRENT challenge marker.

## 2026-07-16 — Bonk + QWER loadout (save v7)

- Starter damage spell **Bonk** on Q; Solemn Mend taught onto W in tutorial.
- Spellbook / loadout scene: assign owned spells to QWER slots (`actionBar`).
- Save key `healgame-save-v7`; purges v6/v5/v1; no migration.

## 2026-07-15 — Alpha 0.2 Oathbound Depth

- Level grants max mana + combat mana regen; relics stack; no player HoTs.
- Tree hourglass: shared → oath → mid → Virtue/Vengeance Vowstrike → crown.
- Instant Vowstrikes; Wrath Ascendant heal-bonus CD; Vowbound crown amp.
- Placeholder glyphs on tree + combat buttons; QWER + Shift hotkeys (max 8).
- Black Choir clearable with crown kits; The Maw still unwinnable.
- Save v6 at phase ship (superseded by v7 above).

## 2026-07-15 — Mid-tier dungeons + content DX

- Cinder Vault, Verdant Rift, Black Choir on the ladder.
- Typed dungeon/mob/ability catalogs; `npm run content` validate/preview/balance.

## 2026-07-14 — XP, talent points, stat relics

- Currency consolidation around XP + talent points.
- Stat relics as permanent run modifiers.

## 2026-07-13 — Alpha 0.1

- Mid dungeon **Iron Pass** between Ash Gate and The Maw.
- Tree layer 2; first major cooldowns (Still Waters, Frenzied Liturgy).
- Relic pick after first Ash Gate clear (1 of 3).
- Semantic journey targets (`setName` + `__healgame.locate`); run-mods top bar.

## 2026-07-12 — Playtest retune

- Mana feel, spell affordance, currency role copy on hub.

## 2026-07-11 — Combat juice + side-view + Phase 3 UX

- Side-view facing line (party left / enemies right).
- Numeric floats, cast cancel, armed synergy border, role swing cadences, combat log.
- Screenshake / halo / keycaps; forsaken-path Warped Tempo.

## 2026-07-09 — Phase 2

- Combat feedback (lunge/floats), spell tooltips.
- Node-graph talent tree; in-tree Vigil/Zealot oaths (SubclassScene removed).
- Kenney Tiny Dungeon unit tiles.

## 2026-07-08 — PoC (Phase 1)

- Pure combat engine + Phaser scenes + local save.
- Tutorial → Ash Gate → hub → XP skill + gold tree → ruby oath → Maw sandbox.
- Balance bots pin difficulty shape; journey e2e green.

### PoC pillars proved

| Pillar | Shipped as |
|--------|------------|
| Utility | Healer kit + tree perks + oath branch |
| Controls | Click/hotkey cast, hub, tree buy, pace, Escape cancel |
| Tiles | Side-view line, Kenney units, temp chrome |
| Progression | Wipe/clear banks rewards → tree → oath → dungeon unlock |

---

## Still out (unless a future planning handoff reopens)

From original poc-spec §9, minus what Alpha reopened (major CDs, mid dungeons,
relics, loadout):

- Procs / floating combo indicators
- Hub permanent buffs
- Party slot hotkeys (1–4 target)
- Aegis / Wildbloom archetypes
- Respec
- Polished final art pipeline
- Boss phases, merc trees, networking
