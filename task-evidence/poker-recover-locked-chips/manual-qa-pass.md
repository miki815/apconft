# Manual QA — Recover locked chips

Task: Taiga #14 — `Error recovery UX za failed sit posle vault lock-a`

Branch/task name: `fix/poker-recover-locked-chips`

Status: PASS for the scenarios listed below.

## Preconditions

- Poker server running.
- Solana web frontend running.
- Vault check enabled.
- Two browser profiles / Phantom wallets available.
- Wallets have Dev SOL for fees.
- Wallets have deposited chip balance in the table vault.
- `VITE_MINT` and `POKER_TABLE_MINT` point to the same mint / cluster.

## Scenarios verified

### Normal sit smoke

Status: PASS

- Player sits normally.
- Phantom lock is confirmed.
- Seat assignment succeeds.
- No recovery panel is shown.

### Failed sit + auto-release success

Status: PASS

- Player A attempted to sit.
- Player B occupied the same seat before A completed the lock + sit flow.
- Player A received `Seat taken`.
- Frontend attempted automatic release.
- Automatic release was confirmed in Phantom.
- Buy-in was returned to vault.
- Recovery panel was not shown because recovery was not needed.

### Failed sit + auto-release reject

Status: PASS

- Automatic release was rejected in Phantom.
- `Recover locked chips` was displayed.
- The original buy-in amount was displayed.
- The panel showed `Sit error: Seat taken`.
- The panel showed `Release error: User rejected the request`.

### Recover locked chips success

Status: PASS

- Clicked `Recover locked chips`.
- Phantom release was confirmed.
- Locked buy-in was returned to vault.
- Recovery state was cleared.

### Recover locked chips fail / retry

Status: PASS

- Clicked `Recover locked chips`.
- Phantom release was rejected.
- Recovery panel and button remained available.
- UI showed:

```text
Recover release nije uspeo. Zaključani buy-in od 60 ostaje u recovery stanju. (User rejected the request.)
```

### Cleanup after retry failure

Status: PASS

- Clicked `Recover locked chips` again.
- Release was confirmed.
- UI showed:

```text
Locked buy-in od 60 čipova vraćen je u vault.
```

- Recovery state was cleared.

### Normal sit after recovery

Status: PASS

- After recovery completed, normal sit was possible again.
- New sit did not reuse the failed recovery state.

### Normal stand/release regression

Status: PASS

- Three-player regression scenario.
- Hand was not active.
- Player had stack > 0.
- Normal stand/release worked as before.

## QA notes

- `Blockhash not found` happened when Player A's Phantom lock prompt stayed open too long.
- In that case, vault balance stayed the same and the recovery panel was not displayed.
- This is expected for this task because the lock did not succeed on-chain, so there was no confirmed locked amount to recover.
- `Blockhash not found` is not part of Taiga #14.

## Known residual risks / out of scope

- `releaseFromTable` is not idempotent for the case where a release transaction succeeds on-chain but the frontend receives an error/timeout. A retry could potentially attempt a second release. This remains a future hardening / transaction confirmation task and is not included in this MR.
- Stand during an active hand can return `Cannot leave during a hand`. This is existing stand flow behavior and is not part of failed-sit recovery.
- A player who loses all chips and has stack `0` can leave without release TX; vault balance does not increase because there is no releasable stack. This is expected behavior and is not part of this task.
