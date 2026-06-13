# Task evidence: Uncalled bet refund

## Status

**Implemented** — 2026-06-13. `returnUncalledBets()` u `table.ts`, 6 novih testova, `npm run poker:test` **77/77 pass**.

Poslednja duboka analiza: 2026-06-12, branch `feature/poker-uncalled-bet-refund`.  
Micro-review: 2026-06-12 (5 tačaka, bez širenja scope-a).

---

## Pre-change verification

| Provera | Rezultat |
|---------|----------|
| `returnUncalledBets` / refund u `table.ts` | **Ne postoji** |
| `betThisHand` smanjenje tokom ruke | **Samo** reset na `startHand` |
| `doFold` | Ne menja `betThisHand` / `stack` |
| `buildPots` | Ne menja se — OK posle refund-a |
| `awardToSingleWinner` | Zaobilazi `endBettingRound` — ne dirati |
| Baseline `npm run poker:test` | **70/71 pass** — 1 unrelated fail: `PokerRoom rebuy grace` → `does not auto-start when only one eligible player` |

---

## Problem

Kada jedan igrač uloži više nego što drugi mogu da isprate, uncalled višak ostaje u `betThisHand`. Posledice:

- UI `potTotal = sum(betThisHand)` prikazuje prevelik pot (npr. 400 umesto matched 300)
- U **4+ player** scenariju, ako overbettor kasnije fold-uje, `buildPots` može izgubiti čipove (chip-loss)
- U **3-way locked runout** chip conservation slučajno radi (side-pot workaround), ali semantika `stack`/`betThisHand` je pogrešna

Root cause: **missing `returnUncalledBets`**, ne `buildPots`.

---

## Solution

### Algoritam `returnUncalledBets()` (potvrđen)

```ts
private returnUncalledBets() {
  const inHand = this.playersInHand()
  if (inHand.length < 2) return

  let maxBet = 0
  for (const p of inHand) {
    if (p.betThisRound > maxBet) maxBet = p.betThisRound
  }

  let secondBet = 0
  for (const p of inHand) {
    if (p.betThisRound < maxBet && p.betThisRound > secondBet) {
      secondBet = p.betThisRound
    }
  }

  if (maxBet <= secondBet) return

  const topPlayers = inHand.filter((p) => p.betThisRound === maxBet)
  if (topPlayers.length !== 1) return

  const refund = maxBet - secondBet
  const top = topPlayers[0]!
  top.stack += refund
  top.betThisRound -= refund
  top.betThisHand -= refund
}
```

### Obavezno: refund po `betThisRound`, ne po `betThisHand`

| Pravilo | Zašto |
|---------|-------|
| Računaj `maxBet` / `secondBet` iz **`betThisRound`** | Uncalled je per betting round (ulica) |
| Smanji **oba** `betThisRound` i `betThisHand` za `refund` | `betThisHand` akumulira celu ruku; samo trenutni street višak se vraća |
| **Nikad** refund iz ukupnog `betThisHand` | Pokvario bi prethodne matched street-ove |

Primer multi-street: preflop svi na 100, flop A=200 B=100 C=100 → refund **100 na flop-u** → A `betThisHand` = 100+100 = 200 (ne 300).

### Poziv: prva linija `endBettingRound()` (potvrđeno)

```ts
private endBettingRound() {
  this.returnUncalledBets()
  // ... postojeća logika
}
```

**Zašto ovde (Opcija A), ne pre-showdown-only (Opcija B) ili cap u buildPots (Opcija C):**

| Opcija | Ocena |
|--------|-------|
| **A — kraj svakog betting round-a** | **Preporučeno.** Ispravlja `stack`/`betThisHand` odmah; sprečava chip-loss pre kasnijeg fold-a; tačan UI total tokom ruke |
| B — samo pre showdown | Ne vraća stack fold-ovanom overbettoru; UI pogrešan tokom ruke |
| C — cap u buildPots | `stack` ostaje pogrešan; chip-loss za folded overbettor |

**Uticaj na postojeći flow posle refund-a (provereno protiv koda):**

| Polje / logika | Uticaj refund-a |
|----------------|-----------------|
| `canBetMore` | **Bez promene** — gleda `status === 'active' && stack > 0`; all-in ostaje all-in čak i ako dobije refund na stack |
| `isLockedRunout()` | **Bez promene** — i dalje 1 active + ostali all-in |
| `runOutBoard()` / `showdown()` | Dobijaju ispravan `betThisHand` |
| Prelazak na sledeću ulicu | `betThisRound` reset posle refund-a — OK |
| `currentBet`, `minRaiseTo`, `lastAggressorSeat` | Resetuju se u postojećem kodu posle refund-a — **ne treba dodatno dirati** |
| `actionSeat` / `needsAction` | **Ne dirati** — refund ne menja ko treba da deluje |

**Napomena:** `currentBet` se ne smanjuje u `returnUncalledBets()` jer se round završava i resetuje u istom `endBettingRound()` — bezbedno.

---

## Edge case analiza (max 6 igrača)

### Algoritam pokriva

| Scenario | Pokriven? | Napomena |
|----------|-----------|----------|
| **HU** deep raise + short all-in | **DA** | max=200, second=100, refund 100 deep-u |
| **3-way locked runout** | **DA** | Refund pre `dealRunoutSegment`; A `betThisHand` matched na short stack |
| **4-way overbettor fold** | **DA** (flop refund + locked runout) | „Refund + fold” u istoj 4-way ruci **nedostižan**; test #2: C fold → solo-top refund → locked runout |
| **5/6 multi-level side-pots** | **DA** | Refund samo solo-top višak **po ulici**; side-pots iz različitih nivoa ostaju za `buildPots` |
| **Tie at top** | **DA** | `topPlayers.length !== 1` → nema refund-a |
| **Matched equal bets** | **DA** | `maxBet <= secondBet` → nema refund-a |
| **Folded matched chips** | **DA** | Folded **nisu** u `playersInHand()`; matched deo ostaje u `betThisHand` |
| **All-in eligible nivoi** | **DA** | `buildPots` ne menja se; refund ne dira eligibility |
| **Sitting-out** | **N/A** | `playersInHand()` isključuje `sitting-out`; ne dobijaju hole cards u `startHand` |
| **`inHand.length < 2`** | **DA** | Early return — guard |
| **`awardToSingleWinner`** | **Van scope-a** | Poziva se u `applyAction` **pre** `endBettingRound` kada `alive.length === 1`; refund se ne poziva — ispravno (pobednik uzima ceo pot) |

### Posebni edge: all-in igrač kao solo top bettor (micro-review #1)

Teoretski: A all-in 200, B call 100. Algoritam refunduje **A** 100 → A dobija `stack > 0` ali `status` ostaje `all-in`.

| Provera | Zaključak |
|---------|-----------|
| `canPlayerAct` | **Bezbedno** — zahteva `status === 'active'` (`table.ts` ~559–564); all-in sa refundovanim stack-om **ne može** da deluje |
| `canBetMore` | **Bezbedno** — `endBettingRound` gleda samo `active && stack > 0` (~325–327); all-in se ne računa |
| `isLockedRunout` | **Bezbedno** — broji samo `active && stack > 0` (~396–398); refundovani all-in ne ulazi u `activeWithStack` |
| `showdown` / `buildPots` | **Bezbedno** — refund pre showdown-a smanjuje `betThisHand`; eligibility ostaje ista |
| Chip conservation | **Bezbedno** — refund je preraspodela `stack` ↔ `betThisHand`, ne kreira/unicštava čipove |
| Naredna ruka / `startHand` | **Bezbedno** — `startHand` resetuje `status = 'active'` za `stack > 0` (~174) |

**Zaključak:** `all-in` + `stack > 0` posle refund-a je **prihvatljivo** za ovaj engine; **ne treba** menjati status u `returnUncalledBets()`. U praksi solo top je gotovo uvek deep **active** igrač; all-in top je retko.

### Idempotentnost / dupli poziv (micro-review #2)

`returnUncalledBets()` se poziva na početku `endBettingRound()` — u normalnom flow-u **jednom po zatvorenom betting round-u**. Dupli poziv u istom stanju je **bezbedan**:

1. Posle prvog refund-a: `top.betThisRound` se smanjuje na `secondBet` → `maxBet <= secondBet` → early return.
2. Alternativa: više igrača na max nivou → `topPlayers.length !== 1` → early return.

**Ne može** ponovo da vrati čipove. Nije potreban poseban „already refunded” flag.

### Nulti round betovi (micro-review #3)

Ako svi `betThisRound === 0`: `maxBet = 0`, `secondBet = 0` → `maxBet <= secondBet` → **return bez izmene**. Nema lažnog refund-a.

### Defensive guard `if (refund <= 0) return` (micro-review #4)

**Nije striktno potreban** — ako je `topPlayers.length === 1` i `maxBet > secondBet`, tada je `refund = maxBet - secondBet` uvek **> 0** (integeri). Raniji guard-ovi (`inHand < 2`, `maxBet <= secondBet`, `topPlayers.length !== 1`) pokrivaju sve ostale izlaze.

**Opciono:** jedna linija pre `top.stack += refund` kao cheap defensive dokumentacija; **nije obavezno** u planu/checklist-u.

### 4-way test dostižnost (micro-review #5)

**Originalni test #2 scenario (preflop A→200, B AI 100, C/D „call 100” sa deep stack-om) nije dostižan** kroz `applyAction` flow:

- Deep C/D koji **call**-uju kada je `currentBet = 200` završavaju sa `betThisHand = 200`, ne 100.
- Engine simulacija: posle preflop-a → `flop`, `board.length = 3` (OK), ali `A/C/D betThisHand = 200`, `B = 100` → **tie at top** → **nema** solo-top refund-a.
- Teoretski chip-loss (`buildPots` sa A=200, B/C/D=100, A fold) daje pot sum 400 od 500 uloženih — ali to stanje sa deep C/D **ne može** da se postigne u jednom betting round-u (deep igrač mora da kompletira call do `currentBet`).

**Ispravljen test #2 (dostižan, realan engine flow):**

| Parametar | Vrednost |
|-----------|----------|
| Stackovi | A=500, B=70, C=500, D=70 |
| Preflop | Jeftin match (raise/call do 20) — svi zadržavaju stack |
| Flop | **Driver po `actionSeat`** (ne fiksni red): kada A ima akciju sa `toCall=0` → `bet 200`; B/D → `all-in`; **C → `fold`** facing bet |
| Posle flop `endBettingRound` | Solo top A (B/D short all-in na nižem nivou) → refund uncalled; A matched `betThisHand` na short nivo (npr. 70 ukupno sa preflop-om, ne 220) |
| Posle flop | **Locked runout** (1 active + ostali all-in) — A **ne može** fold na turn-u (ispravno) |
| Kraj | `advanceRunout` → showdown; `sum(stacks)` = start |

**Zašto je stari opis pogrešan:**
- `C call 200` uz A na 200 daje **tie at top** → nema refund-a.
- **Refund + A fold u istoj 4-way ruci** nije dostižan: solo-top refund zahteva da drugi deep igrač **ne** bude na max nivou; ako je u ruci i suočio se sa max bet-om, mora call/fold/all-in — call = tie, fold = locked runout.
- Test #2 zato testira **4-way refund + locked runout + conservation**, ne „turn A fold”.

**Implementaciona napomena:** postflop red akcija zavisi od `buttonSeat` (posle `startHand` rotira se). Test mora granati na `actionSeat`/`toCall` (kao postojeći locked runout testovi), ne na pretpostavljeni red „A prvi na flop-u”.

### 3-way fold chip-loss — dostižnost

Čist **3-way** A=200/B=100/C=100 sa fold-om pre showdown-a: **verovatno nedostižan** (locked runout blokira fold). Teoretski **4-way** chip-loss (A solo 200, ostali 100, A fold) zahteva stanje koje deep call-ovi **ne postižu** u jednom round-u. **HU test #1** je primarni refund repro; **test #2** pokriva **4-way refund + locked runout + conservation** (ne fold overbettora u istoj ruci).

---

## Regresioni rizici

| Oblast | Rizik | Mitigacija |
|--------|-------|------------|
| `pot.test.ts` side-pots | **Nizak** — `pot.ts` se ne dira | Postojeći testovi ostaju |
| Locked runout testovi | **Nizak** | Test #3 + postojeći `describe('HoldemTable locked runout')` |
| HU all-in + call | **Nizak** | Test #1 + postojeći HU locked runout test |
| Preflop fold award | **Nizak** | Postojeći `awards pot on preflop fold` — path ne ide kroz refund |
| Chip conservation | **Srednji** pre fix-a | Test #2, #3 eksplicitno |
| `splitPot` remainder | **Nema** — ne dira se | — |
| Standard showdown (bez all-in) | **Nizak** | Test #4 (equal matched) |
| Scenario bez refund-a | **Nizak** | Test #4, #5 |

---

## Finalni test plan

### Obavezni testovi (6) — `poker/src/table.test.ts`

| # | Naziv | Igrači | Scenario | Očekivanje | Dokazuje |
|---|-------|--------|----------|------------|----------|
| **1** | `returns uncalled excess heads-up after short stack all-in` | 2 | Deep raise 200, short all-in 100 | Oba `betThisHand=100`; `sum(stack+betThisHand)=600` | Osnovni refund |
| **2** | `4-way flop uncalled refund conserves chips through locked runout` | 4 | A=500,B=70,C=500,D=70; preflop cheap; flop: A bet 200 kad je na redu / B,D AI / **C fold**; locked runout → showdown | A matched na short nivo (ne pun overbet u `betThisHand`); `sum(stacks)` na kraju = start | **4-way refund** + locked runout + conservation |
| **3** | `3-way locked runout refunds uncalled before runout` | 3 | A=500, B/C=50, A raise 200, B/C all-in | A `betThisHand=50`, `stack=450`; locked runout radi; chip conservation | Regresija auto-runout + refund |
| **4** | `does not refund when all in-hand players matched the same amount` | 3 | Svi call/check do BB (10) | Svi `betThisHand=10`; nema refund-a | Equal matched guard |
| **5** | `does not refund when two players tie at the top bet` | 4 | A raise 200, B/C short all-in 100, D call 200 | A/D `betThisHand=200`, B/C `=100`; nema refund-a | Tie-at-top guard |
| **6** | `matched folded chips stay in pot at showdown` | 3 | Svi matched 10 preflop, A fold flop, do showdown | `pots` sum=30; A nije eligible; chip conservation | Folded matched ≠ uncalled |

### Opcioni testovi — **nisu potrebni u prvom MR-u**

| # | Naziv | Zašto opciono |
|---|-------|---------------|
| **7** | 5/6 player multi-level | Pokriveno kombinacijom #3 + postojećeg `4–6-way locked runout` + algoritam je igronezavisan od N≤6 |
| **8** | `awardToSingleWinner` regression | Postojeći test `awards pot on preflop fold` već pokriva path koji **ne poziva** `endBettingRound` |

### Postojeći testovi kao regresija (ne menjati)

- `HoldemTable locked runout` (6 testova, uklj. 4–6-way)
- `conserves chips through locked runout and showdown`
- `awards pot on preflop fold`
- `pot.test.ts` (3 testa) — bez izmene

### Očekivani test count posle implementacije

- Baseline: **71** testova (70 pass, 1 unrelated rebuy fail)
- Novi: **+6** → **77** ukupno
- Očekivanje: **76/77 pass** (ako rebuy i dalje pada) ili **77/77**

```bash
npm run poker:test
```

Evidence log: `task-evidence/poker-uncalled-bet-refund/poker-test-pass-77-of-77.log` — **77/77 pass** (2026-06-13).

---

## Scope (final)

### Dirati

| Fajl | Izmena |
|------|--------|
| [`poker/src/table.ts`](../../poker/src/table.ts) | `returnUncalledBets()` + poziv u `endBettingRound()` |
| [`poker/src/table.test.ts`](../../poker/src/table.test.ts) | Novi `describe('HoldemTable uncalled bet refund')` — 6 testova |
| `task-evidence/poker-uncalled-bet-refund/poker-uncalled-bet-refund.plan.md` | Ovaj plan |

### Ne dirati

- `poker/src/pot.ts`
- `poker/src/protocol.ts`
- `poker/server/room.ts`
- `poker/server/hub.ts`
- frontend (`solana/web`)
- wallet/vault flow
- `.env`, `.env.example`
- `package.json`, `package-lock.json`

---

## Invariants (mora važiti posle fix-a)

```text
sum(stacks + betThisHand) konstantan tokom ruke (refund samo preraspoređuje)
sum(pots.amount) na showdown === sum(matched betThisHand contributions)
uncalled excess vraćen bettoru — ne dodeljen drugim igračima
matched folded chips ostaju u potu
folded igrači nisu eligible
all-in eligible samo za nivoe koje su pokrili (buildPots)
nema promene WS protocol-a
```

---

## Finalna sanity provera (pre Agent mode)

| # | Pitanje | Odgovor |
|---|---------|---------|
| 1 | Plan realističan vs engine flow? | **DA** — `returnUncalledBets()` na početku `endBettingRound()` pokriva sve grane (normalan street advance, locked runout, `!canBetMore` → showdown) pre resetovanja `betThisRound` |
| 2 | Testovi dostižni bez veštačkog stanja? | **DA** — svi kroz `startHand` + `applyAction`; test #2 **mora** driver po `actionSeat` (button rotacija); bez direktnog mutiranja internog stanja |
| 3 | Usklađenost sa poker pravilima? | **DA** — uncalled → bettor; folded matched ostaje u potu (`playersInHand` ih isključuje iz refund-a, ne iz `betThisHand`); folded nije eligible (`buildPots`); side-pot ≠ uncalled (refund po `betThisRound`, `buildPots` ne diramo) |
| 4 | Edge koji još fali (isti scope)? | **Nema blokirajućih** — `awardToSingleWinner`, idempotentnost, all-in+refund, nulti betovi pokriveni u planu; sitting-out van scope-a |
| 5 | Bolje rešenje od trenutnog? | **Ne** — ovo je minimalni ispravan fix; alternative (samo pre-showdown / cap u `buildPots`) pogrešnije po semantici |
| 6 | 6 testova dovoljno? | **DA** — #1 refund HU, #2 4-way refund, #3 locked runout, #4/#5 negativni guard-ovi, #6 folded matched |

**Jedina korekcija u ovoj sanity rundi:** test #2 — uklonjen nedostižan „C call + turn A fold”; zamenjen sa **C fold → refund → locked runout**.

## Micro-review zaključak (pre Agent mode)

| Tačka | Odgovor |
|-------|---------|
| Plan | **Dopunjen** (test #2 ispravljen, 5 micro-review sekcija) |
| `all-in` + refunded `stack > 0` | **OK** — ne menja status; engine ga tretira kao neaktivnog za akciju |
| Dupli poziv helper-a | **Bezbedan** — drugi poziv ne refunduje (max/second ili tie-at-top) |
| `refund <= 0` guard | **Nije potreban** (opciono defensive) |
| 4-way test #2 | **Dostižan** (C fold + refund + locked runout); refund+fold u istoj ruci **nedostižan** |
| Agent mode | **Spremni** |

## Odluke za korisnika/kolegu pre Agent mode

1. **Potvrditi** da je 6 testova dovoljno (bez #7 5/6 i #8 award regression).
2. **Potvrditi** da unrelated rebuy fail (70/71) nije deo ovog MR-a.
3. **Frontend side-pot UI** ostaje odvojen task — posle ovog backend MR-a.

---

## Implementacioni checklist (Agent mode)

- [x] Dodati `returnUncalledBets()` u `table.ts` (bez `refund <= 0` guard-a — opciono)
- [x] Pozvati kao prvu liniju `endBettingRound()`
- [x] Dodati 6 testova u `table.test.ts`
- [x] `npm run poker:test` — snimiti raw log u `task-evidence/poker-uncalled-bet-refund/poker-test-pass-77-of-77.log`
- [x] Ažurirati Status u ovom planu na **Implemented**
