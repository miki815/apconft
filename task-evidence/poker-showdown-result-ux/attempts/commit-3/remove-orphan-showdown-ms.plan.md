# remove-orphan-showdown-ms.plan.md

## Task

Uklanjanje neiskorišćene frontend `SHOWDOWN_MS` konstante iz `showdown.ts`.

Interim evidence za commit-3 u okviru Task 9 MR-a.

## Branch / Git context

- Branch: `feature/poker-showdown-result-ux`
- HEAD (pre commit-3): `de1939e` — commit-2 runout fix
- Evidence folder: `task-evidence/poker-showdown-result-ux/attempts/commit-3/`
- **Datum evidence:** 2026-06-22
- Commit-3: **nije napravljen**
- Push: **nije izvršen**

## Implementirani scope

**Jedan kod fajl, 2 obrisane linije:**

| Fajl | Promena |
|------|---------|
| [`solana/web/src/poker/showdown.ts`](solana/web/src/poker/showdown.ts) | Uklonjeno `export const SHOWDOWN_MS = 5000` i prateći prazan red |

Helper funkcije `isResultDisplayActive()` i `isShowdownPhase()` ostale nepromenjene.

**Ne dirano:** `poker/server/room.ts`, `poker/server/room.test.ts`, `PokerPlay.tsx`, `ShowdownBar.tsx`, `attempts/commit-1/`, `attempts/commit-2/`.

## Razdvajanje SHOWDOWN_MS konteksta

### Frontend — uklonjeno

- Orphan export u `showdown.ts` — nije bio importovan u aktivnom frontend kodu posle Task 9 commit-1

### Server — netaknuto

- [`poker/server/room.ts`](poker/server/room.ts) — server `SHOWDOWN_MS` u `beginResultDisplay()`

### Test — netaknuto

- [`poker/server/room.test.ts`](poker/server/room.test.ts) — import server konstante iz `./room.js`

## Provere

### Frontend build

```bash
npm run build --prefix solana/web
```

- **Rezultat:** **PASS**
- **Evidence log:** `task-evidence/poker-showdown-result-ux/attempts/commit-3/frontend-build-pass.log`
- **Stvarni output:** vite v5.4.21; 452 modules transformed; `✓ built in 7.21s`

### Poker tests

**NOT RUN** — nisu potrebni jer je promenjen samo neiskorišćen frontend export koji poker paket ne importuje.

### Manual QA

- **Scenario:** HU check-down showdown (1/1)
- **Status:** **PASS**
- **Detalji:** `attempts/commit-3/manual-qa.md`

## Obavezan manual smoke scenario (izvršen)

**Preduslovi:** server i frontend restartovani; 2 Chrome profila; skip vault flagovi.

1. Oba igrača sede; **Nova ruka**
2. **Preflop:** prvi igrač **Call**, drugi **Check**
3. **Flop:** oba **Check**
4. **Turn:** oba **Check**
5. **River:** oba **Check** → auto showdown

**Potvrđeno:** result panel, winner + rank, countdown ~5s, cleanup, auto-next.

## Git status

- Commit-3 **nije** napravljen
- `de1939e` **nije** amendovan
- Push **nije** izvršen
- Working tree: izmena samo u `solana/web/src/poker/showdown.ts`

## Predlog commit poruke (srpski)

```
chore(web): ukloni neiskorišćenu frontend SHOWDOWN_MS konstantu

Uklonjena je orphan konstanta iz showdown.ts koja više nije korišćena
posle server-sinhronizovanog countdown-a u Task 9.

Provere:
npm run build --prefix solana/web — PASS
Manual QA — 1/1 smoke (HU check-down showdown)
```

Commit samo na eksplicitni zahtev korisnika.
