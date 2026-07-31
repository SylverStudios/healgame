# Changelog — healgame

Status: current · Authority: shipped-history summary (details in poc-qa) · Last verified: 2026-07-31

Newest first. Numbers and rule detail live in `game/src/data/` and
[`poc-qa.md`](./poc-qa.md) — this file is the short ship log.

---

## 2026-07-31 — Road to 1.0: Player mechanics (cards default)

Cards is the real progression path; lattice/radial remain dual-shipped.

- **Save v12** — default `progressionMode: 'cards'`; `secondaryRanks`,
  `chosenCooldownIds`, `pendingUpgradePicks`.
- **Loadout** — cards Hub shows Spellbook (`hubLoadout`) beside Spells album.
- **Modifiers** — significant-only chip offers (flat power bumps parked).
- **Upgrades** — every level-up pick 1 of block / crit / haste / manaRegen;
  ranks apply in combat (tank block every-N, crit via injected rng, haste =
  castMs only, manaRegen merge).
- **Cooldown choice** — L6 Set A (Still / Wrath / Liturgy); L8 Set B
  (`iron-canticle` / `mercy-reserve` / `ashen-rite`); no auto-grant of all
  three legacy majors.
- Stub magnitudes — Balance retunes later.

Handoff (until closeout): [`v1-mechanics-handoff.md`](./v1-mechanics-handoff.md).

---

## 2026-07-31 — Catalogue (spell cards content review)

- **Settings → Catalogue** — scrollable Spells / Chips tabs listing every
  cards-mode unlock and authored chip (ids, stats, descriptions, effect
  lines). Shows spell/CD icons when shipped, plus icon art prompts from
  `data/cards/iconPrompts.ts` when authored.
- Journey names: `settingsCatalogue`, `catalogueTabSpells` /
  `catalogueTabChips`, `catalogueBack`.

---

## 2026-07-30 — PoC: Spell-card upgrade mode (dual-ship)

Third progression mode beside lattice + radial for friend A/B testing.

- **Save v10** — `progressionMode: 'cards'`; `upgradePoints` + `spellChips` on
  all modes; purges v9+.
- **Settings** — Classic | Radial | **Spell cards**; confirm → wipe → Tutorial.
- **Cards loop** — free level unlocks (Heal/Bonk → Mend at Lv2 with first
  upgrade point → Vowstrike → 3 major CDs); spend points on **fixed 3-way
  chip sets** per slot (no RNG); resolve into existing `CombatMods` hooks
  via `loadoutFromCardSave`. Level 1 starts with 0 points.
- **No relics** in cards — first-clear grants +1 upgrade point; Hub single
  **Spells** entry (`hubTree` → `CardAlbumScene`).
- **Journey** — Stage Cards: Settings → album chip draft → Ash Gate.

Handoff (until closeout): [`spell-cards-poc-handoff.md`](./spell-cards-poc-handoff.md).
Feel reference: [`relic-revamp-brainstorm.md`](./relic-revamp-brainstorm.md).

---

## 2026-07-30 — Ash husk tight 32×32 + healer density exemplar

- **Density law** — armored-paladin healer pinned as the exemplar in
  `art/STYLE.md`, CLAUDE/AGENTS, and pixellab skills (J18).
- **Ash husk** — regenerated to tight 32×32 west at healer grain (display 64);
  attack + hurt strips wired; saved prompts in `art/source/ash-husk/PROMPT.md`
  (J17).

---

## 2026-07-29 — Wave 5: Radial talent tree dual-ship

Lattice and radial progression side-by-side for friend A/B testing.

- **Save v9** — `progressionMode: 'lattice' | 'radial'` (default lattice); purges v8+.
- **Settings** — Talent tree Classic | Radial; confirm → wipe save → Tutorial restart.
- **Facade** — `loadoutForSave` / `ownedSpellsForSave`; combat still only sees `CombatMods`.
- **Radial kit** — Heal + Bonk starters; Ring 1–3 wheel (`RadialTreeScene`); A/B specialize modal; offense XOR; Blessed Bonk stacks; Mana Bonk / Battle Mend mana hooks.
- **Journey** — lattice path unchanged; focused radial smoke (Mend → Heal specialize).

---

## 2026-07-20 — UI theming: FE-GBA presentation pass

Presentation only — no engine, layout-constant, or gameplay-data changes;
journey required zero coordinate/name edits across the whole phase.

- **Pixel font**: game-wide `HealgameIron` 16px-glyph PixelLab font replaces
  system monospace (digits still fall back to monospace; combat log stays
  monospace by design).
- **Combat battlefield**: layered backdrop (code sky gradient + PixelLab
  structure props) + FE-style perspective platform slices under the
  party/enemy lines, replacing the flat black void + 2px ground line. All 6
  dungeons have a distinct variant (Ash Gate original; the other 5 are
  `create_object_state` recolors), resolved per-encounter via
  `battlefieldForEncounter()`.
- **Spell-bar chrome**: framed spell/cooldown buttons, keycap chips, cast-bar
  frame, and real 16×16 icons for all 7 spells + 3 major cooldowns
  (glyph-char fallback preserved for anything unmapped).
- **Shared panel kit**: Hub, Tutorial, Loadout, Relic, Settings, and the
  combat result overlay now share one nine-slice panel/button/banner
  language (`ui/panels.ts`) instead of flat rects.
- **Party portraits**: FE-style bust portraits beside banter bubbles, on the
  tutorial screen, and on the result panel (victory=healer, wipe=tank).
- **Scene transitions**: every scene change fades; entering combat plays a
  chunky blocky "into battle" reveal instead of a hard cut.
- **Talent tree**: node circles become framed sockets (locked / affordable /
  owned / armed / exclusive-locked); edges become a tinted groove-strip
  texture per `EdgeState`, keeping the locked dead-branch break+X cue.
- **Title wordmark**: Tutorial's and Hub's titles get a gold accent + shadow
  treatment instead of reading as plain body text.

## 2026-07-19 — Gloam Sanctum (Dungeon 6)

- **New dungeon** between Black Choir and The Maw: denser trash + Null Psalm
  (earlier/tighter mana siphon than Soul Toll).
- Full Patient / Fervent crown kits clear; shallow crown kits that still clear
  Black Choir wipe — wants more path depth before The Maw.
- The Maw is now Dungeon 7; unlocks after Gloam Sanctum.

## 2026-07-19 — Post-v0.3 playtest: harder mid bosses, stock music, unit art

- **Mid/late bosses harder**: Spire Lancer HP 340 + denser Tunnel Vision;
  Ember / Matriarch / Dirge HP bumps; Ash Gate left alone.
- **XP curb**: Iron Pass / Cinder Vault back to 1 XP/kill; Verdant / Choir 2;
  Maw 3 — stops the mid-ladder double-level snowball.
- **Music**: replaced the piercing placeholder loop with a soft stock ambient
  (`stock-ambient-loop.wav`).
- **Unit art**: PixelLab tank + ash-husk stills wired via dual-path
  presentation; Kenney units rescaled down so padded custom art matches.

## 2026-07-18 — v0.3 "Presence, Lattice, Grace"

- **Coyote-time heals**: lethal damage downs a party member into a 250ms
  `dying` grace window (still healable, takes no further damage, read as dead
  by attackers); a heal completing in the window saves them, and in-flight
  casts are no longer cancelled just because the target dropped. Death
  visuals wait for true death.
- **Lattice talent tree**: grid-coordinate topology (root at the left edge,
  Vigil string up, Zealot string down, shared spine converging to the
  vowstrike fork), level-gated crowns (Wrath Ascendant Lv 10, Vowbound Crown
  Lv 12), four-state edge rendering with the traversed path lit bright, and
  a deterministic **build glyph** of the lit path.
- **Run summary**: wipe/victory now transitions into a summary panel
  (outcome, run XP, build glyph); the last 5 runs persist on the save
  (`recentRuns`) with a last-run display on the Hub.
- **Combat juice**: healer renders from the new ragged-healer sheet with a
  golden cast-pose animation; heal sparkles on targets; tank shove / DPS
  double-jab swing animations; mana-regen tick pulse; data-driven boss
  telegraphs (glow/raise/pulse) replacing the named cast bar as the primary
  tell.
- **Party banter**: speech bubbles — healer on close call (≤25% ally HP,
  once per fight) and victory, tank on wipe; healer lines branch by oath
  (Vigil solemn / Zealot fervent).
- **Music + Settings**: looped background track (placeholder pending the
  real score) with a Settings scene volume slider; 0% fully stops playback.
  Save v8 (`musicVolumePct`, `recentRuns`).
- **Smarter balance bot**: deliberate cooldown timing, overheal-aware triage,
  Tunnel Vision stabilization, coyote-save queuing — all pinned difficulty
  gates unchanged (The Maw still unwinnable).

## 2026-07-17 — Feedback opens Gmail in-browser

- Hub **✨ Send Aaron feedback** opens Gmail compose in a new tab (was
  `mailto:`, which launched the OS mail app). Telemetry JSON still copied to
  clipboard.

## 2026-07-17 — Iron Pass harder + tiered XP

- Spire Lancer: HP 245→295; Tunnel Vision every 25s (was 30s). Level-3 kits
  with DPS relics wipe or pyrrhic; level 4 + relic clears; maxed crowns still
  clear (≥3 alive). Ash Gate / Gate Warden unchanged.
- `xpPerEnemy` scales by dungeon: Ash Gate 1, Iron Pass / Cinder Vault 2,
  Verdant Rift / Black Choir 3, The Maw 4 — so later kills fund the rising
  level curve instead of flat 1 XP forever.

## 2026-07-17 — Playtest telemetry + feedback mailto

- Local balance log (`healgame-telemetry-v1`): per-dungeon runs with level,
  talents, action bar, relics, spell/CD press counts (key vs click), timestamps,
  playtime, and wipe-save reset count. Survives Restart (separate from save).
- Hub: **✨ Send Aaron feedback** (bottom-left; mailto with write space + telemetry
  summary/JSON on clipboard). Restart (bottom-right) asks to send first when a
  log exists. Glance CLI: `npm run telemetry -- path/to.json`.

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
