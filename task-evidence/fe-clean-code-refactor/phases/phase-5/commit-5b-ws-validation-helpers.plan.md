# Phase 5 — Commit 5b — validation + pure helpers extraction

**Initiative:** FE clean-code refactor (`solana/web`)  
**Prior:** 5a `ee90b78` — `refactor(poker-ui): izdvoji ws public tipove`  
**Status:** IMPLEMENTED · BUILD PASS — awaiting review / git commit  
**Date:** 2026-06-24

---

## Scope (5b only)

| Action | Path |
|--------|------|
| NEW | `solana/web/src/poker/wsValidation.ts` |
| NEW | `solana/web/src/poker/wsHelpers.ts` |
| MOD | `solana/web/src/poker/ws.ts` |

## Changes summary

- **wsValidation.ts:** `isValidServerNow`, `isValidShowdownEndsAt`, `isValidResultDurationMs`, `isValidClockAnchor` — 1:1
- **wsHelpers.ts:** `cardLabel`, `shortPk`, `preflightSitMessage` — 1:1
- **ws.ts:** re-export validators/helpers; hook importuje validatore iz `wsValidation.ts`

## Unchanged

- Public API preko `./ws` (barrel)
- Consumer importi `from './ws'`
- `usePokerWs` hook body, WS lifecycle, pending/timeout/cleanup
- Message payloads, error tekstovi

## Not touched

- 5c (`usePokerWs.ts` extraction), consumers, server, vault, env, package

## Build

```bash
npm run build --prefix solana/web
```

**Log:** `frontend-build-pass-5b.log`

## Manual QA

**5b:** build sufficient for type/helper move; full browser QA not required per plan.

**Watchlist for later (5c):**
- Showdown/countdown smoke (validators moved — relevant at 5c QA)
- `add-chips flow` — pre/posle 5c

## Git

- **Commit:** NOT made
- **Push:** NOT done
