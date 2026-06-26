# Manual QA — Commit 1 / Phase 1

**Task:** fe-clean-code-refactor — presentation extraction (Commit 1)  
**Overall status:** **PARTIAL — ACCEPTED** (2026-06-24)  
**Build:** PASS — `frontend-build-pass.log`

**Acceptance decision:** Korisnik prihvatio Commit 1 sa PARTIAL manual QA scope-om. Presentation smoke PASS; `Ustani` nalaz out-of-scope; full 2-player E2E / vault lock path nisu obavezni za Commit 1.

**Test env:** `POKER_SKIP_VAULT_CHECK=1` + `VITE_POKER_SKIP_VAULT_CHECK=1` (sit flow spot check)

---

## Ručno provereno — PASS

### Services

- [x] `npm run poker:server` — WebSocket server startuje
- [x] `npm run solana:web` — Vite dev server startuje
- [x] Aplikacija se otvara u browseru

### Wallet

- [x] Phantom wallet connect radi
- [x] Player id u status baru posle connect-a

### Status bar

- [x] LIVE pill + wallet id prikazani kada je WS povezan
- [ ] Blinds pri `handInProgress` — nije eksplicitno zabeleženo u ovoj sesiji

### Table and seats

- [x] Poker table se renderuje
- [x] 6 seats vidljivo
- [x] Seat select radi; menja labelu `Sedni · mesto N`

### Buy-in and sit

- [x] Buy-in input radi
- [x] Max dugme radi
- [x] Sit flow radi sa skip-vault (`POKER_SKIP_VAULT_CHECK=1`)

### Hero bar

- [x] Hero karte se prikazuju
- [x] Hero action buttons se prikazuju kad je akcija dostupna
- [x] Raise slider se prikazuje

### Post-hand UI

- [x] Showdown UI se prikazuje
- [x] ShowdownBar countdown radi
- [x] Winner banner — iznosi + hand rank prikazani

### Vault tab (cross-tab smoke)

- [x] Vault tab se prikazuje
- [x] Balance prikaz radi

---

## Known out of scope / NOT BLOCKING

### Stand (`Ustani`) spot check

| Polje | Vrednost |
|-------|----------|
| **Status** | **Observed — not Commit 1 regression** |
| **Poruka** | `Cannot leave during a hand` |
| **Zaključak** | Stand/Ustani flow je poznato nedovršen van ovog taska. Commit 1 nije menjao `handleStand`, `ws.ts`, backend, Vault release flow niti server stand pravila. **Ne blokira Commit 1 acceptance.** |
| **Referenca** | [Project doc — Stand flow](https://docs.google.com/document/d/19weKn4S_3-3lXluVN1II5qk229RqMmFXITElISwVanU/edit?tab=t.0) |

---

## Not run / deferred (not blocking Commit 1)

- [ ] Full 2-player E2E — deferred (kasnije faze)
- [ ] Sit recovery scenario — nije reprodukovan
- [ ] RebuyGraceBar scenario — nije posebno reprodukovan
- [ ] Error panel — WS/server down scenario nije posebno reprodukovan
- [ ] Sit sa uključenim vault lock/release (production vault path)
- [ ] Blinds u status baru — nije eksplicitno potvrđeno

---

## Checklist ostatak (detalj)

| Oblast | Status | Napomena |
|--------|--------|----------|
| Sit button disabled/enabled matrica | PARTIAL | Sit PASS sa skip-vault; puna disabled matrica nije tabeleirana |
| Hero Fold/Check/Call/Bet/Raise/All-in akcije | PARTIAL | Dugmad + slider prikaz PASS; svaka akcija nije pojedinačno logovana |
| Controls `txMsg` | NOT LOGGED | Nije posebno zabeleženo |
| Nova ruka `canStart` | NOT LOGGED | Nije posebno zabeleženo |
| Offline pill / reconnect | NOT RUN | |

---

## Notes

| Item | Value |
|------|-------|
| Tester | korisnik (ručno) |
| Vault check | OFF (skip-vault) za sit |
| Commit 1 acceptance | **ACCEPTED** (PARTIAL scope) |
| Phase 2 | not started — awaits user approval |

---

## Full 2-player E2E

Not required for Commit 1 acceptance; recommended before Phase 3 (`usePokerSeating` hook).
