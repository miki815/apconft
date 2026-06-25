# Manual QA — Phase 3 (usePokerSeating)

**Task:** fe-clean-code-refactor — Phase 3 usePokerSeating hook  
**Overall status:** **PASS — ACCEPTED for Phase 3 minimum QA**  
**Build:** PASS — `frontend-build-pass.log` (461 modules, ~20.28s)  
**Tester:** user (browser)  
**Date:** 2026-06-24

---

## Pre-commit verification (agent)

| Check | Result | Raw log? |
|-------|--------|----------|
| `npm run build --prefix solana/web` | PASS | **Yes** — `frontend-build-pass.log` |

---

## User manual QA checklist

### Services

- [x] `npm run poker:server` — WS on `:3081`
- [x] `npm run solana:web` — `:5173`

### Core seating

- [x] Poker tab load
- [x] Wallet connect (Phantom)
- [x] Seat select (6 seats, `Sedni · mesto N`)
- [x] Buy-in input + Max dugme
- [x] Sit flow (2 profiles, different wallets)

### Add chips

- [x] Add chips (between / during hand as reachable in session)

### Stand

- [x] Stand during result timer — pre-existing `Cannot leave during a hand` (not Phase 3 regression)
- [x] Stand between hands — covered where server allows (see C notes)

### Sit recovery (best-effort)

- [ ] Recover locked chips UI — **SKIP** (hard to reproduce)

### Skip-vault minimum

Env: `VITE_POKER_SKIP_VAULT_CHECK=1` + `POKER_SKIP_VAULT_CHECK=1`

- [x] Sit without lock tx
- [x] Basic play smoke

### Production vault (best-effort)

- [ ] Deposit → vault balance → sit with Phantom lock — **SKIP** (not in this QA round)
- [ ] Stand with release when server allows — **SKIP**

### Regression smoke (Phase 2 surfaces)

- [x] Hero actions (fold/check/call/raise)
- [x] Countdown bar after hand
- [x] Winner banner labels
- [x] Refresh vault after sit/stand

---

## Out of scope — do not fail Phase 3 for these

- Countdown silent third state
- Stand during result timer / active hand server rules + auto-start after showdown
- Phase 4–6

---

## Results

| Area | PASS / FAIL / SKIP | Notes |
|------|-------------------|-------|
| A Osnovni smoke | PASS | Poker tab load, wallet connect, seat select, buy-in/Max, 2 profila, ruka, hero actions, countdown, winner banner |
| B Skip-vault | PASS | `POKER_SKIP_VAULT_CHECK=1`; sit/play smoke bez lock/release potpisa |
| C Seating | PASS with known SKIP | Zauzeto mesto PASS; buy-in clamp PASS; add chips PASS; stand tokom timer-a vraća pre-existing `Cannot leave during a hand` |
| D Production vault | SKIP | Best-effort, nije rađeno u ovom QA krugu |
| E Recovery | SKIP | Best-effort, teško reprodukovati |
| F Regresija | PASS | Countdown/winner/banner smoke PASS; refresh vault PASS |

**Final verdict:** **PASS — ACCEPTED for Phase 3 minimum QA**
