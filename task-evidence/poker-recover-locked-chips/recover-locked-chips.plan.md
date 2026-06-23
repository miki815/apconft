# Taiga #14 — Recover locked chips after failed sit

## Summary

Task: `Error recovery UX za failed sit posle vault lock-a`

Branch/task name: `fix/poker-recover-locked-chips`

Goal: if `lockForTable` succeeds on-chain but the following `sitAndWait` does not confirm seat assignment, the player must not be left without a clear recovery action for locked chips. If the automatic release/refund fails, the Poker UI shows `Recover locked chips` and allows retrying release without a new lock, sit, or stand request.

## Implemented scope

Implemented as a minimal frontend-only change in:

- `solana/web/src/poker/PokerPlay.tsx`

No other production files were changed.

## Active flow after implementation

1. `handleSit` snapshots the current seat and buy-in before async work:
   - `seatToSit = pickSeat`
   - `buyInToLock = chipAmountNum`
2. Frontend runs existing preflight:
   - local `preflightSitMessage(...)`
   - WebSocket `checkSit(seatToSit, buyInToLock)`
3. If vault checks are enabled, frontend calls:
   - `lockForTable(..., buyInToLock)`
4. The returned `lockTx` signature is stored in a variable scoped across both `try` and `catch`.
5. Frontend calls:
   - `sitAndWait(seatToSit, buyInToLock, lockTx)`
6. If `sitAndWait` fails after lock, frontend first attempts automatic refund:
   - `releaseFromTable(..., buyInToLock)`
7. If automatic release succeeds:
   - vault balance is refreshed
   - no recovery panel is shown because no user action is needed
8. If automatic release fails:
   - a failed-sit recovery state is stored
   - the UI shows `Recover locked chips`
   - risky actions are blocked until recovery state is cleared
9. Clicking `Recover locked chips` calls only:
   - `releaseFromTable(..., sitRecovery.amount)`
10. If recovery release succeeds:
   - vault balance is refreshed
   - recovery state is cleared
11. If recovery release fails:
   - recovery state remains
   - the release error is displayed
   - the user can retry

## Recovery state

Added local React state:

```ts
interface SitRecoveryState {
  amount: number
  seat: number
  lockTx: string
  sitError: string
  releaseError: string | null
}
```

The state is React state only. `sessionStorage` / `localStorage` persistence was intentionally not added in this minimal scope because it would require extra validation across wallet, mint, RPC, and stale transaction state after refresh.

## Amount snapshot

The recovery release amount is the original `buyInToLock` captured before async operations begin. It is not derived from the mutable `buyIn` input after the failed sit.

This protects the recovery flow from later user edits to:

- buy-in input
- seat selection

## `lockTx` scope fix

`lockTx` is declared next to `locked`, before the `try` block:

```ts
let locked = false
let lockTx: string | undefined
```

This makes the original lock signature available in both normal failed-sit handling and the outer `catch` path. The signature is used for recovery context/display, not for sending another server request.

## Actions blocked while recovery exists

While `sitRecovery` exists:

- new sit / new lock is blocked
- add-chips is blocked
- stand is blocked
- start-hand is blocked
- buy-in input and max buttons are blocked
- recovery button is guarded by existing `busy` state to prevent double-click parallel release attempts

## What recovery does not do

The recovery action does not:

- call `lockForTable`
- call `sitAndWait`
- send a `sit` WebSocket message
- call `standAndWait`
- send a `stand` WebSocket message
- modify the WebSocket contract
- modify server-side room logic

## Relation to `pendingStandReleaseTx`

The existing `pendingStandReleaseTx` pattern remains scoped to stand flow. It stores a successfully signed release transaction so `standAndWait` can be retried without a new Phantom release signature when server stand acknowledgement fails.

Failed-sit recovery is separate because there is no seat to stand from and no server `stand` acknowledgement involved. If the previous auto-release did not successfully complete, recovery asks Phantom for a new `releaseFromTable(amount)` signature.

## Files intentionally not changed

Not changed:

- poker server
- WebSocket contract
- `poker/src/protocol.ts`
- `solana/web/src/poker/ws.ts`
- Anchor/Solana program
- `solana/programs/`
- `.env`
- `.env.example`
- package/dependency files
- poker engine
- MR #12 retry/backoff in `poker/server/vaultTx.ts`

## Tests and verification

Automated checks run for this implementation:

- `npm run build --prefix solana/web`
  - PASS
  - captured in `frontend-build-pass.log`
- `npm run poker:test`
  - PASS `85/85`
  - captured in `poker-test-pass-85-of-85.log`

Notes:

- `solana/web` has no frontend test script.
- `npm run poker:test` is a regression smoke check because the poker/Vault flow is sensitive, not a frontend E2E test.
- Phantom / wallet / on-chain recovery behavior requires manual QA.

## Manual QA coverage

Manual QA evidence is captured in:

- `manual-qa-pass.md`

Covered scenarios include:

- normal sit smoke
- failed sit with automatic release success
- failed sit with automatic release reject and recovery panel display
- recover locked chips success
- recover locked chips fail/retry
- normal sit after recovery
- stand/release regression

## Known residual risks

- `Blockhash not found` can happen if a Phantom lock prompt is left open too long. If lock does not succeed on-chain, recovery is not shown because there is no confirmed locked amount to release. This is outside Taiga #14.
- `releaseFromTable` is not idempotent if a release transaction succeeds on-chain but the frontend receives an error/timeout. A retry could potentially attempt a second release. This remains a future hardening / transaction confirmation task.
- Existing stand behavior such as `Cannot leave during a hand` is not part of failed-sit recovery.
- A busted player with stack `0` can leave without release because there is no releasable stack. That is expected current poker/Vault behavior and is outside this task.
