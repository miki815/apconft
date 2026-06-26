# Manual QA — poker-short-stack-call

Manual browser QA result: PASS 5/5.

## Environment

- Dev vault check disabled on poker server: `POKER_SKIP_VAULT_CHECK=1`
- Dev vault check disabled on frontend: `VITE_POKER_SKIP_VAULT_CHECK=1`
- Screenshot: not included in evidence; screenshot will be added in MR.

## Scenarios

### 1. 2-player short-stack `Call all-in`

Result: PASS

- UI displayed `Call all-in <stack>`.
- No `Server error` was shown.
- Player became all-in.
- Hand continued.

### 2. Covered Call regression

Result: PASS

- Normal `Call 90` completed.
- Player still had chips remaining after the call.
- Pot correctly became `200`.

### 3. All-in button regression

Result: PASS

- All chips were committed.
- Stack became `0`.
- No error was shown.

### 4. 3-player postflop short-stack Call

Result: PASS

- `Call all-in` completed without error.
- Remaining players continued the hand.

### 5. Narrow/mobile visual sanity

Result: PASS

- `Call all-in 10` text and button were not clipped.
- Text and button did not overlap.
- Text and button stayed within the screen.

## Summary

- Passed scenarios: 5/5
- Failed scenarios: 0/5
