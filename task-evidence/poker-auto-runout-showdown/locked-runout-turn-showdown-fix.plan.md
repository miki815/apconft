# Task evidence: 4-player locked-runout turn-close stall fix

## Status

**Implemented** — 2026-06-16. Turn-close locked runout sada završava showdown-om u locked grani `endBettingRound()`.

---

## Implementation summary

### Šta je implementirano

U locked grani `endBettingRound()` u [`poker/src/table.ts`](../../poker/src/table.ts), **posle postojećeg cosmetic reset-a i `actionSeat = null`**, dodato:

```ts
if (this.board.length === 5 && !this.handComplete) {
  this.showdown()
}
```

### Dodat test

**Ime:** `turn-close locked runout deals river and completes showdown` u [`poker/src/table.test.ts`](../../poker/src/table.test.ts)

- 4 igrača (A=500, B/C/D=200), `startHand()` + `applyAction()` do kraja turn-a
- Preflop call/check, flop check-through, turn: B fold → C/D all-in → A call
- Bez `advanceRunout()`
- Assert: `board.length === 5`, `handComplete === true`, `bettingRound === 'showdown'`, `winners.length >= 1`, `isRunoutPending() === false`

Test je **fail-ovao pre fix-a** (`handComplete === false` na `board === 5`).

### Test rezultati

```bash
cd poker && node --import tsx --test src/table.test.ts
# pass 17/17

npm run poker:test
# pass 78/78 (11 suites)
```

Detaljan log: [`poker-test-pass-78-of-78-locked-runout-turn-showdown.log`](poker-test-pass-78-of-78-locked-runout-turn-showdown.log)

**Napomena:** Prva dva puna run-a imala su 77/78 zbog poznatog flaky testa u `PokerRoom rebuy grace` / `PokerRoom action timeout` (timing) — **nije povezano** sa ovim fixom. Treći run: **78/78 pass**.

### Potvrda scope-a

| Oblast | Dirano? |
|--------|---------|
| `3-player postflop stall` | **Ne** — nije rešavan |
| `firstPostflopActionSeat()` | **Ne** |
| `seatsInHandCount()` | **Ne** |
| `seatedWithChips()` | **Ne** |
| `poker/server/room.ts` | **Ne** |
| `poker/server/room.test.ts` | **Ne** |
| `poker/src/pot.ts` | **Ne** |
| Frontend / Vault / WS / package / env | **Ne** |

---

## Problem

Kada locked runout **počne na kraju turn betting runde** (`board.length === 4`), locked grana u `endBettingRound()` poziva `dealRunoutSegment()` i river stiže (`board.length === 5`), ali **ne poziva `showdown()`**.

Posledica:

- `handComplete === false`
- `actionSeat === null`
- `isRunoutPending() === false` (jer `board.length < 5` više ne važi)
- `advanceRunout()` ne može da završi ruku
- Nema winner-a / pot settlement-a

**Repro (engine, real `startHand()` + `applyAction()`):**

- 4 igrača: A=500, B/C/D=200, button=0
- Preflop: svi call/check; Flop: svi check; Turn: B fold → C/D all-in → A call
- Rezultat pre fix-a: `board=5`, `bettingRound='river'`, `handComplete=false`

**Root cause:** Uvedeno u PR #7 (auto-runout). `advanceRunout()` već ispravno zove `showdown()` na `board === 5`, ali locked grana u `endBettingRound()` to ne radi.

**Nije u scope-u ovog taska:** 3-player postflop stall (`firstPostflopActionSeat()` / `seatsInHandCount()` / `seatedWithChips()`).

---

## Solution

### Minimalni fix (sa deep-review korekcijom)

U locked grani `endBettingRound()` u [`poker/src/table.ts`](../../poker/src/table.ts), **posle postojećeg cosmetic reset-a i očišćenja action state-a**, dodati:

```ts
if (this.board.length === 5 && !this.handComplete) {
  this.showdown()
}
```

### Tačan redosled u locked grani (L364–374)

```ts
if (this.isLockedRunout()) {
  this.dealRunoutSegment()
  // cosmetic reset (postojeće — ne dira betThisHand)
  this.currentBet = 0
  this.minRaiseTo = this.bigBlind
  this.lastAggressorSeat = null
  for (const p of this.playersInHand()) {
    p.betThisRound = 0
  }
  this.needsAction.clear()
  this.actionSeat = null
  // NOVO — posle reset-a, ne odmah posle dealRunoutSegment()
  if (this.board.length === 5 && !this.handComplete) {
    this.showdown()
  }
  return
}
```

### Zašto `showdown()` posle reset-a, ne odmah posle `dealRunoutSegment()`

| Razlog | Objašnjenje |
|--------|-------------|
| **`betThisHand` se ne dira** | Cosmetic reset menja samo `currentBet`, `minRaiseTo`, `lastAggressorSeat`, `betThisRound`. `showdown()` / `buildPots()` koriste **`betThisHand`** + `folded` set — pot settlement ostaje ispravan. |
| **`betThisRound`, `currentBet`, `needsAction`, `actionSeat` se prvo očiste** | Finalni snapshot iz `applyAction()` → `getState()` ne nosi lažni betting state (`currentBet > 0`, `betThisRound` sa starim vrednostima) posle završetka ruke. |
| **Smanjuje rizik lošeg finalnog snapshot-a** | Klijent i room vide čist state: `handComplete=true`, `bettingRound='showdown'`, `actionSeat=null`, bez ostataka turn betting runde. |
| **Usaglašeno sa locked-runout pattern-om** | Postojeći komentar u auto-runout planu: cosmetic reset posle segmenta pre nastavka runout-a; na poslednjem segmentu (river) sledi showdown. |
| **Simetrično sa `advanceRunout()`** | `advanceRunout()` redosled: segment → `needsAction.clear()` + `actionSeat = null` → `if (board === 5) showdown()`. Locked grana već ima širi cosmetic reset pre showdown poziva. |

### Zašto defensive guard `!this.handComplete`

| Razlog | Objašnjenje |
|--------|-------------|
| **Sprečava double-showdown** | `showdown()` nije idempotentan (ponovni poziv bi duplirao isplate iz potova). Guard osigurava da se ne pozove ako je ruka već završena. |
| **Praktičan rizik danas je nizak** | Turn-close put završava ruku u jednom `endBettingRound()`; preflop/flop locked ulazi ne dosegnu `board === 5` u ovoj grani. Guard je jeftina defensive mera bez promene scope-a. |
| **Može „izlečiti“ mrtav state** | Ako engine već ima `board=5` + `handComplete=false` (trenutni stall), guard dozvoljava jednokratni showdown bez duplog poziva posle `handComplete=true`. |

**Napomena:** Funkcionalno bi `showdown()` verovatno radio i odmah posle `dealRunoutSegment()` (jer ne koristi `betThisRound` / `currentBet`), ali **preporučeni placement je posle reset-a** — manji rizik za snapshot i konzistentniji sa postojećim locked-runout flow-om.

---

## Šta fix menja / ne menja

### Menja se samo

| Scenario | Posle fix-a |
|----------|-------------|
| Locked runout turn-close (`board 4→5` u `endBettingRound`) | `showdown()` odmah, `handComplete=true` |
| Room posle poslednje akcije | `afterTableProgress()` → `beginShowdown()` (ne `continueRunout()`) |

### Ne menja se

| Scenario | Zašto |
|----------|-------|
| Locked runout preflop (`board 0→3`) | `board !== 5` — nema showdown u locked grani; `isRunoutPending()` ostaje true |
| Locked runout flop-end (`board 3→4`) | Isto — river preko `advanceRunout()` / room timer-a |
| HU / 3-way / 4-way **normal** betting | Ne ulazi u locked granu |
| All-in svi bez active stack | `runOutBoard()` + `showdown()` — druga grana |
| Preflop locked + room staged 3→4→5 | Postojeći timer/drain + `advanceRunout()` — ne dira se |
| `returnUncalledBets()` | Poziva se pre locked provere — ne dira se |
| Side-pot eligibility / chip conservation | `buildPots` iz `betThisHand` — ne dira se |

---

## Explicit out of scope (ne dirati)

| Oblast | Napomena |
|--------|----------|
| **3-player postflop stall** | Odvojen bug; **ne rešava se** ovim fixom |
| **`firstPostflopActionSeat()`** | Netaknuto |
| **`seatsInHandCount()`** | Netaknuto |
| **`seatedWithChips()`** | Netaknuto |
| **`poker/server/room.ts`** | Fix u engine-u; room već ispravno reaguje na `handComplete` |
| **`poker/server/room.test.ts`** | Nije potreban za ispravnost fix-a |
| **`poker/src/pot.ts`** | Netaknuto |
| **Frontend (`solana/web/**`)** | Netaknuto |
| **Vault / wallet / on-chain** | Netaknuto |
| **WS contract / protocol** | Netaknuto |
| **package.json / env fajlovi** | Netaknuto |

---

## Implementation steps

1. **Test-first:** Dodati test `turn-close locked runout deals river and completes showdown` u [`poker/src/table.test.ts`](../../poker/src/table.test.ts) unutar `describe('HoldemTable locked runout')`.
2. Potvrditi da test **fail-uje** pre fix-a (`handComplete === false`).
3. **Fix:** ~3 linije u locked grani `endBettingRound()` — placement i guard kao gore.
4. **Testovi:**
   ```bash
   cd poker && node --import tsx --test src/table.test.ts
   npm run poker:test
   ```
5. **Evidence log:** [`poker-test-pass-78-of-78-locked-runout-turn-showdown.log`](poker-test-pass-78-of-78-locked-runout-turn-showdown.log)

---

## Test plan

### Novi test (obavezan)

**Ime:** `turn-close locked runout deals river and completes showdown`

**Flow:**

- 4 igrača: A=500 @ seat 0, B/C/D=200 @ seats 1/2/3, button=0
- Preflop: svi u pot (call/check kroz postojeći pattern iz locked testova)
- Flop: svi check
- Turn: B fold, C all-in, D all-in, A call
- **Bez** `advanceRunout()` — samo `applyAction()` do kraja

**Assert:**

- `board.length === 5`
- `handComplete === true`
- `bettingRound === 'showdown'`
- `winners.length >= 1`
- `table.isRunoutPending() === false`
- (preporučeno) chip conservation — `sum(stacks)` konzistentan

Ovaj test **direktno pokriva bug** — postojeći locked testovi ulaze sa preflop kraja i završavaju preko `advanceRunout()`, pa ne hvataju turn-close put.

### Regression

- Pun `npm run poker:test` — svi postojeći suite-ovi moraju proći.
- Jedan novi test je dovoljan uz postojeći suite; dodatni room test **nije** potreban za minimalni scope.

---

## Changed files (implementacija)

| Fajl | Izmena |
|------|--------|
| `poker/src/table.ts` | Locked grana `endBettingRound()` — showdown posle reset-a + guard |
| `poker/src/table.test.ts` | 1 novi test |
| `task-evidence/poker-auto-runout-showdown/locked-runout-turn-showdown-fix.plan.md` | Ovaj dokument |
| `task-evidence/poker-auto-runout-showdown/poker-test-pass-78-of-78-locked-runout-turn-showdown.log` | Log posle test run-a |

---

## Deep review reference

- Placement: posle cosmetic reset-a / `actionSeat = null`, ne odmah posle `dealRunoutSegment()`
- Guard: `board.length === 5 && !this.handComplete`
- Double-showdown: praktično nema rizika uz guard
- Pot/refund: `returnUncalledBets()` pre locked grane; `betThisHand` netaknut cosmetic reset-om
- Room: `handComplete` → `beginShowdown()`; nema pogrešnog runout timer loop-a
- 3-player stall: eksplicitno van scope-a

---

## Final recommendation

**Implementirano** sa deep-review korekcijom (placement posle reset-a + `!handComplete` guard). Scope: samo `table.ts` + `table.test.ts` + evidence.
