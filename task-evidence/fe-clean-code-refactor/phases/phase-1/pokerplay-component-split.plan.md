# Commit 1 / Phase 1 — Presentation extraction

**Status:** **ACCEPTED** (2026-06-24)

**Acceptance:** PARTIAL manual QA scope — presentation smoke PASS; Stand/Ustani out of scope; full 2-player E2E and vault lock sit path deferred.

## Scope

Extract presentation/UI from `PokerPlay.tsx` into:

| Component | Role |
|-----------|------|
| `PokerStatusBar.tsx` | Live/Offline, player id, blinds |
| `PokerTableVisual.tsx` | Table visual, board, pot, seats wrapper |
| `PokerSeat.tsx` | Single seat render + pick callback |
| `PokerHeroBar.tsx` | Hole cards + action buttons (props/callbacks) |
| `PokerWinnerBanner.tsx` | Post-hand winner display |
| `PokerControlsPanel.tsx` | Buy-in/sit/stand/start controls UI |

## Unchanged in parent (`PokerPlay.tsx`)

- All handlers: `handleSit`, `handleStand`, `handleAddChips`, `handleRecoverLockedChips`
- `handleBuyInChange` (buy-in input clamp)
- `groupWinners`, `potDisplay`, `raiseBounds`, `countdownReady` computation
- `usePokerWs`, vault hooks, IDL fetch, all `useEffect` / business state

## Not touched

`ws.ts`, vault files, `App.tsx`, `index.css`, `vite-env.d.ts`, env, package files, backend.

## Verification

- Build: `npm run build --prefix solana/web` — **PASS** (`frontend-build-pass.log`)
- Manual QA: **PARTIAL — ACCEPTED** (`manual-qa.md`)

## Cleanup applied (Commit 1)

- Removed unused `SEAT_POS` from `PokerPlay.tsx` (active copy in `PokerTableVisual.tsx`)
- `import type { PublicKey }` in `PokerControlsPanel.tsx`
- Type duplicates (`SitRecoveryState`, `WinnerGroup`) deferred to Phase 2

## Next

- **Phase 2:** not started — awaits separate user approval
- Deferred QA: full 2-player E2E, vault lock sit path, sit recovery, RebuyGraceBar, Stand flow (separate task)
