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
})
// spells = player's unlocked list; options come from loadoutFromSave / CombatMods
// (bonusMaxMana, synergies, missingHealthBonuses). castMod is already baked into
// spell defs by resolveCombatMods — the engine never sees it. Omit options for
// the pre-tree default (no bonus of any kind) — fully backward compatible.
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
- **Bonehowl**: `firstCastAtMs`/`intervalMs` are start-to-start; the gap before
  each subsequent cast is `intervalMs - castMs`. The boss keeps auto-attacking
  while casting (not a channel).
- **Synergy and missing-health bonuses** (Chunk 1, phase-2-handoff): both are
  resolved into the existing `heal` event — no new event types. A cast's raw
  heal value is `spell.heal + synergyBonuses + missingHealthBonuses`; the
  overheal split (`amount + overheal === raw`) works exactly as before.
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
  - **Missing-health**: on a completed cast of a matching `spellId`, adds
    `healPer10PctMissing * floor((target.maxHp - target.hp) * 10 / target.maxHp)`
    — the target's HP is read **before** this heal lands (same moment the
    overheal split is computed from). Integer math only. Multiple matching
    entries sum. A dead target produces no heal event, so no bonus either.
  - Both kinds stack additively on the same cast. `castMod` never reaches the
    engine — `resolveCombatMods` / `loadoutFromSave` already bake it into
    `SpellDef.castMs`/`mana` before spells are handed to the constructor.
- **Waves/victory/wipe**: a wave clears (and the next spawns) the instant its
  last enemy dies; victory on boss hp 0; wipe the instant all 4 party members
  are dead. `advance()` is a no-op once `status !== 'running'`.
- **Rewards**: credited instantly per kill (trash and boss both count),
  regardless of a later wipe.

## Determinism

Simultaneous events resolve in a fixed priority each tick: player cast completes
→ queued cast fires → boss cast completes → merc autos (tank, dps1, dps2) →
enemy/boss autos (spawn order) → boss cast timer starts a new cast. `advance()`
sub-steps to the next timer boundary, so the event log for a given command
sequence is independent of how the caller chunks `dtMs`. Commands issued between
`advance()` calls (`castSpell` may emit `castStarted`; `cancelCast` may emit
`castCancelled`) are buffered and flushed at the start of the next `advance()`.
