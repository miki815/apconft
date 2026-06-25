# Phase 5 — Commit 5a — `ws.ts` type extraction

**Initiative:** FE clean-code refactor (`solana/web`)  
**Prior:** Phase 4 ACCEPTED (`6a8a3dd`)  
**Status:** IMPLEMENTED · BUILD PASS — awaiting review / manual QA / git commit  
**Date:** 2026-06-24

---

## Scope (5a only)

| Action | Path |
|--------|------|
| NEW | `solana/web/src/poker/wsTypes.ts` |
| MOD | `solana/web/src/poker/ws.ts` |

## Changes summary

- Exportovani type/interface definicije izvučene u `wsTypes.ts` (1:1 copy)
- `ws.ts`: `import type { ... } from './wsTypes'` + `export type { ... } from './wsTypes'`
- Hook, validatori, helperi, WS runtime — netaknuti u `ws.ts`

## Types moved to wsTypes.ts

- `Suit`, `Rank`, `Card`
- `PlayerAction`
- `WinnerHandRank`, `WinnerResult`
- `TableState`, `SeatInfo`, `YouState`
- `ServerClockAnchor`, `PokerTableView`
- `AddChipsWaitResult`

## Unchanged

- Public API preko `./ws` (barrel re-export)
- Svi consumer importi `from './ws'`
- `usePokerWs` runtime, validators, helpers, pending logic
- WS URL, payloads, error tekstovi

## Not touched

- 5b/5c fajlovi, consumers, server, vault, env, package, CSS

## Build

```bash
npm run build --prefix solana/web
```

**Log:** `frontend-build-pass-5a.log`

## QA watchlist (Phase 5, not 5a scope)

- `add-chips flow` — proveriti pre/posle 5c
- Pre-existing: countdown silent state, stand server timer, sit recovery UI

## Git

- **Commit:** NOT made
- **Push:** NOT done
