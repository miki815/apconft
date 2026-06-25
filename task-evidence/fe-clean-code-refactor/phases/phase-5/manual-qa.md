# Manual QA — Phase 5 (Commits 5a + 5b + 5c)

**Task:** fe-clean-code-refactor — Phase 5 ws.ts split  
**5a status:** PASS — committed `ee90b78`  
**5b status:** PASS — committed `142e581`  
**5c status:** PASS — manual browser QA complete  
**Date:** 2026-06-24

---

## QA setup (5c)

| Item | Value |
|------|-------|
| Poker server | `:3081` |
| Frontend | `http://localhost:5173` |
| Skip-vault | `POKER_SKIP_VAULT_CHECK=1`, `VITE_POKER_SKIP_VAULT_CHECK=1` |
| Scope | WS-only smoke QA |
| Production vault lock/release | **Not tested** — not required for 5c acceptance |

---

## Commit 5c browser QA checklist

Skip-vault **UKLJUČEN** — WS-only smoke.

### WS connect / lifecycle

- [x] Poker tab load — PASS
- [x] Wallet / app load — PASS
- [x] WS connected / table loaded — PASS
- [x] Console clean — PASS
- [x] Tab switch Poker ↔ Vault ↔ Poker — PASS (nema console warning-a)
- [x] Page reload / reconnect / join — PASS
- [x] Console nakon QA — clean

### Gameplay smoke

- [x] Sit smoke — PASS
- [x] Hero action / gameplay smoke — PASS
- [x] Table update visible (pot, seats, action seat) — PASS

### Showdown / countdown (validatori iz 5b)

- [x] Showdown / countdown smoke (2 igrača do kraja ruke) — PASS
- [x] Countdown/progress linija se učitava i nastavlja smooth — PASS

### Add-chips (watchlist — obavezno za 5c)

- [x] Add-chips flow — PASS
  - Jedan klik `+100` tokom ruke → sledeća ruka stack povećan za `+100`
  - Dva klika `+100` tokom ruke → sledeća ruka stack povećan za `+200`
  - Nema dokaza o duplom slanju na jedan klik
  - Eventualni debounce / disable UX je **future UX ASK**, nije 5c blocker

### Not in 5c scope — do not FAIL 5c for

- Countdown silent third state (pre-existing — nije testiran kao blocker)
- Stand server timer (pre-existing — nije testiran kao blocker)
- Sit recovery UI (pre-existing — nije testiran kao blocker)
- Production vault lock/release (optional — nije deo 5c acceptance-a)

**5c verdict:** **PASS** — spreman za commit odluku nakon provere git statusa

---

## Prior commits (reference)

- 5a/5b: build-only QA sufficient at commit time
- 5c: full browser WS QA **PASS** (2026-06-24)
