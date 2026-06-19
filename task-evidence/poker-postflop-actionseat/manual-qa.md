# Manual QA — Postflop actionSeat skips all-in button

Task: Postflop actionSeat skips all-in button

Branch/task name: `fix/poker-postflop-all-in-actionseat`

Status: PASS for optional browser smoke scenario.

## Preconditions

- Poker server running.
- Solana web frontend running.
- Vault check skipped locally for smoke test:
  - `POKER_SKIP_VAULT_CHECK=1`
  - `VITE_POKER_SKIP_VAULT_CHECK=1`
- Three browser profiles / three player sessions available.
- Three players seated at the same poker table.
- One player has a short stack.
- Two players have enough chips to continue after the short-stack all-in.

## Scenarios verified

### 3-way short-stack all-in preflop smoke

Status: PASS

- Three players joined the same table.
- One short-stack player went all-in before the first three shared board cards were dealt.
- The other two active players called.
- The first three shared board cards were dealt.
- The all-in player only waited and did not receive action buttons.
- An active player with stack > 0 received the action buttons.
- The hand continued after the active player acted.
- The hand did not get stuck on the first shared-card round.

## QA notes

- This manual QA was optional smoke only.
- The task is engine-only and the main acceptance coverage is automated test evidence:
  - `poker-test-pass-89-of-89.log`
- Vault / Phantom / Anchor flow was intentionally not tested because it is outside this task scope.
- During manual testing, the existing unrelated `commit exceeds stack` issue can appear if a short-stack player clicks `Call` when they cannot cover the call amount.
- Workaround for this smoke test: use `All-in` instead of `Call` for a short-stack player who cannot cover the call.
- `commit exceeds stack` is not part of this postflop actionSeat fix and should remain a separate poker action validation/UI issue.

## Known residual risks / out of scope

- 4/5/6-way and later-street edge cases were not manually reproduced in browser because they require precise player count, seat/button order, stack setup, and action timing.
- Those edge cases are covered by automated engine tests.
- Vault deposit/withdraw was not tested.
- Phantom lock/release was not tested.
- Anchor program was not tested.
- Frontend layout was not tested.
- WebSocket contract was not changed and was not separately tested.
- Side-pot accounting was not manually tested because `poker/src/pot.ts` was not changed.
