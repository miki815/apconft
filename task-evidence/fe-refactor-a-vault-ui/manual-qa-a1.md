# A1 — Manual QA

**Datum:** 2026-06-27  
**Faza:** A1 — pure helper extract (`vaultAmount.ts`)  
**Verdict:** **PASS** (korisnik potvrđen)

---

## Preduslov

- Frontend: `npm run solana:web` — **PASS**
- Poker server: nije potreban za A1 Vault smoke

---

## Env / QA napomene

- **Deposit:** nije testiran — van A1 scope-a
- **Withdraw:** nije testiran — van A1 scope-a
- **Kreiraj token ATA:** nije testiran — van A1 scope-a
- **Poker lock/release E2E:** nije testiran — van A1 scope-a
- **Skip-vault:** ne utiče na A1 Vault UI smoke (`VaultPlay` ne čita `SKIP_VAULT`)
- Build: **PASS** — `frontend-build-pass-a1-1-of-1.log` (prethodno pokrenut)

---

## Rezultati (korisnik potvrđen)

| # | Scenario | Rezultat |
|---|----------|----------|
| 1 | Frontend start / app load | **PASS** |
| 2 | Vault tab render | **PASS** |
| 3 | Bez walleta — balansi / disabled dugmad | **PASS** |
| 4 | Poker ↔ Vault tab switch | **PASS** |
| 5 | Prazan mint — nema crash-a | **PASS** |
| 6 | Nevalidan mint — nema crash-a | **PASS** |
| 7 | Wallet connect + Osveži balance refresh | **PASS** |
| 8 | Mobile viewport ≤560px | **PASS** |

---

## Van A1 acceptance-a (eksplicitno nije testirano)

| Scenario | Status |
|----------|--------|
| Deposit | **Nije testirano** |
| Withdraw | **Nije testirano** |
| Kreiraj token ATA | **Nije testirano** |
| Poker lock/release E2E | **Nije testirano** |

---

## Acceptance zaključak

Tokom manual browser smoke QA **nije uočena vizuelna regresija** u gore navedenim scenarijima.

**Manual QA: PASS** (korisnik potvrđen).

**A1 verifikacija:** implementirana + build PASS + manual QA PASS — **pending commit**.
