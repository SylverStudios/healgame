# Combat engine (Chunk 1)

Pure, deterministic TypeScript. No Phaser, no wall-clock, no randomness — driven
entirely by `advance(dtMs)`. Chunk 2 builds the Phaser view against exactly
this surface (`engine.ts` + `types.ts`).

```ts
new CombatEngine(encounter: EncounterDef, spells: SpellDef[]) // spells = player's unlocked list
engine.advance(dtMs): CombatEvent[]   // steps the sim; safe for any dt (sub-steps internally)
engine.setTarget(unitId): void        // click-to-target an ally; ignored if unknown/dead/enemy
engine.castSpell(spellId): void       // starts, queues, or is silently dropped — see below
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
- **Mana**: spent when a cast *completes*, not when it starts (simplest; poc-spec
  doesn't specify). No regen. A dead cast target still consumes mana but emits no
  `heal` event.
- **Overheal**: `heal` event's `amount` (applied) + `overheal` (wasted) always
  equals the spell's raw `heal`.
- **Targeting** (locked §10.4): enemies/boss attack the tank while alive, then a
  living DPS, then the healer. Mercs auto-attack the first living enemy in spawn
  order on independent 3s timers and don't pause across a wave transition — a
  new wave's first enemy can take damage in the tick it spawns.
- **Bonehowl**: `firstCastAtMs`/`intervalMs` are start-to-start; the gap before
  each subsequent cast is `intervalMs - castMs`. The boss keeps auto-attacking
  while casting (not a channel).
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
`advance()` calls (`castSpell` may emit `castStarted`) are buffered and flushed
at the start of the next `advance()`.
