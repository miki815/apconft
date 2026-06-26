# Phase 3 — usePokerSeating hook

**Status:** IMPLEMENTED + BUILD PASS + MINIMUM MANUAL QA PASS / **ACCEPTED**  
**Date:** 2026-06-24  
**Initiative:** FE clean-code refactor (`solana/web`)  
**Prior:** Phase 1 + Phase 2 ACCEPTED

---

## Final changed files

| Action | Path |
|--------|------|
| **NEW** | [`solana/web/src/poker/usePokerSeating.ts`](solana/web/src/poker/usePokerSeating.ts) |
| **MOD** | [`solana/web/src/poker/PokerPlay.tsx`](solana/web/src/poker/PokerPlay.tsx) |

Evidence only (no production code):

- `task-evidence/fe-clean-code-refactor/phases/phase-3/use-poker-seating.plan.md`
- `task-evidence/fe-clean-code-refactor/phases/phase-3/manual-qa.md`
- `task-evidence/fe-clean-code-refactor/phases/phase-3/frontend-build-pass.log`

---

## Implementation summary (final state)

### `usePokerSeating.ts` — latest implemented hook

1:1 extract from former `PokerPlay.tsx` seating block:

- **State:** `pickSeat`, `buyIn`, `busy`, `txMsg`, `pendingStandReleaseTx`, `sitRecovery`
- **Effects (2):** clear `pendingStandReleaseTx` / `sitRecovery` on `mySeat` change; buy-in clamp on `maxBuyIn` / `maxAddChips`
- **Handlers (5):** `handleBuyInChange`, `handleAddChips`, `handleSit`, `handleRecoverLockedChips`, `handleStand`
- **Returns:** `pickSeat`, `setPickSeat`, `buyIn`, `setBuyIn`, `busy`, `txMsg`, `sitRecovery`, `sitRecoveryActive`, all handlers
- **Imports:** `lockForTable` / `releaseFromTable`, `preflightSitMessage`, `AddChipsWaitResult` from `ws.ts`, `SitRecoveryState` from `types.ts`
- **`SKIP_VAULT`** module constant in hook file (same env check as parent)

### `PokerPlay.tsx` — orchestrator after extract

- Calls `usePokerSeating(...)` after `releasableStack` is computed
- **Retains in parent:** IDL fetch, `useVaultBalance`, wallet/connection, `usePokerWs`, game derivations (pots, showdown, countdown, raise bounds, hero), JSX
- **Same `PokerControlsPanel` props contract** — interface unchanged; wiring identical to pre-Phase-3 behavior
- **`onMaxBuyIn` / `onMaxAddChips`** lambdas in parent use `setBuyIn` from hook

### Unchanged (out of Phase 3 scope)

ws.ts contract, poker server, Anchor, `tableVault.ts`, `useVaultBalance.ts`, env, package, CSS, `PokerControlsPanel` interface, `PokerSeat`

---

## Validation strategy (applied)

- `buyInValid`, `addChipsValid`, `vaultTxReady` remain in **parent** for panel disabled states
- Hook handlers (`handleSit`, `handleAddChips`) **recompute same guard formulas inline** before early return
- **No `useCallback`** on handlers
- All `setTxMsg` strings and async order preserved 1:1 from pre-extract code

---

## Verification

| Check | Result | Evidence |
|-------|--------|----------|
| `npm run build --prefix solana/web` | **PASS** | `frontend-build-pass.log` (461 modules, ~20.28s) |
| Minimum manual QA | **PASS / ACCEPTED** | `manual-qa.md` |

---

## Out of scope / deferred (not Phase 3)

- **Stand / Ustani** during result timer or active hand — pre-existing **server** behavior (`Cannot leave during a hand`); auto-start next hand after showdown — separate future fix
- **Countdown silent third state** (valid deadline + missing `clockAnchor`)
- **Phase 4–6** (vault/IDL/PDA extract, ws split, CSS)

---

## Phase 3.5 micro cleanup (follow-up)

- Added explicit `UsePokerSeatingResult` export and return type on `usePokerSeating`
- **No runtime behavior change** — TypeScript contract / IDE documentation only
- Build: `phase-3-5-build-pass.log`

---

## Next

Phase 4+ when user approves scope.
