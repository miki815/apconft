# Task evidence: Auto runout when lone active vs all-in

## Status

**Implemented** — locked runout u engine-u + staged board timing u `PokerRoom`.

## Problem

Kada u ruci ostane tačno jedan igrač sa `status === 'active'` i `stack > 0`, a svi ostali u ruci su `all-in`, stari flow je delio sledeću ulicu i nudio akciju tom igraču (3-way short-stack all-in repro: A raise, B/C short all-in, A dobija flop fold/check).

## Solution

### Zašto lone active ne dobija akciju

`endBettingRound()` sada detektuje **locked runout** (`isLockedRunout()`):

- 2+ igrača u ruci
- tačno 1 `active` sa `stack > 0`
- svi ostali u ruci su `all-in`

Umesto normalne sledeće betting ulice:

- `dealRunoutSegment()` (board 0→3→4→5)
- **Cosmetic reset** posle segmenta (bez diranja pot/showdown accounting-a): `currentBet = 0`, `minRaiseTo = bigBlind`, `lastAggressorSeat = null`, `betThisRound = 0` po igračima u ruci; **`betThisHand` i `roundActions` ostaju** (labeli „Raise 100“ / „All-in“)
- `actionSeat = null`, `needsAction` prazan
- `PokerRoom` nastavlja runout timerom (`RUNOUT_STREET_MS = 1200`) ili sync drain kad `runoutStreetMs <= 0`
- poslednji segment → `showdown()` → postojeći `beginShowdown()`

`isRunoutPending()` zahteva i `actionSeat === null` da se runout ne pokrene dok betting runda još traje (npr. HU: jedan all-in, drugi još nije odgovorio).

### Public engine API

- `isRunoutPending(): boolean`
- `advanceRunout(): ActionResult` — jedan street korak; river + showdown u istom pozivu

## Changed files

| Fajl | Izmena |
|------|--------|
| `poker/src/table.ts` | `isLockedRunout`, `dealRunoutSegment`, `advanceRunout`, `isRunoutPending`, branch u `endBettingRound` |
| `poker/src/table.test.ts` | 5 novih locked runout testova |
| `poker/server/room.ts` | `RUNOUT_STREET_MS`, runout timer + seq guard, `continueRunout` / `drainRunout`, hook u `applyAction` |
| `poker/server/room.test.ts` | `noTimer`/`fastRebuy` + `runoutStreetMs: 0`, 3 nova runout testa |

## Test results

```bash
npm run poker:test
```

**Latest verification:** **70/70 pass** (10 suites).

**Locked runout task:** svi novi i rename-ovani testovi prolaze.

**Napomena:** tokom provere se povremeno pojavio **69/70** u `PokerRoom rebuy grace` suite-u, sa flaky subtestovima oko rebuy grace timing-a (`fastRebuy`, `rebuyGraceMs: 50`). Provera pokazuje da to **nije povezano** sa locked runout flow-om niti sa neutral rename-om. Rebuy grace flaky stabilizacija ostaje **van scope-a** ovog taska.

Detaljan log poslednjeg 70/70 run-a: [`poker-test-pass-70-of-70.log`](poker-test-pass-70-of-70.log).

Novi testovi:

- 3-way locked runout + staged `advanceRunout`
- HU one active + one all-in
- 2 active regression (flop action postoji)
- Chip conservation
- `advanceRunout` guard
- Room: staged board 3→4→5 broadcast
- Room: `you.canAct === false` tokom runout-a
- Room: `applyAction` reject tokom runout-a

## Not changed

- `poker/src/pot.ts`, `poker/src/pot.test.ts`
- Frontend (`solana/web`)
- `poker/src/protocol.ts`, `poker/server/hub.ts`
- Wallet / vault / env / package fajlovi

## Risks / notes

- **Timer races:** mitigirano `runoutTimerSeq`, `clearRunoutTimer` u `applyAction` / `beginShowdown` / `finishHand`, action timer se ne zakazuje tokom runout-a.
- **`runoutStreetMs <= 0`:** sync drain u istom tick-u (test fixture-i `noTimer`, `fastRebuy`).
- **`buildPots` folded-overbet:** van scope-a; side-pot UI je sledeća faza.

## Next step

1. Ručni QA: `npm run poker:server` + `npm run solana:web` — 3-way short all-in vs deep stack; nema action dugmadi; flop/turn/river sa pauzom; showdown.
2. Frontend side-pot UI (Faza 2) — prikaz `state.pots` / side pot breakdown.
