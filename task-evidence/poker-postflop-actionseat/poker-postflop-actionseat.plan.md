# Task evidence: Postflop actionSeat skips all-in button

## Status

Implemented. The final scope is limited to:

- `poker/src/table.ts`
- `poker/src/table.test.ts`

This is a poker engine/actionSeat task. It does not touch Vault, Phantom, frontend, Anchor, WebSocket contract, env files, package files, dependencies, or `poker/src/pot.ts`.

## Problem

The original minimal reproduction was a 3-way hand where a button player goes all-in preflop and reaches `stack = 0`. After the hand advances to flop, `actionSeat` could be set to that all-in button player even though two other players were still active with chips.

Expected invariant:

- `actionSeat` must not be a folded player.
- `actionSeat` must not be an all-in player.
- `actionSeat` must not be a player with `stack = 0`.
- If action is required, `actionSeat` must be an active player with `stack > 0` who is in the current `needsAction` flow and can make a real action.

## Wider bug class

The 3-way scenario is only the minimal reproduction, not the full bug scope.

Additional analysis found the same class of bug in wider real engine flows:

- 4/5/6-way hands with exactly two active players left with chips and an all-in button at `stack = 0`.
- Later street boundary (`flop -> turn`) where the button goes all-in on the flop and two active players call.
- Wrap/non-seat-1 button position where the all-in button is not seat 1 and postflop selection must wrap to a valid active player.

All scenarios are reachable through public engine flow: `startHand()` + `applyAction()`. No internal state is manually patched in the tests.

## Root cause

In `poker/src/table.ts`, `endBettingRound()` correctly rebuilt `needsAction` using only players with:

- `status === 'active'`
- `stack > 0`

But `firstPostflopActionSeat()` selected the preferred postflop seat using `seatsInHandCount()` / `seatedWithChips()` logic and returned that seat without validating that the chosen player could actually act.

When an all-in button had `stack = 0`, `seatedWithChips()` could exclude that player from counting, causing the heads-up shortcut to return the all-in button seat as `actionSeat`.

## Fix

Minimal engine fix in `poker/src/table.ts`:

- `firstPostflopActionSeat()` now returns `number | null`.
- It computes the existing preferred seat.
- It validates the preferred player with `canPlayerAct()`.
- If the preferred player cannot act, it falls back to `nextActionSeat(preferred)`.
- `endBettingRound()` has a defensive `null` path: if no action seat is found after `needsAction` was expected, it uses the existing `runOutBoard()` + `showdown()` path so the engine does not stay in a dead state.

This fix does not change pot accounting, side-pot logic, showdown distribution, blinds, button rotation, preflop order, or WebSocket payloads.

## Tests added

All new tests are in `poker/src/table.test.ts`.

### `3-way postflop skips all-in button when choosing action seat`

Original minimal bug reproduction:

- 3 players.
- Button goes all-in preflop and reaches `stack = 0`.
- Two active players still have chips.
- Hand advances preflop -> flop.
- Assert: `actionSeat` is not the all-in button.
- Assert: selected actor is `active`, `stack > 0`, not folded, not all-in.
- Assert: real `applyAction(actor.id, { type: 'check' })` succeeds.

### `4-6-way postflop skips all-in button with two active players`

Wider class coverage:

- Parametrized for 4, 5, and 6 players.
- Button goes all-in and reaches `stack = 0`.
- Exactly two other players remain active with chips.
- Hand advances preflop -> flop.
- Same actionSeat invariant is asserted.

### `postflop wraps past non-seat-1 all-in button when choosing action seat`

Position/wrap coverage:

- Button is not seat 1.
- Actual post-start button is seat 4.
- Button goes all-in and reaches `stack = 0`.
- Postflop action selection must wrap to a valid active player.
- Same actionSeat invariant is asserted.

### `later postflop streets skip all-in button`

Street-boundary coverage:

- Players reach flop normally.
- Button goes all-in on the flop.
- Two active players call.
- On turn, `actionSeat` must not be the all-in button.
- The hand then checks through turn and verifies there is no dead state at the next boundary.

## Existing related tests

Existing tests that remain important regression coverage:

- `heads-up one active + one all-in enters locked runout`
- `two active players still get flop action`
- `3-way locked runout: no action for lone active after short stack all-ins`
- `4-6-way locked runout: lone active, rest all-in`
- `turn-close locked runout deals river and completes showdown`
- uncalled refund and folded matched chips tests in `HoldemTable uncalled bet refund`

Some of these cover similar flows, but they did not directly cover this edge case before the new tests because they differed by player count, street boundary, stack/all-in relation, or final `actionSeat` condition.

## Final test evidence

Final acceptance PASS evidence:

- `poker-test-pass-89-of-89.log`
  - Full raw terminal output from `npm run poker:test`.
  - Contains:
    - `# tests 89`
    - `# pass 89`
    - `# fail 0`
- `manual-qa.md`
  - Optional browser smoke QA evidence for the 3-way short-stack all-in scenario.
  - Notes the unrelated `commit exceeds stack` issue and the smoke-test workaround.

No focused, failed, hung, or partial logs are kept in final evidence. Earlier failed/hung/focused attempts were intentionally not retained to keep the task-evidence folder consistent with other engine/backend poker tasks.

## Not changed

- `poker/server/room.ts`
- WebSocket contract / protocol
- frontend (`solana/web`)
- Vault lock/release
- Anchor program
- env files / `.env.example`
- `package.json` / lock files / dependencies
- `poker/src/pot.ts`

## Acceptance status

Ready for acceptance from the engine/test side:

- The original 3-way bug is covered.
- The wider 4/5/6-way class is covered.
- Later street boundary is covered.
- Non-seat-1/wrap button position is covered.
- Full poker test suite passed with raw output saved.
