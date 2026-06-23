# Manual QA — Showdown server clock anchor

**Task:** poker showdown result UX (server clock anchor commit)  
**Branch:** `feature/poker-showdown-result-ux`  
**Status:** PASS  
**Date verified:** 2026-06-23 (korisnički potvrđeno)

## Preconditions

- `npm run poker:server` — WS na `:3081`
- `npm run solana:web` — Vite na `:5173`
- Dva Chrome profila / wallet-i sa vault chip-ovima (ili `SKIP_VAULT_CHECK` u dev env-u)
- Commit-5 implementacija u glavnom worktree-u (necommitovano u trenutku QA-a)

## Scenarios verified

| # | Scenario | Expected | Result | Notes |
|---|----------|----------|--------|-------|
| 1 | **HU showdown** | Glatka countdown traka; usklađene sekunde na oba profila; winner/rank panel; normalan kraj result perioda | **PASS** | Countdown glatko radi; oba profila imaju približno iste sekunde |
| 2 | **Fold rezultat** | Countdown; winner panel; bez rank teksta; normalan kraj | **PASS** | Nema rank teksta za fold pobedu |
| 3 | **F5 tokom showdown i fold result perioda** | Bez reset-a na punih 5s; countdown nastavlja od preostalog vremena posle reconnect-a | **PASS** | Posle F5 kratko se vidi prazan/default sto dok WS snapshot ne stigne; snapshot zatim popuni sto, result panel se vrati, countdown nastavlja — **poznati reconnect/loading prelaz, ne bug clock-anchor flow-a** |
| 4 | **Mobilni viewport** | Countdown bar, tekst i winner/result panel čitljivi; bez preklapanja | **PASS** | F5 na mobilnom takođe PASS |
| 5 | **`Date.now()` override tokom countdown-a** | Countdown ne sme skočiti niti se resetovati | **PASS** | Izvršeno: `const real = Date.now; Date.now = () => real() + 6000` — countdown nije skočio niti resetovan |
| 6 | **Background / minimize prozora** | Normalan prikaz posle povratka; countdown/result flow ispravan | **PASS** | Posle minimizacije/smanjenja prozora i povratka sve normalno |
| 7 | **Mid-result add-chips / nova table poruka** | Countdown se ne resetuje; result panel ostaje | **PASS** | Kliknuto „Dopuni chipove" tokom result perioda; sa skip-vault dopuna primljena i važi od sledeće ruke; countdown i panel ostali stabilni |
| 8 | **Stari server bez `serverNow` (worktree `e52f212`)** | Result/winner panel vidljiv; countdown bar i tekst skriveni; console warning | **PASS** | Privremeni worktree na `e52f212` za stari poker server; novi frontend iz glavnog worktree-a. Warning: `Invalid or missing serverNow during result display`. Worktree cleanup uspešan (junction ReparsePoint potvrđen, `rmdir` uklonio junction, `Test-Path node_modules = False`, `git worktree remove` uspešan) |

## QA notes

- **Scenario 3:** Kratki prazan sto posle F5 pre WS snapshot-a je očekivani reconnect prelaz, ne regresija clock-anchor implementacije.
- **Scenario 5:** Test sa **+6000 ms** offset na `Date.now()` — potvrđuje da countdown ne zavisi od wall clock-a posle anchor prijema.
- **Scenario 7:** Real Vault transakcija pred kraj result perioda može imati poseban add-chips/Vault timing — **van scope-a** ovog commita; skip-vault flow PASS.
- **Scenario 8:** NTFS junction ka glavnom `poker/node_modules`; bez `npm install`; env `$env:POKER_SKIP_VAULT_CHECK='1'` inline; glavni `npm run poker:server` ugašen tokom worktree QA-a.

## Known residual risks / out of scope

- Real Vault add-chips timing tokom result perioda — budući QA task
- Sleep/wake i background tab rAF pauza — dokumentovan mali vizuelni rizik
- ms razlika countdown teksta između dva fizička klijenta — prihvaćena (per-connection `serverNow`)
- `RebuyGraceBar` — nezavisna komponenta, nije dirana
- `room.ts` lifecycle — nepromenjen

## Verdict

**Overall:** PASS **8/8**
