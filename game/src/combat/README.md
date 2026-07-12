# Combat engine (Chunk 1)

Status: current · Authority: combat engine API + rule decisions · Last verified: 2026-07-10

Pure, deterministic TypeScript. No Phaser, no wall-clock, no randomness — driven
entirely by `advance(dtMs)`. Chunk 2 builds the Phaser view against exactly
this surface (`engine.ts` + `types.ts`).

```ts
new CombatEngine(encounter: EncounterDef, spells: SpellDef[], options?: {
  bonusMaxMana?: number;
  synergies?: { triggerSpellId: string; buffedSpellId: string; bonusHeal: number }[];
  missingHealthBonuses?: { spellId: string; healPer10PctMissing: number }[];
  missingHealthPctBonuses?: { spellId: string; pctPer10PctMissing: number }[];
  fullHealthBonuses?: { spellId: string; hpPctAtLeast: number; bonusHeal: number }[];
})
// spells = player's unlocked list; options come from loadoutFromSave / CombatMods
// (bonusMaxMana, synergies, missing-health/full-health heal rules). castMod is
// already baked into spell defs by resolveCombatMods — the engine never sees it.
// Omit options for the pre-tree default (no bonus of any kind) — fully backward
// compatible.
engine.advance(dtMs): CombatEvent[]   // steps the sim; safe for any dt (sub-steps internally)
engine.setTarget(unitId): void        // click-to-target an ally; ignored if unknown/dead/enemy
engine.castSpell(spellId): void       // starts, queues, or is silently dropped — see below
engine.cancelCast(): void             // cancel active cast (+ any queue) and refund reserved mana — see below
engine.state: Readonly<CombatState>
engine.rewards: { gold, xp }          // accrued per kill, immediately, even on a later wipe
```

Data: `data/spells.ts` (`ALL_SPELLS`, sourced from `constants.ts`) and
`data/encounters.ts` (`ASH_GATE`). Enemy HP isn't in poc-spec — it's draft data
in `encounters.ts`, expected to be retuned.

## Rule decisions

- **Busy time** (locked §10.5): `max(castMs, GCD_MS)` from cast start. `gcdRemainingMs`
  and the cast's `remainingMs` tick in parallel from the same start.
- **Queue**: one slot; `castSpell` while busy queues `{spellId, targetId}` (target
  locked in at queue time), replacing any existing queue entry. Re-validated
  (target alive, mana available) the instant busy ends; dropped silently if it's
  gone illegal by then. Illegal commands (unknown spell, no/dead target) never
  enter the queue, busy or not.
- **Mana** (Phase 3 handoff §D — supersedes the old "spent on completion" rule):
  **reserved** (debited) the instant a cast *starts*, not when it completes.
  This blocks double-spending mana on a cast that's still in flight. A cast
  that **completes** does not subtract mana again — it was already spent at
  cast start. A cast that's **cancelled** (Escape, or its target dying
  mid-cast) **refunds** the reserved mana, clamped to `maxMana`. No regen
  otherwise. Because mana is committed at cast start, a queued cast's
  mana-availability re-check (see Queue, above) is evaluated against whatever
  mana remains *after* the currently-casting spell's reservation — exactly the
  balance the player would see on screen.
- **Cast cancel** (Phase 3 handoff §D): `engine.cancelCast()` cancels the
  active cast (if any) — refunding its reserved mana, clearing `playerCast`
  **and** any queued cast, and emitting `castCancelled` with `reason:
  'escape'`. If only a queue entry exists (no active cast), it's cleared
  silently: no refund (nothing was ever reserved for a cast that never
  started) and no event. No-op if nothing is active or queued, or combat has
  ended. Like `castSpell`, `cancelCast` mutates immediately but its event is
  buffered and delivered on the next `advance()`.
  - **The GCD keeps running across a cancel.** `cancelCast` does not reset
    `gcdRemainingMs` — it only clears the cast/queue. A cast that's cancelled
    a moment after starting still leaves the healer busy for the remainder of
    that GCD window, exactly as if the cast had completed. This mirrors most
    action-combat conventions (cancelling doesn't refund tempo, only mana) and
    keeps the busy-time invariant (`max(castMs, GCD_MS)` from cast start)
    simple — cancellation shortens the *cast*, never the *GCD*.
  - **Mid-cast target death**: if the active cast's target dies (from a merc
    swing, an enemy/boss auto-attack, or Bonehowl/Extinction party damage),
    the cast is auto-cancelled the instant that death is applied — same tick,
    immediately after the `unitDied` event that caused it. `reason:
    'target-dead'`. The cast never reaches `completePlayerCast`: no
    `castFinished`, no heal, and (per Synergy below) no arm/consume. This
    supersedes the old Phase 1/2 rule ("target died mid-cast still completes
    and arms") — the old rule assumed mana was spent up front and undoing a
    completed cast was worse than letting it resolve into nothing; reserve
    semantics make a clean cancel possible instead.
- **Overheal**: `heal` event's `amount` (applied) + `overheal` (wasted) always
  equals the spell's raw `heal`.
- **Targeting** (locked §10.4): enemies/boss attack the tank while alive, then a
  living DPS, then the healer. Mercs auto-attack the first living enemy in spawn
  order and don't pause across a wave transition — a new wave's first enemy can
  take damage in the tick it spawns.
- **Swing intervals** (Phase 3 handoff §B — supersedes the old uniform 3s merc
  cadence): each auto-attacker counts down on its own interval, no phase
  offsets. Tank and DPS mercs differ (`MERCS.tankSwingIntervalMs` /
  `dpsSwingIntervalMs` in `data/constants.ts`); the two DPS mercs share the
  same interval and so swing in sync with each other, but not with the tank.
  Trash (`TRASH.swingIntervalMs`) and each encounter's boss
  (`BossDef.swingIntervalMs`, e.g. `GATE_WARDEN`/`HOLLOW_KING`) each have their
  own interval too, deliberately desynced from the trash cadence so
  simultaneous full-party swing ticks are rare. `swingTimers` is seeded from
  the unit's role/encounter interval at spawn and reset to that same interval
  after every swing.
- **Boss cast union** (Alpha 0.1 §D3): `BossDef.cast` is a discriminated union,
  `BossCastDef = PartyAoECastDef | TunnelVisionCastDef`. `kind` is optional on
  `PartyAoECastDef` (defaults to that arm) so every pre-existing encounter
  (Ash Gate's Bonehowl, The Maw's Extinction) keeps compiling and behaving
  identically without setting `kind` at all — only `TunnelVisionCastDef`
  requires `kind: 'tunnelVision'`.
- **Bonehowl / Extinction (`partyAoE`)**: `firstCastAtMs`/`intervalMs` are
  start-to-start; the gap before each subsequent cast is `intervalMs - castMs`.
  The boss keeps auto-attacking while casting (not a channel).
- **Tunnel Vision (`tunnelVision`)** — telegraph, then a single-target channel:
  - **Telegraph**: on activation, `state.bossCast` is set with
    `totalMs = telegraphMs` (same `BossCastState` the cast bar already
    renders), and `bossCastStarted` fires exactly as for a `partyAoE` cast.
    The boss keeps auto-attacking the tank throughout — same "not a full
    interrupt" rule as Bonehowl — during **both** the telegraph and the
    channel that follows.
  - **Telegraph → channel**: when the telegraph completes, `bossCastFinished`
    fires, `bossCast` clears (the channel is represented by focus events, not
    the cast bar), a focus target is picked (see rotation below), and
    `bossFocusStarted { targetId, name, totalMs: channelMs }` fires.
  - **Channel ticks**: every `tickMs` (for `channelMs / tickMs` ticks total),
    `damagePerTick` is applied to the focus target through the *same* damage
    pipeline as any other hit — the normal `damage` event, `unitDied` +
    wipe-check on death — then `bossFocusTick { targetId, amount }` fires
    *after* that `damage` event.
  - **Channel end**: `bossFocusEnded { targetId, name }` fires either after
    the final tick, or immediately if the focus target dies mid-channel (early
    end, **no retarget** — the channel just stops).
  - **Cadence (start-to-start, same semantics as `partyAoE`)**:
    `firstCastAtMs`/`intervalMs` measure telegraph-start-to-telegraph-start.
    The interval timer is reset the instant a telegraph starts (not when the
    channel ends), so it keeps running underneath the whole telegraph+channel
    occupancy. Defensive rule: a new telegraph can never start while a channel
    is active — if the interval elapses first, it just waits and fires the
    instant the channel ends (the next boundary after it ends).
  - **Deterministic target rotation (no `Math.random`, ever)**: eligible =
    living party members with `role !== 'tank'`, sorted by stable unit `id`;
    pick `eligible[focusIndex % eligible.length]`, then increment
    `focusIndex` once per activation. `focusIndex` starts at 0 and lives in
    engine state for the fight's lifetime — a unit that dies is simply
    excluded from `eligible` on the next activation without resetting or
    skipping the cursor (e.g. with `[dps1, dps2, healer]` and `dps1` dead,
    `focusIndex` continuing at 1 lands on `healer`, not `dps2`).
- **Synergy and heal-formula bonuses** (Chunk 1, phase-2-handoff; extended
  Alpha 0.1 §D4): all are resolved into the existing `heal` event — no new
  event types. A cast's raw heal value is `spell.heal + synergyBonuses +
  missingHealthBonuses + missingHealthPctBonuses + fullHealthBonuses` (all
  additive on the same completed cast); the overheal split
  (`amount + overheal === raw`) works exactly as before.
  - **Synergy**: a *completed* cast of `triggerSpellId` arms that rule
    (re-arming replaces — it's a boolean flag, never a stacking counter). The
    next *completed* cast of `buffedSpellId` consumes it, adding `bonusHeal`.
    Multiple synergy entries are tracked independently; a matching buffed
    cast consumes and sums **all** currently-armed entries. A spell that is
    both a trigger and a buffed target (not in current data, but pinned):
    **consume-then-arm** on the same completion — it consumes any bonus
    already armed for itself first, then arms fresh for the next cast. A cast
    never reaches this arm/consume logic at all if its target died mid-cast —
    it was auto-cancelled instead (see Cast cancel, above), so neither
    arming nor consuming happens for a cancelled cast. This supersedes the
    old Phase 1/2 rule where a dead-target cast still completed and still
    armed (mana was spent up front back then, so letting the cast resolve
    into nothing was the least-bad option; reserve semantics make a clean
    cancel possible instead).
  - **`armedBuffedSpellIds`** (Phase 3 handoff §E): `CombatState` exposes the
    de-duplicated list of spell ids currently buffed by at least one armed
    synergy entry (`state.armedBuffedSpellIds`), recomputed on every `state`
    read from the synergies' live `armed` flags. Drives the spell-bar's armed
    border in the UI — no new event type; missing-health bonuses are not
    represented here (they're not an "armed" toggle state).
  - **Missing-health (flat)**: on a completed cast of a matching `spellId`, adds
    `healPer10PctMissing * floor((target.maxHp - target.hp) * 10 / target.maxHp)`
    — the target's HP is read **before** this heal lands (same moment the
    overheal split is computed from). Integer math only. Multiple matching
    entries sum. A dead target produces no heal event, so no bonus either.
  - **Missing-health (pct of base heal)** (Alpha 0.1 §D4, Graven Scale shape —
    `missingHealthPctBonuses`): same pre-heal banding as the flat rule
    (`bands = floor((maxHp - hp) * 10 / maxHp)`), but the bonus is a percent
    of the completing spell's **base printed heal**, rounded **up**:
    `ceil(spell.heal * pctPer10PctMissing * bands / 100)`. Always computed
    from `spell.heal` — never from a synergy-buffed total, so arming order
    can't change the pct bonus. At full HP, bands = 0 → bonus 0. Multiple
    matching entries each ceil independently, then sum (mirrors the flat
    rule's duplicate handling). Pure integer inputs; `Math.ceil` on the one
    division keeps outputs integer.
  - **Full-health bonus** (Alpha 0.1 §D4, Steady Hands shape —
    `fullHealthBonuses`): on a completed cast of a matching `spellId`, adds
    `bonusHeal` when the target's **pre-heal** HP is at least `hpPctAtLeast`
    percent of maxHp — checked as `target.hp * 100 >= hpPctAtLeast * target.maxHp`
    (integer-safe, no floats), **inclusive** at the threshold. A full-HP
    target qualifies: the bonus applies even when the whole heal overheals
    (the existing `overheal` field carries it). Multiple matching entries sum.
    Note ≥80% implies ≤2 missing-health bands, so in practice this rule and
    big pct-bonus payoffs are near-mutually exclusive — but both are computed
    independently and can land on the same heal (e.g. an 85% target: bands = 1
    pct bonus + the full-health bonus).
  - All bonus kinds stack additively on the same cast. `castMod` never reaches
    the engine — `resolveCombatMods` / `loadoutFromSave` already bake it into
    `SpellDef.castMs`/`mana` before spells are handed to the constructor.
- **Waves/victory/wipe**: a wave clears (and the next spawns) the instant its
  last enemy dies; victory on boss hp 0; wipe the instant all 4 party members
  are dead. `advance()` is a no-op once `status !== 'running'`.
- **Rewards**: credited instantly per kill (trash and boss both count),
  regardless of a later wipe.

## Determinism

Simultaneous events resolve in a fixed priority each tick: player cast completes
→ queued cast fires → boss cast completes (`partyAoE` party damage, or a
`tunnelVision` telegraph finishing into a channel) → boss focus tick
(`tunnelVision` channel damage, if one landed this tick) → merc autos (tank,
dps1, dps2) → enemy/boss autos (spawn order) → boss cast timer starts a new
telegraph/cast (blocked while a `tunnelVision` channel is active). `advance()`
sub-steps to the next timer boundary, so the event log for a given command
sequence is independent of how the caller chunks `dtMs`. Commands issued between
`advance()` calls (`castSpell` may emit `castStarted`; `cancelCast` may emit
`castCancelled`) are buffered and flushed at the start of the next `advance()`.
