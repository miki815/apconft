# Phase 2 — PokerPlay helper/type cleanup

**Status:** **ACCEPTED** (2026-06-24)  
**Date:** 2026-06-24  
**Initiative:** FE clean-code refactor (`solana/web`)  
**Prior phase:** Phase 1 ACCEPTED (presentation extraction)

Same MR: **two commits** — (1) helper/type cleanup Full minus countdown; (2) countdown helper extract follow-up.

---

## Commit 1 — Approved scope: Full minus countdown

### In scope (done)

| Item | Target |
|------|--------|
| Shared types | `poker/types.ts` — `SitRecoveryState`, `WinnerGroup`, `RaiseBounds` |
| `groupWinners` | `poker/winners.ts` |
| `potLabel` export | `poker/pots.ts` (export existing function) |
| `PokerWinnerBanner` | Remove `potLabel` prop; direct import from `./pots` |
| `computeRaiseBounds` | `poker/betting.ts`; parent keeps `useMemo` wrapper |
| `canStart` typing | Narrow prop to `boolean`; wrap compute with `Boolean(...)` |
| Countdown | Deferred to follow-up commit in same MR |

### Commit 1 files

**New:** `types.ts`, `winners.ts`, `betting.ts`  
**Modified:** `pots.ts`, `PokerPlay.tsx`, `PokerControlsPanel.tsx`, `PokerHeroBar.tsx`, `PokerWinnerBanner.tsx`

---

## Commit 2 — Follow-up: countdown helper extract (refactor only)

**Status:** **ACCEPTED** (2026-06-24) — refactor smoke PASS; no behavior change.

### In scope (done)

| Item | Target |
|------|--------|
| `computeResultCountdownState` | `showdown.ts` — 1:1 move of inline derivacija iz `PokerPlay.tsx` |
| `PokerPlay.tsx` | Poziv helper-a; isti JSX render branch za `ShowdownBar` / fallback |

### Commit 2 files

**Modified:**
- `solana/web/src/poker/showdown.ts` — `computeResultCountdownState(table, resultPhase)`; koristi `isValidShowdownEndsAt`, `isValidResultDurationMs`, `isValidClockAnchor` iz `ws.ts`
- `solana/web/src/poker/PokerPlay.tsx` — destructuring `{ resultEndsAt, resultDurationMs, countdownReady, showDeadlineFallback }`; uklonjeni direktni validator importi

**Unchanged:** `ShowdownBar.tsx`, `ws.ts`, fallback tekst, countdown timing/guards/props.

### Out of scope (commit 2 — unchanged)

- 🐞 Silent third state / missing `clockAnchor` fallback fix
- `PokerSeat` derivations
- Phase 3+

---

## Out of scope (whole Phase 2 MR)

- Pre-existing countdown gap fix (silent third state)
- `ws.ts` split, Vault/IDL/PDA, `App.tsx`, `index.css`, `vite-env.d.ts`, env/package/backend/Anchor
- Phase 3+ (`usePokerSeating`, handlers, effects)

## Invariants preserved

- `groupWinners`, `potLabel`, `computeRaiseBounds`, `canStart` — unchanged from commit 1
- `computeResultCountdownState`: 1:1 copy former inline logic; same validators; same render branch
- Countdown behavior, timing, guards, prop values — **unchanged** (refactor only)

## Verification

- Build (commit 1): PASS — initial run `index-CI_dlpNz.js`, ~20.52s
- Build (commit 2 / final): **PASS** — `frontend-build-pass.log` (raw log, `index-Dneo6d2t.js`, ~24.04s)
- Manual QA commit 1: **PASS — ACCEPTED** (`manual-qa.md` § User manual QA results)
- Manual QA commit 2: **PASS — ACCEPTED** (`manual-qa.md` § Countdown helper extract smoke)

## Acceptance notes (commit 1)

- 2-player: winner banner `Glavni pot` +970
- 3-player side pot: breakdown `Glavni pot 600`, `Side pot 1 360`
- 3-player split/tie: 3 winner cards; `Glavni pot +200` all; `Side pot 1 +5` for two
- Raise slider: min 20, max 200, `Raise 20` label
- Skip-vault dev flow; vault production path not tested

## Acceptance notes (commit 2 — countdown smoke)

- Countdown bar: `Sledeća ruka za Ns` visible
- Winner banner works alongside countdown
- Lifecycle continues normally after countdown
- Silent third state **not tested** — remains van scope-a

## Next (deferred)

- 🐞 Separate fix: silent third state (valid deadline + missing `clockAnchor`)
- Phase 3: `usePokerSeating` / handler hooks
- `PokerSeat` derivations micro-cleanup
