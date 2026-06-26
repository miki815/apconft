# poker-short-stack-call.plan.md

## Task

Bug: short-stack `Call` can trigger `commit exceeds stack`.

When a player has `stack > 0` but cannot cover the full `toCall`, the UI/server can send:

```ts
{ type: 'call' }
```

Before this task, the engine `call` branch attempted to commit the full `toCall`, which could call `commitChips(player, toCall)` with `toCall > player.stack` and throw `commit exceeds stack`.

## Final Scope

Implemented scope:

- Engine fix in `poker/src/table.ts`
- Dedicated engine tests in `poker/src/table.test.ts`
- Frontend UX label update in `solana/web/src/poker/PokerPlay.tsx`

Not implemented / intentionally not changed:

- No WS contract change
- No `poker/src/protocol.ts` change
- No `poker/server/room.ts` change
- No Vault lock/release flow change
- No wallet provider flow change
- No buy-in max / vault balance logic change
- No `.env` / `.env.example` change
- No package file or dependency change
- No Anchor / IDL / contracts change

## Implemented Behavior

### Engine

In `poker/src/table.ts`, short-stack `call` is treated as an effective all-in / partial call.

If:

- `action.type === 'call'`
- `toCall > 0`
- `player.stack > 0`
- `toCall > player.stack`

Then the engine:

- commits only `effectiveCall = Math.min(toCall, player.stack)`
- leaves `commitChips()` as the global invariant guard for other paths
- sets `player.status = 'all-in'` when the committed call reduces stack to `0`
- removes the player from `needsAction`
- keeps `betThisRound` and `betThisHand` consistent through `commitChips()`
- uses round action label `Call all-in <effectiveAmount>`

Normal covered calls still use round action label `Call <toCall>`.

### Frontend UX

In `solana/web/src/poker/PokerPlay.tsx`, the existing `myStack` derived from `table.state.players` / `table.seats` is used to detect a short-stack call.

If:

- `table.you.canAct === true`
- `table.you.toCall > 0`
- `myStack > 0`
- `table.you.toCall > myStack`

Then the action hint/button displays:

```txt
Call all-in <myStack>
```

The click still sends the existing WS payload:

```ts
{ type: 'call' }
```

The separate `All-in` button remains available.

## WebSocket Contract

WS payload remains unchanged:

```ts
{ type: 'action', action: { type: 'call' } }
```

`poker/src/protocol.ts` was not changed.

## Tests Added

Added dedicated `HoldemTable short-stack call` coverage in `poker/src/table.test.ts`:

- `treats heads-up preflop short-stack call as all-in`
  - 2-player real `startHand()` + `applyAction()` flow
  - short-stack has `stack > 0`
  - `toCall > stack`
  - sends `{ type: 'call' }`
  - verifies no exception, `status === 'all-in'`, `stack === 0`, correct action seat/runout behavior, and chip conservation
- `treats 3-way postflop short-stack call as side-pot all-in`
  - 3-player real flow to flop
  - deep player bets more than short stack can cover
  - short-stack sends `{ type: 'call' }`
  - verifies all-in status, side-pot eligibility, hand completion/showdown, and chip conservation
- `keeps a covered call as a normal call`
  - verifies regular full call remains `Call <amount>` and does not become all-in
- `keeps explicit all-in action working`
  - verifies existing `{ type: 'all-in' }` flow still works
- `does not lock runout after a partial call while two players can still act`
  - 4-player real flow
  - verifies partial call does not incorrectly trigger locked runout while multiple active players with stack remain

Existing 4-6 player locked-runout and uncalled-bet refund tests remain relevant regression coverage.

## Test / Build Evidence

Final raw logs in this evidence folder:

- `poker-test-pass-94-of-94.log`
  - Command: `npm run poker:test`
  - Final result: pass 94/94
- `frontend-build-pass.log`
  - Command: `npm run build --prefix solana/web`
  - Final result: pass
  - Vite emitted the existing large chunk warning

## Flaky First Run Note

The first poker test run after the code changes had unrelated existing flaky `PokerRoom rebuy grace` timing failures:

- `grace deadline is approximately now + rebuyGraceMs`
- `rebuy success with two eligible may auto-start next hand`

All new `HoldemTable short-stack call` tests passed in that run.

The second poker test run passed 94/94 without any additional code changes between the failing flaky run and the passing run.

## Manual QA

Manual QA: not run.

Manual browser QA should be documented separately if/after it is performed. Recommended manual QA:

- reproduce a short-stack facing `toCall > stack`
- verify UI shows `Call all-in <stack>`
- click Call
- verify no `Server error`
- verify the hand continues

## Final Evidence Folder

```txt
task-evidence/poker-short-stack-call/
  frontend-build-pass.log
  poker-short-stack-call.plan.md
  poker-test-pass-94-of-94.log
```
