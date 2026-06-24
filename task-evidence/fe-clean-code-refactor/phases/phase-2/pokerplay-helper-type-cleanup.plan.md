# Phase 2 — PokerPlay helper/type cleanup

**Status:** **ACCEPTED** (2026-06-24)  
**Date:** 2026-06-24  
**Initiative:** FE clean-code refactor (`solana/web`)  
**Prior phase:** Phase 1 ACCEPTED (presentation extraction)

## Approved scope: Full minus countdown

### In scope (done)

| Item | Target |
|------|--------|
| Shared types | `poker/types.ts` — `SitRecoveryState`, `WinnerGroup`, `RaiseBounds` |
| `groupWinners` | `poker/winners.ts` |
| `potLabel` export | `poker/pots.ts` (export existing function) |
| `PokerWinnerBanner` | Remove `potLabel` prop; direct import from `./pots` |
| `computeRaiseBounds` | `poker/betting.ts`; parent keeps `useMemo` wrapper |
| `canStart` typing | Narrow prop to `boolean`; wrap compute with `Boolean(...)` |
| Countdown | **Not extracted** — stays inline in `PokerPlay.tsx` |

### Out of scope (unchanged)

- `computeResultCountdownState` / countdown helper extract
- Pre-existing countdown gap fix
- `PokerSeat` derivations
- Phase 3+ (`usePokerSeating`, handlers, effects)
- `ws.ts` split, Vault/IDL/PDA, `App.tsx`, `index.css`, `vite-env.d.ts`, env/package/backend/Anchor

## Files changed

### New

- `solana/web/src/poker/types.ts`
- `solana/web/src/poker/winners.ts`
- `solana/web/src/poker/betting.ts`

### Modified

- `solana/web/src/poker/pots.ts` — `export function potLabel`
- `solana/web/src/poker/PokerPlay.tsx` — imports; removed local types/helpers; `Boolean(canStart)`; no `potLabel` prop
- `solana/web/src/poker/PokerControlsPanel.tsx` — import `SitRecoveryState`; `canStart: boolean`
- `solana/web/src/poker/PokerHeroBar.tsx` — import `RaiseBounds` from `./types`
- `solana/web/src/poker/PokerWinnerBanner.tsx` — import `WinnerGroup`, `potLabel`; removed prop

## Invariants preserved

- `groupWinners`: Map insertion order for groups; per-group wins sorted by `potIndex`
- `potLabel`: identical strings (`Glavni pot` / `Side pot N`)
- `computeRaiseBounds`: 1:1 copy of former `useMemo` body
- `canStart`: `Boolean(...)` — `undefined`/falsy still disables Nova ruka (same disabled behavior)
- Countdown logic unchanged in parent (L129–136 area)

## Verification

- Build: `npm run build --prefix solana/web` — **PASS** (`frontend-build-pass.log`, raw log)
- Manual QA: **PASS — ACCEPTED** (`manual-qa.md`); item 8 (Nova ruka enabled) SKIP — acceptable
- Preview / WS / linter: smoke notes only in `manual-qa.md`; no separate raw logs

## Acceptance notes

- 2-player: winner banner `Glavni pot` +970
- 3-player side pot: breakdown `Glavni pot 600`, `Side pot 1 360`
- 3-player split/tie: 3 winner cards; `Glavni pot +200` all; `Side pot 1 +5` for two
- Raise slider: min 20, max 200, `Raise 20` label
- Skip-vault dev flow; vault production path not tested
- Countdown visible but not Phase 2 scope

## Next (deferred)

- Separate small commit: countdown helper extract + optional gap fix
- Phase 3: `usePokerSeating` / handler hooks
- `PokerSeat` derivations micro-cleanup
