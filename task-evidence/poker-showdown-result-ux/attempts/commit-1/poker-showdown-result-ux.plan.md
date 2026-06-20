# poker-showdown-result-ux.plan.md

## Task

Task 9: Rank ruke, pobednička ruka i countdown.

Interim evidence za trenutnu osnovu (`commit-1`).

## Branch / Git context

- Branch: `feature/poker-showdown-result-ux`
- Base: `fix/poker-short-stack-call-becomes-all-in`
- Evidence folder: `task-evidence/poker-showdown-result-ux/attempts/commit-1/`
- Status: PARTIAL

## Final implemented scope (commit-1 basis)

Implementirana osnova Taska 9 pokriva:

- Server-authoritative winner rank u `TableState.winners`
- Additive WS contract: `resultKind`, `resultDurationMs`, postojeći `showdownEndsAt`
- Fold i showdown result display lifecycle od 5 sekundi pre `finishHand()` / auto-next
- Per-player result-period action odluka preko `isPlayerInCurrentHand(playerId)`
- Frontend result panel sa grouped winner/pot UI
- Winner seat highlight
- Server-authoritative countdown (`endsAt + durationMs`), bez lokalnog fallback deadline-a

## Changed files (12)

| Fajl | Uloga |
|------|-------|
| `poker/src/types.ts` | `WinnerHandRank`, `WinnerResult`, `TableState.winners` |
| `poker/src/table.ts` | `showdown()` popunjava `handRank`; fold win bez ranka |
| `poker/server/room.ts` | `resultKind`, `resultDurationMs`, `beginResultDisplay()`, per-player guardovi |
| `poker/src/protocol.ts` | additive `resultKind`, `resultDurationMs` u `table` poruci |
| `poker/server/hub.ts` | prosleđivanje novih snapshot polja |
| `poker/src/table.test.ts` | engine rank/tie/side-pot/multi-pot testovi |
| `poker/server/room.test.ts` | fold/showdown result lifecycle, deadline, regression guardovi |
| `solana/web/src/poker/ws.ts` | frontend tipovi/parser za novi contract |
| `solana/web/src/poker/showdown.ts` | `isResultDisplayActive()` helper |
| `solana/web/src/poker/ShowdownBar.tsx` | countdown iz server `endsAt` + `durationMs` |
| `solana/web/src/poker/PokerPlay.tsx` | result panel, grouped winners, seat highlight |
| `solana/web/src/index.css` | winner banner, seat highlight, countdown styling |

## Winner / rank contract

```ts
export interface WinnerHandRank {
  category: number
  name: string
}

export interface WinnerResult {
  playerId: string
  amount: number
  potIndex: number
  handRank?: WinnerHandRank
}
```

- `handRank` postoji samo za showdown winner zapise iz engine `showdown()`.
- Fold win (`awardToSingleWinner()`) nema `handRank`.
- `kickers` i `bestCards` nisu deo contract-a.

## Result lifecycle

- `resultKind: 'showdown' | 'fold' | null`
- `showdownEndsAt`: apsolutni server deadline za result display
- `resultDurationMs`: server-authoritative duration za countdown progress
- `beginResultDisplay()` je idempotent; koristi `resultTimerSeq`
- Fold result: `resultKind='fold'`, `inShowdown=false`, bez card reveal-a
- Showdown result: `resultKind='showdown'`, `inShowdown=true`, card reveal ostaje
- Posle 5s timer poziva postojeći `finishHand()` i postojeći auto-next flow

## Potvrđena per-player odluka

Tokom result perioda:

- Učesnik završene ruke (`isPlayerInCurrentHand`) ne može `stand()`; add-chips ide u `pendingStackAdd`
- Waiting igrač van `state.players` zadržava postojeće pending/sit ponašanje
- Rebuy-grace igrač van ruke zadržava immediate add-chips i postojeći stand behavior
- Novi igrač može da sedne, ali ne ulazi u završenu ruku

## Frontend UX (commit-1 basis)

- Result panel grupiše istog igrača po `playerId`, čuva per-pot detalje
- Pot label: `Glavni pot` / `Side pot N`
- Fold result label: `Rezultat ruke`; showdown label: `Showdown` / `Showdown rezultat`
- Countdown koristi server `showdownEndsAt + resultDurationMs`
- Nema lokalnog `Date.now() + SHOWDOWN_MS` fallback-a
- Trenutni countdown tekst: `Sledeća ruka za Ns`

## Tests added / updated

### Engine (`poker/src/table.test.ts`)

- Dopunjen `runs hand to showdown with checks` — `handRank` assertions
- Dopunjen `awards pot on preflop fold` — nema `handRank`
- Dodato `board-play split winners share the same handRank`
- Dodato `side-pot winners carry handRank per pot with different winners`
- Dodato `same player winning multiple pots keeps per-pot handRank details`

### Room (`poker/server/room.test.ts`)

- Izmenjen `sit, start hand, fold wins` — fold result phase assertions
- Dodato `fold result keeps same deadline and per-player operation guards`
- Dopunjen `enters showdown phase with revealed cards` — `resultKind`, `resultDurationMs`, rank
- Dopunjeni auto-next/fold/waiting/add-chips testovi da koriste `forceFinishResultDisplay()`
- Dopunjen `staged runout broadcasts board growth 3 to 4 to 5` — final `resultKind/showdownEndsAt`
- Izmenjen `T4: HU largest stack releasableStack after all-in matches seat stack`

## Fresh verification (2026-06-20)

### Poker tests

```bash
npm run poker:test
```

Result: **PASS 98/98**

Raw log:

```txt
task-evidence/poker-showdown-result-ux/attempts/commit-1/poker-test-pass-98-of-98.log
```

### Frontend build

```bash
npm run build --prefix solana/web
```

Result: **PASS**

Raw log:

```txt
task-evidence/poker-showdown-result-ux/attempts/commit-1/frontend-build-pass.log
```

## Manual QA status

```txt
Status: PARTIAL
Executed scenarios: PASS
```

Detalji: `manual-qa.md`

Ručno potvrđeni scenariji uključuju normalan showdown, fold win, refresh tokom countdown-a, waiting igrača, grouped multi-pot prikaz, HU oba-all-in (instant 5 board karata kao postojeće očekivano ponašanje), mobilni prikaz i cleanup posle result perioda.

## Status

**Status: PARTIAL**

Trenutna implementacija i izvršeni manual QA scenariji su prošli, ali task još nije završen i potrebne su dodatne dorade i provere pre finalnog prihvatanja.

## Not changed

- `.env`, `.env.example`
- `package.json`, lock fajlovi
- dependency-ji
- Anchor, IDL, contracts
- Vault/lock/release flow
- `poker/src/pot.ts` pot accounting
- Highlight konkretnih najboljih pet karata

## Acceptance status (interim)

- Commit-1 osnova implementirana i pokrivena automatskim testovima + manual QA (8/8 scenarija PASS)
- **Status: PARTIAL** — trenutna implementacija i izvršeni manual QA scenariji su prošli, ali task još nije završen i potrebne su dodatne dorade i provere pre finalnog prihvatanja
