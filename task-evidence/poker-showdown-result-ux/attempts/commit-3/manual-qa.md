# Manual QA — remove-orphan-showdown-ms (commit-3)

Task: Uklanjanje neiskorišćene frontend SHOWDOWN_MS konstante
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

### HU check-down showdown smoke

Result: **PASS**

**Setup:**

- 2 Chrome profila, 2 različita Phantom wallet-a
- Oba igrača sede za sto

**Stvarni tok:**

- **Preflop:** prvi igrač **Call**, drugi **Check**
- **Flop:** oba **Check**
- **Turn:** oba **Check**
- **River:** oba **Check** → auto showdown

**Očekivano i stvarno ponašanje:**

- Prikazan **„Showdown rezultat“**
- Prikazani **pobednik** i **naziv/rank ruke**
- **Countdown** radio oko **5 sekundi**
- **Result UI** se očistio posle countdown-a
- **Auto-next** pokrenuo sledeću ruku

---

## QA notes

- Jedini obavezan manual smoke za commit-3: **PASS 1/1**
- Cleanup ne menja runtime ponašanje — smoke potvrđuje da showdown result UX i dalje radi posle uklanjanja orphan konstante
- Pun Vault/Phantom lock-release flow **nije** testiran (skip flagovi uključeni)

## Known residual risks / out of scope

- **Vault E2E:** ovaj QA nije pokrenuo pravi on-chain lock/release flow
- **Poker unit testovi:** nisu pokrenuti — nema izmena u poker paketu
