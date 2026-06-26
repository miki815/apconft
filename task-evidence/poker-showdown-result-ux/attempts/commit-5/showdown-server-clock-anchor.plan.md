# Showdown server clock anchor

**Branch:** `feature/poker-showdown-result-ux`  
**Base commit:** `e52f212` (smooth countdown bar)  
**Scope:** server `serverNow` u `table` WS poruci + frontend monotoni `performance.now()` anchor

## Problem

Countdown bar koristi `Date.now()` za remaining prema server `showdownEndsAt`. Wall-clock skew, DevTools override i reconnect bez svežeg server vremena mogu dati pogrešan remaining ili reset osećaj.

## Rešenje

1. **Server:** `hub.sendTableTo` dodaje obavezno `serverNow: number` (svež `Date.now()` po konekciji) u svaku `table` poruku preko `buildTableMessage`.
2. **Frontend:** `ws.ts` validira `serverNow`, postavlja `clockAnchor { serverNow, receivedAtPerformanceNow }` sinhrono u `onmessage`.
3. **ShowdownBar:** računa `effectiveServerNow = serverNow + (performance.now() - receivedAtPerformanceNow)` — bez `Date.now()`.
4. **PokerPlay:** `countdownReady` gate; invalid/missing `serverNow` sakriva bar i tekst, result panel ostaje.

## Menjani fajlovi

| Fajl | Izmena |
|------|--------|
| `poker/src/protocol.ts` | `serverNow: number` na `table` grani `ServerMessage` |
| `poker/server/hub.ts` | `export buildTableMessage`; `sendTableTo` prosleđuje svež `Date.now()` |
| `poker/server/hub.test.ts` | **novi** — deterministic assert tačnog prosleđenog `serverNow` |
| `poker/package.json` | `hub.test.ts` u postojećoj `test` listi |
| `solana/web/src/poker/ws.ts` | validatori, `clockAnchor`, warning ref po WS instanci |
| `solana/web/src/poker/PokerPlay.tsx` | `countdownReady`, `showDeadlineFallback` |
| `solana/web/src/poker/ShowdownBar.tsx` | rAF + `tickPerf`; monotoni anchor math |

## Nije dirano

- `poker/server/room.ts` — lifecycle, `SHOWDOWN_MS`, `finishHand`
- poker engine (`poker/src/` osim `protocol.ts`)
- CSS, env, package-lock, dependencies
- `RebuyGraceBar`
- `APCONFT_PROJECT_REFERENCE.md` (lokalni exclude)

## Guards

| Uslov | Countdown bar | Fallback tekst | Result panel |
|-------|---------------|----------------|--------------|
| Valid deadline + valid anchor | Da | Ne | Da |
| Valid deadline + invalid/missing `serverNow` | Ne | Ne | Da |
| Invalid/missing `showdownEndsAt` ili `resultDurationMs` | Ne | Da („Čeka se server deadline.") | Da |
| `resultKind === null` | Ne | Ne | Ne |

Invalid/missing `serverNow` tokom result perioda: `console.warn` max jednom po `showdownEndsAt` po WS instanci.

## Automatska verifikacija

| Provera | Status | Log |
|---------|--------|-----|
| `git diff --check` | PASS — samo CRLF upozorenja, bez whitespace grešaka | — |
| `npm run poker:test` | **100/100 PASS** | `poker-test-pass-100-of-100.log` |
| `npm run build --prefix solana/web` | **PASS** | `frontend-build-pass.log` |

Logovi snimljeni UTF-8 bez BOM (`chcp 65001` + `WriteAllText` UTF-8 no BOM na PS 5.1).

## Manual QA

**Status:** PASS **8/8** — korisnički potvrđeno. Detalji u `manual-qa.md`.

## Poznati prelazi / rizici (van bug scope-a)

- **F5/reconnect:** kratko prazan/default sto dok WS snapshot ne stigne; zatim anchor i countdown nastavljaju od preostalog vremena — dokumentovano kao poznati loading prelaz.
- **Mid-result add-chips sa real Vault TX:** poseban timing QA task; van scope-a ovog commita (skip-vault PASS).
- **Sleep/wake / background tab:** rAF pauziran dok je tab skriven; mali vizuelni rizik pri povratku.
- **ms razlika između dva klijenta:** prihvaćena (svež `Date.now()` po konekciji u hub-u).
- **Deploy redosled:** poker server pre frontenda.

## Predlog commit poruke

```
fix(poker,web): uskladi showdown countdown sa server clock anchorom

Dodaje obavezno serverNow u table WS poruku (hub sendTableTo) i monotoni
frontend anchor preko performance.now(). Countdown vise ne koristi
klijentski wall clock. Nevalidan serverNow sakriva countdown, ali result
panel i server lifecycle ostaju nepromenjeni.

Ukljucuje hub.test.ts i pun poker:test evidence.
```
