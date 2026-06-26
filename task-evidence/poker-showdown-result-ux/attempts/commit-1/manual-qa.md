# Manual QA — poker-showdown-result-ux (commit-1 interim basis)

Task: showdown result UX — Rank ruke, pobednička ruka i countdown
Branch/task name: `feature/poker-showdown-result-ux`
Status: PARTIAL
Executed scenarios: PASS

## Preconditions

- Poker server: `npm run poker:server` (port 3081)
- Frontend: `npm run solana:web` (port 5173)
- Dev vault check disabled on poker server: `POKER_SKIP_VAULT_CHECK=1`
- Dev vault check disabled on frontend: `VITE_POKER_SKIP_VAULT_CHECK=1`
- Manual QA executed with two browser profiles / two distinct wallet player IDs

## Scenarios verified

### 1. Normalan showdown sa dva klijenta

Result: PASS

- Oba klijenta vide pobednika.
- Oba klijenta vide rank/naziv kombinacije.
- Winner seat highlight radi.
- Countdown radi.
- Nova ruka počinje posle result perioda.

### 2. Fold win sa dva klijenta

Result: PASS

- Oba klijenta vide pobednika i iznos.
- Nema `handRank`.
- Protivničke karte nisu otkrivene.
- Result ostaje vidljiv oko 5 sekundi.

### 3. Refresh/F5 tokom countdown-a

Result: PASS

- Isti winner/result posle refresh-a.
- Countdown se ne resetuje na novih 5 sekundi.

### 4. Waiting igrač

Result: PASS

- Igrač seda sa 100 tokom postojeće ruke.
- Dodaje još 100.
- Ne ulazi u trenutnu ruku.
- U sledeću ruku ulazi sa ukupno 200.

### 5. Side-pot / same-player multi-pot prikaz

Result: PASS

- Main pot 60 + side pot 350.
- Grouped winner total 410.
- Per-pot detalji sačuvani.

### 6. HU oba-all-in

Result: PASS

- Rezultat, winner, rank i countdown rade.
- Svih 5 board karata pojavljuje se odjednom.
- Provereno da je to postojeće očekivano engine ponašanje za HU oba-all-in, nije showdown result UX regresija.
- Korisnik potvrđuje da ponašanje ostaje.

### 7. Mobilni/uzak prikaz sa dva igrača

Result: PASS

- Result panel nije isečen.
- Winner i countdown su vidljivi.

### 8. Cleanup posle result perioda

Result: PASS

- Stari result panel nestaje.
- Winner highlight nestaje.
- Sledeća ruka normalno počinje.

## Status

**Status: PARTIAL**

Trenutna implementacija i izvršeni manual QA scenariji su prošli, ali task još nije završen i potrebne su dodatne dorade i provere pre finalnog prihvatanja.

Izvršeno je 8/8 manualnih scenarija; svi su prošli.
