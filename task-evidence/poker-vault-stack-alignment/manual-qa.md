# Manual QA: Poker vault stack alignment

Status after `standAndWait` / retry changes.

## Results

| Scenario | Result | Notes |
| --- | --- | --- |
| HU winner/loser | PASS | Winner/loser vault flow verified manually with vault check enabled. |
| Normal stand without pending | PASS | Seat/stack removal and vault balance verified manually. |
| Deposit/withdraw after stand | PASS | Vault deposit/withdraw remained usable after stand. |
| Pending+stand repro | BLOCKED | Blocked before repro by existing devnet/RPC/blockhash/confirmation issue in sit/lock flow. |
| Wrong release TX reject | NOT RUN | Difficult to perform manually without extra setup. |

## Pending+stand blocker details

Attempted flow:

1. A and B sit and play an active hand.
2. C should sit as a waiting third player during the active hand.
3. C should add chips during that same active hand.
4. C should stand before the A/B hand finishes.

Observed blocker before step 3:

```text
Sedanje nije uspelo (Transaction not found or not confirmed). Buy-in od 10 je zaključan — potpiši release u novčaniku (Vault → isti iznos) ili pokušaj ponovo.
```

Also observed:

```text
Simulation failed. Message: Transaction simulation failed: Blockhash not found. Logs: [].
```

## Classification

This is currently classified as **BLOCKED**, not FAIL, for the pending+stand scenario.

The blocker happens before the `add-chips` / `standAndWait` part of the repro and appears related to the existing devnet/RPC/blockhash/transaction confirmation flow around `lockForTable` / server-side `verifyTableVaultTx`.

## Environment notes checked

- `VITE_SOLANA_RPC` and `SOLANA_RPC_URL` both point to Devnet.
- `VITE_MINT` and `POKER_TABLE_MINT` are the same mint.
- Frontend runs from `solana/web`.
- Poker server listens on `:3081` and uses the same table mint.

## Follow-up outside this MR

Potential future hardening:

- Add retry/backoff around server-side `verifyTableVaultTx()` for fresh signatures.
- Or explicitly confirm frontend vault transactions before sending the corresponding poker server message.

Those changes are intentionally outside this MR scope.
