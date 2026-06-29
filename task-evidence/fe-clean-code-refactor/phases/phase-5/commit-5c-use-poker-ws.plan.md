# Phase 5 — Commit 5c — `usePokerWs` hook extraction

**Initiative:** FE clean-code refactor (`solana/web`)  
**Prior:**  
- 5a `ee90b78` — ws public tipovi  
- 5b `142e581` — ws validatore i helpere  
**Status:** DONE — PASS — ready for user commit decision  
**Date:** 2026-06-24

---

## Scope (5c only)

| Action | Path |
|--------|------|
| NEW | `solana/web/src/poker/wsConfig.ts` |
| NEW | `solana/web/src/poker/wsPending.ts` |
| NEW | `solana/web/src/poker/usePokerWs.ts` |
| MOD | `solana/web/src/poker/ws.ts` (final barrel) |

## Changes summary

- **wsConfig.ts:** `WS_URL`, `WS_TIMEOUT_MS` — internal, not in public barrel
- **wsPending.ts:** `PendingRequest`, `PendingRequestInit` — internal, not in public barrel
- **usePokerWs.ts:** literal move hook iz `ws.ts` (L83-395)
- **ws.ts:** samo re-export tipova, validatora, helpera, `usePokerWs`

## Unchanged (1:1)

- WebSocket lifecycle, pending, timeout, cleanup, onmessage parsing
- Message payloads, error tekstovi, effect deps `[playerId, clearPending]`
- Public API preko `./ws`; consumer importi `from './ws'`

## Not touched

- Consumers, server, vault, env, package, CSS, pre-existing bugs

---

## Acceptance status

| Gate | Result |
|------|--------|
| 5c implementation | **DONE** |
| Static post-implementation review | **PASS** |
| Build (`npm run build --prefix solana/web`) | **PASS** |
| Manual browser QA | **PASS** |
| Add-chips flow | **PASS** |
| Showdown / countdown smoke | **PASS** |
| Tab switch / reload / reconnect | **PASS** |
| Production vault lock/release | **NOT TESTED** — not required for 5c WS-only acceptance |

### QA setup (manual)

- Poker server: `:3081`
- Frontend: `http://localhost:5173`
- Skip-vault uključen: `POKER_SKIP_VAULT_CHECK=1`, `VITE_POKER_SKIP_VAULT_CHECK=1`
- WS-only smoke QA

### Pre-existing — not fixed, not 5c blockers

- Countdown silent third state
- Stand server timer
- Sit recovery UI

**5c verdict:** **PASS** — ready for user commit decision

---

## Build

```bash
npm run build --prefix solana/web
```

**Log:** `frontend-build-pass-5c.log`

## Manual QA

**Status:** PASS — see `manual-qa.md`

## Git

- **Commit:** NOT made
- **Push:** NOT done

## Phase 5 final acceptance

**NOT YET** — pending 5c git commit + Phase 5 final sign-off
