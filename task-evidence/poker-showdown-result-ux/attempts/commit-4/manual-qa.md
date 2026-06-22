# Manual QA — Commit-4 (smooth countdown bar #8)

**Status:** PASS — korisnički potvrđeno  
**Date prepared:** 2026-06-22  
**Date verified:** 2026-06-22  
**Branch:** `feature/poker-showdown-result-ux`  
**Scope:** `solana/web/src/poker/ShowdownBar.tsx` only

## Preduslov

- `npm run poker:server` — WS na `:3081`
- `npm run solana:web` — Vite na `:5173`
- Dva Chrome profila / wallet-i sa vault chip-ovima (ili `SKIP_VAULT_CHECK` ako je dev env tako podešen)

## Scenariji

| # | Scenario | Expected | Result | Notes |
|---|----------|----------|--------|-------|
| 1 | HU check-down **showdown** | Progress bar glatko opada; sekundni tekst tačan; bez 200 ms skokova | **PASS** | Winner i rank prikazani; countdown linija glatka na oba klijenta |
| 2 | **Fold** rezultat | Isto ponašanje countdown trake | **PASS** | „Rezultat ruke“ i pobednik prikazani; nema izmišljenog ranka; linija glatka |
| 3 | **F5** u prvih 1–2 s **showdown** countdown-a | Remaining prati server `showdownEndsAt`; nema lokalnog reset-a na punu dužinu | **PASS** | Countdown se nije resetovao; delimična linija nastavila glatko |
| 4 | **F5** u prvih 1–2 s **fold** countdown-a | Isto | **PASS** | Countdown se nije resetovao; rezultat normalno završen |
| 5 | **Mobilni viewport** | Traka i tekst čitljivi; animacija glatka | **PASS** | Fold i showdown prikaz čitljivi; nema preklapanja; linija glatka; dodatni F5 na mobilnom takođe PASS |

## Kratko `0s` ponašanje (referenca)

- `Math.ceil(remainingMs / 1000) === 1` za `remainingMs` 1–1000
- `0s` prikaz **samo** kada `remainingMs === 0`

## Verdict

**Overall:** PASS **5/5**
