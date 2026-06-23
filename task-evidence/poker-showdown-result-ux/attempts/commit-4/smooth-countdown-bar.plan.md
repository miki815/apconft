# Commit-4 — Smooth countdown bar

**Task:** showdown result UX MR  
**Branch:** `feature/poker-showdown-result-ux`  
**Scope:** samo [`solana/web/src/poker/ShowdownBar.tsx`](../../../../solana/web/src/poker/ShowdownBar.tsx)

## Problem

Countdown tekst je tačan (server `showdownEndsAt` + `resultDurationMs`), ali progress bar skače u koracima od ~200 ms zbog `setInterval`.

## Rešenje

Zameniti `setInterval(200)` sa `requestAnimationFrame` petljom koja svakog frame-a:

1. uzima `currentNow = Date.now()` (ne rAF `timestamp` — različit time origin od server epoch `endsAt`)
2. računa `remainingMs = max(0, endsAt - currentNow)` (server-provided deadline)
3. poziva `setNow(currentNow)` — primitivni React state (opcija A)
4. zakazuje sledeći frame samo dok je `remainingMs > 0`
5. na poslednjem frame-u (`remainingMs === 0`) postavlja progress na 0 i prekida petlju

Cleanup: `cancelled` flag + `cancelAnimationFrame(rafId)` — obavezno zbog `<React.StrictMode>` u `main.tsx`.

## Odluke (korisnik potvrdio)

| Odluka | Status |
|--------|--------|
| rAF umesto intervala | da |
| Primitivni `now` state, bez `displaySeconds` | da |
| `Math.ceil(remainingMs / 1000)` — kratko `0s` | da |
| `Number.isFinite` guard za `endsAt` i `durationMs` | da |
| Progress clamp 0–1 | da |
| Bez CSS transition / prefers-reduced-motion | da |
| Bez lokalnog `Date.now() + durationMs` fallback-a | da |
| Scope samo ShowdownBar.tsx | da |

## Ispravka: `Math.ceil` i prikaz `0s`

**Provereno u JavaScript-u (Node) i aktivnom kodu:**

| `remainingMs` | `Math.ceil(remainingMs / 1000)` |
|---------------|-----------------------------------|
| 0 | **0** → prikaz `0s` |
| 1 … 1000 | **1** → prikaz `1s` |
| 1001 | 2 |

**Zaključak:** `0s` se prikazuje **samo** kada je `remainingMs === 0`, ne u intervalu `(0, 1000]`. Prethodna research tvrdnja da `0s` može biti vidljiv dok je `remainingMs ∈ (0, 1000]` bila je **pogrešna**.

## Guards

- `isValidCountdownInput`: `Number.isFinite(endsAt) && Number.isFinite(durationMs) && durationMs > 0`
- Ako invalid: effect ne pokreće rAF; `remainingMs = 0`; `progress = 0`
- Progress: `Math.max(0, Math.min(1, remainingMs / durationMs))`
- Remaining: `Math.max(0, endsAt - now)` — bez lokalnog deadline fabriciranja

## Van scope-a (nije dirano)

- `index.css`, `PokerPlay.tsx`, `ws.ts`, poker server, WS contract
- commit-1/2/3 evidence
- package fajlovi

## Verifikacija

| Provera | Status |
|---------|--------|
| `npm run build --prefix solana/web` | PASS — vidi `frontend-build-pass.log` |
| Poker testovi | nije pokretano (poker paket nije menjan) |
| Manual QA | **PASS 5/5** — vidi `manual-qa.md` |

## Manual QA (korisnički potvrđeno — PASS 5/5)

| # | Scenario | Rezultat |
|---|----------|----------|
| 1 | HU check-down showdown | PASS — winner/rank; glatka linija na oba klijenta |
| 2 | Fold rezultat | PASS — „Rezultat ruke“, pobednik, bez izmišljenog ranka; glatka linija |
| 3 | F5 u prvih 1–2 s showdown | PASS — bez reset-a; delimična linija nastavila glatko |
| 4 | F5 u prvih 1–2 s fold | PASS — bez reset-a; rezultat normalno završen |
| 5 | Mobilni viewport | PASS — čitljivo, bez preklapanja; glatka linija; F5 na mobilnom PASS |

## Završni rezultat implementacije

**Commit-4 spreman za commit:** frontend build PASS; manual QA PASS 5/5; scope ispunjen (`ShowdownBar.tsx` only). Poker unit testovi nisu pokretani jer poker paket nije menjan.

## Rizici (preostali)

- Clock skew server ↔ klijent (deferred future task)
- Background tab: rAF pauziran (MDN) — bar stoji dok je tab skriven; pri povratku `Date.now()` ispravi remaining
- StrictMode dev: dupli setup/cleanup — mitigovan sa `cancelled` + `cancelAnimationFrame`
