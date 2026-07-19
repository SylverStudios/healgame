---
name: balance-tune
description: Retune healgame combat numbers using scripted-bot telemetry instead of hand-derived math. Use for difficulty complaints, tuning a new dungeon or spell, or any change to numbers in game/src/data/.
---

# balance-tune

Never hand-derive fight math — measure it. The loop:

1. **Read the gates first**: `game/src/combat/balance.test.ts` encodes the
   difficulty shape (no-heal wipes, naive overheal wipes, full kit clears,
   The Maw unwinnable). Gates decide whether a tune ships. Retune data
   freely; never weaken a gate to make a tune pass — that is a design
   decision for the user.
2. **Measure**: `npm run content -- balance <dungeon-id>` (or `--all`) runs
   the maxed-kit bot harness and prints a report; `npm run telemetry` gives
   event-level diagnostics. Add a throwaway scripted-bot diagnostic (see
   `game/src/combat/balanceBot.ts`) if you need a different bot profile.
3. **Tune data only**: numbers live in `game/src/data/` — integers, roughly
   1–10 scale. Never inline numbers in engine or scene code.
4. **Interpret with the two structural facts**: fight length is merc-driven
   (identical across player kits), and a wipe requires all 4 party members
   dead — so boss HP alone can never separate base-kit from full-kit
   outcomes.
5. Delete any throwaway diagnostic before committing.
6. Gate the result (`npm run verify:fast` minimum) and log the tuning
   decision + reasoning in `docs/poc-qa.md`.
