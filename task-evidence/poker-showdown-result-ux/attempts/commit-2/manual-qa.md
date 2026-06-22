# Manual QA — poker-showdown-final-runout-update-fix (commit-2)

Task: Task 9 commit-2 — final staged-runout terminal snapshot fix
Branch/task name: `feature/poker-showdown-result-ux`
Status: PASS
Date: 2026-06-22

## Preconditions

- Poker server: `npm run poker:server` (port 3081) — restartovan na aktuelnom kodu
- Frontend: `npm run solana:web` (port 5173) — restartovan na aktuelnom kodu
- Dev vault check disabled on poker server: `POKER_SKIP_VAULT_CHECK=1`
- Dev vault check disabled on frontend: `VITE_POKER_SKIP_VAULT_CHECK=1`
- QA izvršen sa skip flagovima — **nije** testiran pun Phantom/Vault lock-release flow

## Scenarios verified

### A. HU 2-player staged locked runout

Result: **PASS**

**Setup:**

- 2 Chrome profila, 2 različita Phantom wallet-a
- Profil A: seat 0, buy-in **500** (deep stack)
- Profil B: seat 1, buy-in **100** (short stack)
- Short igrač (B) all-in; deep igrač (A) call — A ostaje sa čipovima
- **Nije** scenario gde su oba igrača all-in

**Očekivano i stvarno ponašanje:**

- Board prikazan **3 → 4 → 5** sa vidljivim pauzama između ulica (~`RUNOUT_STREET_MS`)
- Posle rivera: odmah result panel, winner, rank i countdown — bez perioda bez Task 9 UI
- Oba profila vide isti board, winner, rank i countdown
- Posle countdown-a (~5s): cleanup result UI i auto-next ruka

---

### B. Pravi 3-player in-hand staged locked runout

Result: **PASS**

**Setup (multi-hand):**

- 3 Chrome profila, 3 različita Phantom wallet-a
- Dva postojeća igrača (A i B) bila su u **prethodnoj ruci**
- Novi, treći igrač seo je sa **50** i **čekao sledeću ruku**
- Prethodna ruka je završena
- Posle result perioda i auto-next flow-a sva tri igrača učestvovala su u **sledećoj ruci**

**Trenutni stackovi u testiranoj ruci (približno):**

- Novi igrač: **50**
- Igrač A: **165**
- Igrač B: **220**

**Do locked runout-a u testiranoj ruci:**

- Igrač A sa ~**165** — all-in
- Igrač B sa ~**220** — call; ostao **active** sa preostalim čipovima
- Novi igrač sa ~**50** — all-in
- Rezultat: **jedan active igrač** i **dva all-in igrača**

**Očekivano i stvarno ponašanje:**

- Board prikazan **3 → 4 → 5** sa pauzama između ulica
- Prikazani main pot i side pot rezultati
- Payout i hand rank ostali vezani za odgovarajući pot
- Posle rivera: odmah result panel, winner, rank i countdown na sva tri profila
- Sva tri klijenta vide isti rezultat i countdown
- Posle countdown-a: cleanup i auto-next ruka

---

## QA notes

- Oba obavezna commit-2 scenarija potvrđena kao PASS od strane korisnika.
- QA pokriva server-only fix (jedan kompletan terminalni snapshot posle staged river koraka).
- Countdown tekst i dalje koristi formulaciju „Sledeća ruka za Ns“ — to **nije** failure ovog commit-2 testa.

## Known residual risks / out of scope

- **Countdown copy:** promena teksta u „Nastavak za Ns“ je posebna buduća dorada (#7), van commit-2 scope-a.
- **Vault E2E:** ovaj QA nije pokrenuo pravi on-chain lock/release flow (skip flagovi uključeni).
- **Reconnect:** nije eksplicitno testiran u ovom manual QA setu.
- **Pravi Phantom/Vault flow** za staged runout: nije pokriven ovim QA korakom.
