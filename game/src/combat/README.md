# Combat engine (Chunk 1)

Status: current · Authority: combat engine API + rule decisions · Last verified: 2026-07-18

Pure, deterministic TypeScript. No Phaser, no wall-clock, no randomness — driven
entirely by `advance(dtMs)`. Chunk 2 builds the Phaser view against exactly
this surface (`engine.ts` + `types.ts`).

```ts
new CombatEngine(encounter: EncounterDef, spells: SpellDef[], options?: {
  bonusMaxMana?: number;
  manaRegen?: { amount: number; intervalMs: number }; // Alpha 0.2 — merge w/ relic regen
  synergies?: { triggerSpellId: string; buffedSpellId: string; bonusHeal: number }[];
  missingHealthBonuses?: { spellId: string; healPer10PctMissing: number }[];
  missingHealthPctBonuses?: { spellId: string; pctPer10PctMissing: number }[];
  fullHealthBonuses?: { spellId: string; hpPctAtLeast: number; bonusHeal: number }[];
  cooldowns?: CooldownDef[]; // Alpha 0.1 §D6 / 0.2 healBonus — see "Cooldowns" below
})
// spells = player's unlocked list; options come from loadoutFromSave / CombatMods
// (bonusMaxMana, manaRegen, synergies, missing-health/full-health heal rules).
// castMod is already baked into spell defs by resolveCombatMods — the engine
// never sees it. Omit options for the pre-tree default (no bonus of any kind)
// — fully backward compatible.
engine.advance(dtMs): CombatEvent[]   // steps the sim; safe for any dt (sub-steps internally)
engine.setTarget(unitId): void        // click-to-target an ally; ignored if unknown/dead/enemy
engine.castSpell(spellId): void       // starts, queues, or is silently dropped — see below
engine.cancelCast(): void             // cancel active cast (+ any queue) and refund reserved mana — see below
engine.activateCooldown(cooldownId): void // off-GCD; see "Cooldowns" below
engine.state: Readonly<CombatState>
engine.rewards: { xp }                // accrued per kill, immediately, even on a later wipe
```

Data: `data/spells.ts` (`ALL_SPELLS`, sourced from `constants.ts`) and the
typed catalogs documented in `data/README.md`. `data/encounters.ts` validates
and compiles the ordered dungeon catalog into the engine's resolved
`EncounterDef` input. The engine never performs authoring-catalog lookups.

## Rule decisions

- **Busy time** (locked §10.5): `max(castMs, GCD_MS)` from cast start. `gcdRemainingMs`
  and the cast's `remainingMs` tick in parallel from the same start.
- **Instant cast** (Alpha 0.2 §D4): `SpellDef.castMs === 0` completes inside
  `beginCast` on the same call stack (no cast-bar occupancy / no 0ms
  `remainingMs` stuck in `nextTimerBoundary`). Mana is still reserved at start;
  GCD still applies; synergy arm/consume and heal bonuses still run through
  `completePlayerCast` for heals. UI must hide the cast bar when `totalMs === 0`.
- **Damage spells** (`SpellDef.damage > 0`, e.g. Bonk): no ally target — auto
  hit the front living enemy (same pick as merc swings). Skip the heal /
  synergy pipeline; emit a normal `damage` event with `sourceId: 'healer'`.
  Still Waters free-heal charges are never consumed by damage casts.
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
  - **Mid-cast target death** (amended v0.3 §Coyote — see "Dying state"
    below): if the active cast's target dies (from a merc swing, an
    enemy/boss auto-attack, or Bonehowl/Extinction party damage), the cast
    is auto-cancelled the instant that death is applied — same tick,
    immediately after the `unitDied` event that caused it. `reason:
    'target-dead'`. The cast never reaches `completePlayerCast`: no
    `castFinished`, no heal, and (per Synergy below) no arm/consume. This
    supersedes the old Phase 1/2 rule ("target died mid-cast still completes
    and arms") — the old rule assumed mana was spent up front and undoing a
    completed cast was worse than letting it resolve into nothing; reserve
    semantics make a clean cancel possible instead.
    - **Party members only die instantly from the caster's point of view
      when their coyote window expires unsaved.** A party member hit for
      lethal damage enters `dying` first (still `alive`) — an in-flight cast
      targeting them is **not** auto-cancelled just because they entered
      `dying` (that would defeat the whole feature: the cast might still land
      inside the window and save them — see "Dying state"). `target-dead`
      only fires once `finalizeDeath` runs, i.e. once the window expires
      without a completed heal. Enemies/boss are unaffected by any of this —
      they still die (and cancel a `damage`-spell cast targeting them, in
      practice never observable since damage-spell casts are instant) the
      instant their hp hits 0, exactly as before.
- **Dying state** (v0.3 §Coyote — coyote-time heals): party members (tank,
  dps1, dps2, healer) get a 250ms grace window on lethal damage instead of
  dying instantly. `COYOTE_MS = 250` lives in `data/constants.ts` — the
  engine imports the constant (data imports are allowed in `combat/`; only
  Phaser/time/randomness are not) rather than hard-coding the number.
  **Enemies and the boss never get this — their death is instant, exactly as
  before.** Only `applyDamageToUnit`'s non-enemy branch (i.e. a party member)
  ever enters `dying`.
  - **Entering dying**: when a party member's hp is clamped to 0 by lethal
    damage, `Unit.alive` stays `true`, `Unit.dying` becomes `true`, and
    `Unit.coyoteRemainingMs` is set to `COYOTE_MS`. `unitDying { unitId,
    coyoteMs }` fires — not `unitDied`. Because `alive` never flips, every
    existing `alive`-gated check (heal targeting: `setTarget`,
    `resolveCastTargetId`, `fireQueuedCast`; wipe: `checkWipe`) keeps working
    unmodified — a dying unit reads as "still alive" to all of them, exactly
    as the locked design requires ("still a valid heal target … must NOT
    count as dead for wipe checks").
  - **What changes while dying** (three explicit exclusions, each keyed off
    the new `dying` flag rather than `alive`):
    1. **No further damage.** `applyDamageToUnit` returns immediately for a
       `dying` target — no `damage` event, hp stays clamped at 0. A dying
       unit is already "downed"; it can't be hit again, only saved or
       finalized.
    2. **Doesn't auto-attack.** `resolveMercSwing` skips a `dying` merc (tank
       or dps) — its swing timer keeps counting in the background (simplest
       correct behavior — no special-casing needed) but never lands a hit
       while downed.
    3. **Excluded from enemy/boss target selection**, exactly as if dead:
       `pickAllyTarget` (basic enemy/boss autos) and the Tunnel Vision
       `eligible` list (`startBossFocus`) both add a `!u.dying` check
       alongside their existing `u.alive` check. A downed unit reads as dead
       to attackers, alive to the heal/wipe pipeline — deliberately
       asymmetric, and the whole point of the feature.
  - **What does NOT change**: click-to-target (`setTarget`) and heal-cast
    targeting are untouched — both already gate on `alive` alone, so a dying
    unit remains fully click-targetable and healable with zero extra code.
  - **Saved**: if a player heal cast **completes** with a `dying` target
    (checked in `completePlayerCast`, right after the heal is applied) and
    the heal brought hp above 0, the unit is saved: `dying` clears,
    `coyoteRemainingMs` clears, `unitSaved { unitId }` fires. `unitDied`
    never fires for a saved unit. The normal `heal` event still fires first,
    with its usual overheal math (missing HP is computed against hp 0, same
    as any near-death heal) — a coyote save is not a special heal formula,
    just a normal heal that happens to land on a downed target. Mana/refund
    rules are completely unchanged: the cast completed normally, so no
    refund, exactly like any other completed cast.
  - **Expired unsaved**: if `coyoteRemainingMs` reaches ≤0 while still
    `dying` (i.e. no heal saved them in time), `finalizeDeath` runs: `alive`
    flips to `false`, `dying` clears, the swing timer is dropped, `unitDied`
    fires, any active cast still targeting the unit is auto-cancelled
    (`cancelCastIfTargeting`, `reason: 'target-dead'` — see "Mid-cast target
    death" above), then `checkWipe` runs. This is the *only* place
    `unitDied` or a `target-dead` cancel can happen for a party member now —
    the pre-v0.3 instant-death branch (`applyDamageToUnit`'s non-enemy path)
    was replaced by `enterDying` + this expiry path.
  - **Wipe timing**: because `checkWipe` only ever runs from
    `finalizeDeath`, and `alive` doesn't flip to `false` until a window
    genuinely expires unsaved, a wipe can only be detected once every party
    member's window (if any) has been resolved — "all 4 dead" now means "all
    4 either never entered dying, or entered it and their window expired
    unsaved." Multiple members downed simultaneously (e.g. a
    one-shot-strength Bonehowl) each get their own independent
    `coyoteRemainingMs`, all counted down in lockstep since they were all set
    to `COYOTE_MS` in the same tick; `resolveCoyoteExpiries` walks the party
    in stable order (tank, dps1, dps2, healer) so the `combatEnded { status:
    'wipe' }` event fires exactly once, attached to whichever member's
    `finalizeDeath` happens to be last in that fixed order.
  - **Damage-to-a-dying-unit rule** (locked, simplest deterministic option):
    a `dying` unit takes **no further damage** at all — not "damage that's
    clamped to 0 and logged", genuinely skipped (`applyDamageToUnit`'s guard
    is the first line of the function). This applies uniformly regardless of
    source: merc auto (moot, they don't target allies), enemy/boss auto (moot,
    `pickAllyTarget` already excludes them), Bonehowl/Extinction party AoE,
    Emberfall DoT ticks, Tunnel Vision focus ticks, Soul Toll — all route
    through `applyDamageToUnit`, so the guard is centralized in one place.
  - **Targeting/swing rule** (locked, simplest deterministic option): a
    dying unit "reads as downed" — stops swinging, dropped from enemy/boss
    target selection — while staying fully click-targetable and healable.
    The alternative (enemies keep attacking a unit already at 0 hp) was
    rejected as pointless noise once damage-to-dying is a no-op anyway.
  - **Enemies/boss get no coyote window** — this is party-only grace.
    `enterDying` is only ever called from the non-`enemy`/`boss` branch of
    `applyDamageToUnit`; enemy/boss lethal damage always goes through the
    unchanged `onEnemyDeath` path (instant death, XP credit, wave/victory
    check).
- **Cooldowns** (Alpha 0.1 §D6 — first major CDs): data in `data/cooldowns.ts`
  (`CooldownDef`), live per-CD state on `state.cooldowns: CooldownState[]`
  (same order as the `cooldowns` constructor option; empty array when none —
  the pre-Alpha-0.1 default). `engine.activateCooldown(id)` is buffered like
  `castSpell`/`cancelCast`: mutates immediately, `cooldownActivated` is
  delivered on the next `advance()`. Silently ignored: unknown id, still on
  cooldown (`remainingCooldownMs > 0`), or combat not running.
  - **Off-GCD, no exceptions**: activation never checks `gcdRemainingMs` or
    `playerCast` — it's legal mid-cast, mid-Tunnel-Vision-channel, while
    another CD's buff is active, any time `status === 'running'`. Its own
    `cooldownMs` timer ticks alongside every other timer via `advance(dtMs)`
    (participates in `nextTimerBoundary`, so sub-stepping still lands on it
    exactly) — no wall clock, same determinism guarantee as everything else.
  - **Still Waters shape (`freeNextHeal`)**: activating arms one charge
    (`state.cooldowns[i].activeRemainingMs` reports `1` while armed — an
    **armed flag, not a duration**; `0` once consumed). The **first player
    cast that STARTS** while armed (an immediate `castSpell`, or a queued cast
    firing via `fireQueuedCast` both count as "starting") bypasses the
    affordability check entirely (castable at 0 mana — the OOM panic button),
    reserves **0** mana, and consumes the charge right there in `beginCast`
    (emitting `cooldownBuffEnded` alongside that cast's `castStarted`). If
    that cast later **completes**: the heal lands, no mana was ever spent —
    `completePlayerCast` never re-touches mana regardless. If it's
    **cancelled** (escape or target-dead): the charge is already consumed and
    nothing is refunded, because nothing was ever reserved — locked design,
    not a bug. A second charge only arms on the next `activateCooldown` once
    the 60s cooldown is ready again.
  - **Frenzied Liturgy shape (`manaCostReduction`)**: activating opens a
    `durationMs` window (sim time, ticks down every `advance()` alongside
    `remainingCooldownMs`). While open, `effectiveManaCost(spell)` —
    `max(0, spell.mana - costReduction)`, summed across every currently-open
    `manaCostReduction` window — is what a cast reserves **at cast start**;
    the *reserved* (already-reduced) amount is stored on the engine (not
    recomputed) and is exactly what a later cancel refunds or a later
    completion silently consumes. So a window that **expires mid-cast does
    not retro-charge** the difference — the reduction locked in the instant
    the cast started. Window expiry is detected in `tick()` the moment
    `buffRemainingMs` crosses to `<=0` and emits `cooldownBuffEnded` exactly
    once (clamped at 0 so it never re-fires). Re-activating while a window is
    already open would reset it to full duration rather than stack. With the
    shipped data, Frenzied Liturgy's 30s window and 40s cooldown tick
    independently: expiry leaves 10s of real recovery, during which activation
    remains unavailable. The 40s cadence keeps a safety margin above the
    playtest bot's 44s failure boundary while preserving the pinned
    maxed-Zealot Iron Pass victory and adding readable downtime; a
    future CD with `cooldownMs < durationMs` would still follow the
    reset-not-stack rule.
  - **Wrath Ascendant shape (`healBonus`)** (Alpha 0.2 §D6): activating opens
    a `durationMs` window (same timer path as `manaCostReduction` —
    `buffRemainingMs`, `cooldownBuffEnded` on expiry, re-activate resets).
    While open, every **completed** player heal adds `bonusHeal` to raw heal
    **after** synergy / missing-health / missing-health-pct / full-health /
    relic `bonusHealing`. Multiple open `healBonus` windows sum. A window that
    expires mid-cast still applies if it was open at completion time (heal
    bonus is evaluated at complete, not reserved at start).
  - **Interaction**: if a Still Waters charge is armed AND a Frenzied Liturgy
    window is open when a cast starts, **the free charge wins** — reserve 0,
    consume the charge, leave the cost-reduction window untouched (it keeps
    ticking, available for the *next* cast). Affordability while only the
    window is open checks the reduced cost, not the base `spell.mana`.
    `healBonus` does not affect mana reservation.
  - **UI**: `spellBar.ts` renders one small button per granted cooldown to the
    right of the spell buttons (absent entirely — zero layout shift — when
    the loadout grants none). Dimmed while `remainingCooldownMs > 0`, with
    `${Math.ceil(remainingCooldownMs / 1000)}s` centered; gold accent border
    (the same stroke used for armed synergies) while `activeRemainingMs > 0`.
    Clicking a button on cooldown does nothing.
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
  Every compiled enemy group and boss carries its effective authored damage
  and swing interval. `swingTimers` is seeded from that resolved value at spawn
  and reset to the same interval after every swing. Synthetic legacy test
  encounters may omit trash values and fall back to `TRASH`.
- **Mob identity**: catalog-spawned enemies expose a stable `Unit.mobId`
  independently of generated per-wave `Unit.id`. Presentation uses `mobId` to
  resolve `MobDef.visualKey`; combat decisions use only resolved encounter
  values.
- **Boss cast union**: `BossDef.cast` is a discriminated union,
  `BossCastDef = PartyAoECastDef | TunnelVisionCastDef | PartyDoTCastDef |
  ManaSiphonCastDef`. `kind` is optional on `PartyAoECastDef` (defaults to
  that arm) so every pre-existing encounter (Ash Gate's Bonehowl, The Maw's
  Extinction) keeps compiling and behaving identically without setting `kind`
  at all — `tunnelVision`, `partyDoT`, and `manaSiphon` require an explicit
  `kind`.
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
- **Emberfall (`partyDoT`)**: telegraphed with `castMs` like `partyAoE`. On
  finish, starts a party-wide DoT that ticks `damagePerTick` every `tickMs`
  for `durationMs` against every living party member (via the shared damage
  pipeline). Emits `partyDoTStarted` / `partyDoTEnded`. A refreshed cast
  replaces any prior DoT window (no stacking). Cadence matches `partyAoE`;
  the lingering DoT does **not** block the next telegraph.
- **Soul Toll (`manaSiphon`)**: telegraphed like `partyAoE`. On finish,
  applies `partyDamage` to every living party member, then drains up to
  `manaBurn` mana from the living healer (clamped to current mana) and emits
  `manaBurned { amount }` when any mana was taken. Cadence matches `partyAoE`.
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
  - All bonus kinds stack additively on the same cast. Raw heal order:
    `spell.heal + synergy + missingHealth + missingHealthPct + fullHealth +
    relic bonusHealing + active healBonus CD windows`. `castMod` never reaches
    the engine — `resolveCombatMods` / `loadoutFromSave` already bake it into
    `SpellDef.castMs`/`mana` before spells are handed to the constructor.
- **Waves/victory/wipe**: a wave clears (and the next spawns) the instant its
  last enemy dies; victory on boss hp 0; wipe the instant all 4 party members
  are dead. `advance()` is a no-op once `status !== 'running'`.
- **Rewards**: XP is credited instantly per enemy kill (trash and bosses both
  count) and survives a later wipe. Encounters may override `xpPerEnemy`;
  synthetic encounters fall back to `REWARDS`.
- **Permanent relic stats**: the scene resolves every saved relic and passes
  the definitions through `CombatEngineOptions.relics`. The engine folds
  their data-only effects at construction: max mana, timed mana regeneration,
  flat healing, role max HP/armor/auto damage, and merc swing interval.
  Effects stack additively; armor floors each hit at 1 and swing intervals at
  100ms. Timed mana regeneration advances on simulation time, preserving
  deterministic `advance(dtMs)` behavior.
- **Level / loadout mana regen** (Alpha 0.2 §D2): `CombatEngineOptions.manaRegen`
  merges with relic `manaRegen` — **sum amounts**, **minimum interval** across
  every contributing source (same rule relic-to-relic already used). There is
  a single regen ticker; `PARTY.manaRegenPer5s` is retired. Level bonuses are
  computed by `manaBonusesForLevel` (`meta/progression.ts`) and wired through
  loadout in a later chunk.

## Determinism

Simultaneous events resolve in a fixed priority each tick: **cooldown buff
windows that expired this tick** (`manaCostReduction` → `cooldownBuffEnded`) →
player cast completes → queued cast fires → **coyote windows that expired
this tick** (v0.3 §Coyote — any `dying` party member whose grace window hit 0
and wasn't saved by a heal completing in one of the two previous steps;
`finalizeDeath` → `unitDied`, `target-dead` cancel of any cast still
targeting them, then a wipe check) → boss cast completes (`partyAoE` /
`manaSiphon` party damage, a `partyDoT` window starting, or a `tunnelVision`
telegraph finishing into a channel) → boss focus tick (`tunnelVision` channel
damage, if one landed this tick) → party DoT tick (`partyDoT`, if active) →
merc autos (tank, dps1, dps2) → enemy/boss autos (spawn order) → boss cast
timer starts a new telegraph/cast (blocked while a `tunnelVision` channel is
active). `advance()` sub-steps to the next timer boundary — cooldown
(`remainingCooldownMs`), buff-window (`manaCostReduction`'s
`buffRemainingMs`), and **coyote (`coyoteRemainingMs`, while `dying`)**
timers participate in that boundary calculation too, so a cooldown becoming
ready, a buff window expiring, or a coyote window closing always lands on an
exact sub-step — so the event log for a given command sequence is independent
of how the caller chunks `dtMs`. The coyote-expiry step is placed
deliberately *after* cast completion and the queued-cast fire: if a heal
completes in the exact same tick a dying target's window would otherwise
close, the heal resolves first (clearing `dying` via `unitSaved`), so the
expiry check simply finds nothing left to finalize — the boundary is
inclusive in the heal's favor. Commands issued between `advance()` calls
(`castSpell` may emit `castStarted`; `cancelCast` may emit `castCancelled`;
`activateCooldown` may emit `cooldownActivated`) are buffered and flushed at
the start of the next `advance()`.
